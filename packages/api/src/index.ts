import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import { createAuth } from "./auth";
import {
  deleteAccountData,
  getKeys,
  getProfile,
  type KeyRow,
  listProfiles,
  type ProfileRow,
  putKeys,
  tombstoneProfile,
  upsertProfile,
} from "./db";
import type { Bindings } from "./env";

type Variables = { auth: ReturnType<typeof createAuth> };
type Env = { Bindings: Bindings; Variables: Variables };
type Ctx = Context<Env>;
const app = new Hono<Env>();

// CORS for the Electron client (reflect origin; tighten once the desktop origin is fixed).
app.use(
  "/api/**",
  cors({
    origin: (o) => o,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "PUT", "DELETE", "POST", "OPTIONS"],
    credentials: true,
  }),
);

// better-auth instance, cached per origin per isolate. Re-creating it on every
// request (plugins + D1 dialect setup) is a big slice of the auth latency; geolocation
// is off so no per-request cf context is needed.
const authByOrigin = new Map<string, ReturnType<typeof createAuth>>();
app.use("*", async (c, next) => {
  const origin = new URL(c.req.url).origin;
  let auth = authByOrigin.get(origin);
  if (!auth) {
    auth = createAuth(c.env, undefined, origin);
    authByOrigin.set(origin, auth);
  }
  c.set("auth", auth);
  await next();
});

// All better-auth endpoints (sign-in, callbacks, session).
app.all("/api/auth/*", (c) => c.get("auth").handler(c.req.raw));

// ── Desktop OAuth hand-off ───────────────────────────────────────────────────
// The Electron app opens /desktop/start in the SYSTEM browser (which has the
// user's provider sessions and doesn't crash like an embedded window). We begin
// social sign-in there, then /desktop/done hands the session token to the app's
// loopback server (127.0.0.1:<port>).
const DESKTOP_PROVIDERS = new Set(["google", "github", "discord", "twitch"]);

const validHandoff = (port: string, state: string) =>
  /^\d{1,5}$/.test(port) && /^[a-f0-9]{16,64}$/i.test(state);

app.get("/desktop/start", (c) => {
  const provider = c.req.query("provider") ?? "";
  const port = c.req.query("port") ?? "";
  const state = c.req.query("state") ?? "";
  if (!DESKTOP_PROVIDERS.has(provider) || !validHandoff(port, state)) {
    return c.text("bad request", 400);
  }
  const done = `${new URL(c.req.url).origin}/desktop/done?port=${port}&state=${state}`;
  return c.html(
    `<!doctype html><meta charset="utf-8"><title>Signing in…</title>
<body style="margin:0;height:100vh;display:grid;place-items:center;background:#0e0f12;color:#8b919c;font-family:system-ui,sans-serif">Signing you in…
<script>
fetch("/api/auth/sign-in/social",{method:"POST",headers:{"content-type":"application/json"},credentials:"include",body:JSON.stringify({provider:${JSON.stringify(provider)},callbackURL:${JSON.stringify(done)}})})
 .then(function(r){return r.json()}).then(function(d){if(d&&d.url){location.href=d.url}else{document.body.textContent="Couldn't start sign-in."}})
 .catch(function(){document.body.textContent="Couldn't start sign-in."});
</script>`,
  );
});

// Throwaway browser test harness for the auth surface (sign-up/in/out, session,
// social). Same-origin to the API so cookies + CSRF work. Staging/local only.
app.get("/test", (c) => {
  const host = c.req.header("host") ?? "";
  if (!/staging|localhost|127\.0\.0\.1/.test(host)) return c.notFound();
  return c.html(
    `<!doctype html><meta charset="utf-8"><title>bootible auth test</title>
<body style="font-family:system-ui,sans-serif;max-width:600px;margin:40px auto;padding:0 16px;background:#0e0f12;color:#eceae3">
  <h1 style="font-size:20px">bootible auth test harness <span style="color:#8b919c;font-size:13px">(${host})</span></h1>
  <input id="email" type="email" placeholder="email" style="width:100%;box-sizing:border-box;padding:8px;margin:4px 0;background:#15171c;color:#eceae3;border:1px solid #2a2d35;border-radius:6px">
  <input id="pw" type="password" placeholder="password" style="width:100%;box-sizing:border-box;padding:8px;margin:4px 0;background:#15171c;color:#eceae3;border:1px solid #2a2d35;border-radius:6px">
  <div style="margin:8px 0">
    <button data-act="signup">Sign up</button>
    <button data-act="signin">Sign in</button>
    <button data-act="signout">Sign out</button>
    <button data-act="session">Get session</button>
    <button data-act="forgot">Forgot password</button>
  </div>
  <div style="margin:8px 0">2FA:
    <input id="totp" inputmode="numeric" placeholder="123456" style="width:90px;padding:8px;background:#15171c;color:#eceae3;border:1px solid #2a2d35;border-radius:6px">
    <button data-act="totp">Verify code</button>
  </div>
  <div style="margin:8px 0">Social:
    <button data-social="google">Google</button>
    <button data-social="github">GitHub</button>
    <button data-social="discord">Discord</button>
    <button data-social="twitch">Twitch</button>
  </div>
  <pre id="out" style="background:#0a0b0d;color:#7ee787;padding:12px;border-radius:8px;white-space:pre-wrap;word-break:break-all;min-height:80px"></pre>
  <script>
    var out = function (x) { document.getElementById("out").textContent = typeof x === "string" ? x : JSON.stringify(x, null, 2); };
    var email = function () { return document.getElementById("email").value; };
    var pw = function () { return document.getElementById("pw").value; };
    function call(path, body, method) {
      return fetch("/api/auth/" + path, { method: method || "POST", headers: { "content-type": "application/json" }, credentials: "include", body: method === "GET" ? undefined : JSON.stringify(body) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { out({ status: r.status, body: d }); return { r: r, d: d }; }); });
    }
    document.querySelectorAll("[data-act]").forEach(function (b) {
      b.onclick = function () {
        var a = b.dataset.act;
        if (a === "signup") call("sign-up/email", { email: email(), password: pw(), name: email() });
        else if (a === "signin") call("sign-in/email", { email: email(), password: pw() });
        else if (a === "signout") call("sign-out", {});
        else if (a === "forgot") call("request-password-reset", { email: email(), redirectTo: location.origin + "/reset-password" });
        else if (a === "totp") call("two-factor/verify-totp", { code: document.getElementById("totp").value });
        else if (a === "session") fetch("/api/auth/get-session", { credentials: "include" }).then(function (r) { return r.json().then(function (d) { out({ status: r.status, body: d }); }); });
      };
    });
    document.querySelectorAll("[data-social]").forEach(function (b) {
      b.onclick = function () {
        fetch("/api/auth/sign-in/social", { method: "POST", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify({ provider: b.dataset.social, callbackURL: location.href }) })
          .then(function (r) { return r.json(); }).then(function (d) { if (d.url) location.href = d.url; else out(d); });
      };
    });
  </script>
</body>`,
  );
});

// Password-reset page: better-auth redirects the email link here with ?token=…
// (or ?error=INVALID_TOKEN). Collects a new password and posts reset-password.
app.get("/reset-password", (c) =>
  c.html(
    `<!doctype html><meta charset="utf-8"><title>Reset password</title>
<body style="margin:0;height:100vh;display:grid;place-items:center;background:#0e0f12;color:#eceae3;font-family:system-ui,'Segoe UI',sans-serif">
  <div style="width:340px;max-width:90vw;padding:24px">
    <h1 style="font-size:22px;margin:0 0 16px">Reset your password</h1>
    <form id="f">
      <input id="pw" type="password" placeholder="New password (8+ characters)" minlength="8" required
        style="width:100%;box-sizing:border-box;padding:12px;border-radius:8px;border:1px solid #2a2d35;background:#15171c;color:#eceae3;margin:0 0 12px" />
      <button type="submit" style="width:100%;padding:12px;border:0;border-radius:8px;background:#f0a000;color:#0e0f12;font-weight:600;cursor:pointer">Set new password</button>
    </form>
    <p id="msg" style="color:#b7bcc6;line-height:1.5;margin:16px 0 0"></p>
  </div>
  <script>
    var q = new URLSearchParams(location.search);
    var token = q.get("token"), msg = document.getElementById("msg"), f = document.getElementById("f");
    if (!token || q.get("error")) { f.style.display = "none"; msg.textContent = "This reset link is invalid or has expired. Request a new one from the app."; }
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var pw = document.getElementById("pw").value;
      msg.textContent = "Updating…";
      fetch("/api/auth/reset-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ newPassword: pw, token: token }) })
        .then(function (r) { return r.ok ? r : r.json().then(function (d) { throw new Error(d.message || "Reset failed"); }); })
        .then(function () { f.style.display = "none"; msg.textContent = "Password updated. Head back to bootible and sign in."; })
        .catch(function (err) { msg.textContent = err.message; });
    });
  </script>
</body>`,
  ),
);

// Landing page after a verification link is clicked (better-auth redirects here).
app.get("/verified", (c) =>
  c.html(
    `<!doctype html><meta charset="utf-8"><title>Email verified</title>
<body style="margin:0;height:100vh;display:grid;place-items:center;background:#0e0f12;color:#eceae3;font-family:system-ui,'Segoe UI',sans-serif">
  <div style="text-align:center;max-width:380px;padding:24px">
    <div style="font-size:40px;line-height:1">✓</div>
    <h1 style="font-size:22px;margin:12px 0 8px">Email verified</h1>
    <p style="color:#b7bcc6;line-height:1.5;margin:0">Your bootible account is confirmed. You can close this tab and head back to the app.</p>
  </div>
</body>`,
  ),
);

app.get("/desktop/done", (c) => {
  const port = c.req.query("port") ?? "";
  const state = c.req.query("state") ?? "";
  if (!validHandoff(port, state)) return c.text("bad request", 400);
  const loop = `http://127.0.0.1:${port}/?state=${state}`;
  const cookie = c.req.header("cookie") ?? "";
  const m = cookie.match(/(?:^|;\s*)[^=;]*session_token[^=;]*=([^;]+)/);
  return c.redirect(
    m?.[1] ? `${loop}&token=${encodeURIComponent(m[1])}` : `${loop}&error=no_session`,
  );
});

/** Resolve the signed-in account id, or null. */
async function accountId(c: Ctx): Promise<string | null> {
  const session = await c.get("auth").api.getSession({ headers: c.req.raw.headers });
  return session?.user?.id ?? null;
}

const num = (v: unknown, d: number): number => (typeof v === "number" ? v : d);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown): string | null => (typeof v === "string" ? v : null);

// ── Profiles ─────────────────────────────────────────────────────────────────
app.get("/api/profiles", async (c) => {
  const acct = await accountId(c);
  if (!acct) return c.json({ error: "unauthorized" }, 401);
  return c.json({ profiles: await listProfiles(c.env.DATABASE, acct) });
});

app.get("/api/profiles/:id", async (c) => {
  const acct = await accountId(c);
  if (!acct) return c.json({ error: "unauthorized" }, 401);
  const row = await getProfile(c.env.DATABASE, acct, c.req.param("id"));
  return row ? c.json(row) : c.json({ error: "not-found" }, 404);
});

app.put("/api/profiles/:id", async (c) => {
  const acct = await accountId(c);
  if (!acct) return c.json({ error: "unauthorized" }, 401);
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const row: ProfileRow = {
    id: c.req.param("id"),
    name: str(b.name),
    device_id: strOrNull(b.device_id),
    base_id: strOrNull(b.base_id),
    ui_json: typeof b.ui_json === "string" ? b.ui_json : JSON.stringify(b.ui ?? {}),
    secrets_enc: strOrNull(b.secrets_enc),
    version: num(b.version, 1),
    updated_at: num(b.updated_at, Date.now()),
    deleted: b.deleted ? 1 : 0,
  };
  if (!row.name) return c.json({ error: "name-required" }, 400);
  await upsertProfile(c.env.DATABASE, acct, row);
  return c.json({ ok: true });
});

app.delete("/api/profiles/:id", async (c) => {
  const acct = await accountId(c);
  if (!acct) return c.json({ error: "unauthorized" }, 401);
  await tombstoneProfile(c.env.DATABASE, acct, c.req.param("id"), Date.now());
  return c.json({ ok: true });
});

// ── Wrapped key material (zero-knowledge) ────────────────────────────────────
app.get("/api/keys", async (c) => {
  const acct = await accountId(c);
  if (!acct) return c.json({ error: "unauthorized" }, 401);
  const k = await getKeys(c.env.DATABASE, acct);
  return k ? c.json(k) : c.json({ error: "not-found" }, 404);
});

app.put("/api/keys", async (c) => {
  const acct = await accountId(c);
  if (!acct) return c.json({ error: "unauthorized" }, 401);
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const k: KeyRow = {
    kdf: str(b.kdf) || "argon2id",
    params_json: typeof b.params_json === "string" ? b.params_json : JSON.stringify(b.params ?? {}),
    passphrase_salt: str(b.passphrase_salt),
    recovery_salt: str(b.recovery_salt),
    wrapped_by_passphrase: str(b.wrapped_by_passphrase),
    wrapped_by_recovery: str(b.wrapped_by_recovery),
    updated_at: num(b.updated_at, Date.now()),
  };
  await putKeys(c.env.DATABASE, acct, k);
  return c.json({ ok: true });
});

// ── Account ──────────────────────────────────────────────────────────────────
app.delete("/api/account", async (c) => {
  const acct = await accountId(c);
  if (!acct) return c.json({ error: "unauthorized" }, 401);
  await deleteAccountData(c.env.DATABASE, acct);
  return c.json({ ok: true });
});

app.get("/", (c) => c.text("bootible api"));

export default app;
