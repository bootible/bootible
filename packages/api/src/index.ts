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
