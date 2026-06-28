/**
 * Cloud client (Electron main). Holds the better-auth session token in the OS
 * keychain (safeStorage) and authenticates the API via Authorization: Bearer.
 * Email/password signs in fully in-process (reads the set-auth-token header);
 * social sign-in runs the provider OAuth in an in-app window and reads the
 * resulting session cookie (which is the bearer token).
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import {
  CloudApi,
  createKeyMaterial,
  type KeyMaterial,
  type KeyMaterialDTO,
  rewrapWithPassphrase,
  runSync,
  type SyncReport,
  unlockWithPassphrase,
  unlockWithRecovery,
} from "@bootible/core";
import { app, ipcMain, safeStorage, shell } from "electron";
import { makeLocalStore } from "./profiles-store";

const API_BASE = process.env.BOOTIBLE_API_BASE ?? "https://api.bootible.dev";
// better-auth rejects state-changing requests without an Origin; a native client
// sends a same-origin header (Node fetch permits it, unlike a browser).
const ORIGIN = new URL(API_BASE).origin;
const PROVIDERS = new Set(["google", "github", "discord", "twitch"]);

const tokenFile = () => join(app.getPath("userData"), "cloud-session.bin");

function saveToken(token: string): void {
  const data = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(token)
    : Buffer.from(token, "utf8");
  writeFileSync(tokenFile(), data);
}

function loadToken(): string | null {
  const f = tokenFile();
  if (!existsSync(f)) return null;
  try {
    const buf = readFileSync(f);
    return safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(buf)
      : buf.toString("utf8");
  } catch {
    return null;
  }
}

function clearToken(): void {
  const f = tokenFile();
  if (existsSync(f)) rmSync(f);
}

let token: string | null = null;
// When sign-in needs a second factor, better-auth sets a short-lived cookie and
// withholds the session token until verify-totp. A native client has no cookie
// jar, so we capture it here and replay it on the verify call.
let pendingCookie: string | null = null;

function api(): CloudApi {
  return new CloudApi({
    baseUrl: API_BASE,
    origin: ORIGIN,
    authHeader: () => (token ? `Bearer ${token}` : undefined),
  });
}

// ── E2E data key (DEK) — unwrapped key cached in the OS keychain, never sent ──
const dekFile = () => join(app.getPath("userData"), "cloud-dek.bin");
let dek: Uint8Array | null = null;

function saveDek(bytes: Uint8Array): void {
  const b64 = Buffer.from(bytes).toString("base64");
  const data = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(b64)
    : Buffer.from(b64, "utf8");
  writeFileSync(dekFile(), data);
}

function loadDek(): Uint8Array | null {
  const f = dekFile();
  if (!existsSync(f)) return null;
  try {
    const buf = readFileSync(f);
    const b64 = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(buf)
      : buf.toString("utf8");
    return new Uint8Array(Buffer.from(b64, "base64"));
  } catch {
    return null;
  }
}

function clearDek(): void {
  const f = dekFile();
  if (existsSync(f)) rmSync(f);
  dek = null;
}

/** KeyMaterial (core crypto) ⇄ the /api/keys row shape. */
function toKeyDTO(m: KeyMaterial): KeyMaterialDTO {
  return {
    kdf: m.kdf,
    params_json: JSON.stringify(m.params),
    passphrase_salt: m.passphraseSalt,
    recovery_salt: m.recoverySalt,
    wrapped_by_passphrase: m.wrappedByPassphrase,
    wrapped_by_recovery: m.wrappedByRecovery,
    updated_at: Date.now(),
  };
}
function fromKeyDTO(d: KeyMaterialDTO): KeyMaterial {
  return {
    kdf: "argon2id",
    params: JSON.parse(d.params_json),
    passphraseSalt: d.passphrase_salt,
    recoverySalt: d.recovery_salt,
    wrappedByPassphrase: d.wrapped_by_passphrase,
    wrappedByRecovery: d.wrapped_by_recovery,
  };
}

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : "Something went wrong");

/** Persist a rotated bearer token from a response's set-auth-token header. */
function captureToken(res: Response): void {
  const t = res.headers.get("set-auth-token");
  if (t) {
    token = t;
    saveToken(t);
  }
}

interface AuthResult {
  ok: boolean;
  error?: string;
}

/** Email sign-up/in: capture the bearer token, or signal a required 2FA step. */
async function emailAuth(
  path: string,
  body: unknown,
): Promise<AuthResult & { twoFactor?: boolean; needsVerification?: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", Origin: ORIGIN },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as {
      message?: string;
      twoFactorRedirect?: boolean;
    };
    if (!res.ok) {
      // 403 on sign-in = email not verified (better-auth resends a link).
      if (res.status === 403) return { ok: false, needsVerification: true, error: data.message };
      return { ok: false, error: data.message ?? `Failed (HTTP ${res.status})` };
    }
    if (data.twoFactorRedirect) {
      // 2FA required — stash the pending cookie for the verify-totp call.
      const sc =
        (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
      pendingCookie = sc.map((c) => c.split(";")[0]).join("; ") || null;
      return { ok: true, twoFactor: true };
    }
    const t = res.headers.get("set-auth-token");
    if (t) {
      token = t;
      saveToken(t);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

/**
 * Social sign-in, the RFC 8252 way: open the provider OAuth in the SYSTEM browser
 * (which already has the user's provider sessions and doesn't crash like an
 * embedded window), and receive the session token on a one-shot loopback server.
 * A random `state` nonce ties the browser round-trip to this listener.
 * Worker side: /desktop/start begins sign-in, /desktop/done posts the token here.
 */
async function runSocialSignIn(provider: string): Promise<AuthResult> {
  if (!PROVIDERS.has(provider)) return { ok: false, error: "Unknown provider." };
  const state = randomBytes(16).toString("hex");

  return new Promise<AuthResult>((resolve) => {
    let settled = false;
    const finish = (r: AuthResult): void => {
      if (settled) return;
      settled = true;
      server.close();
      resolve(r);
    };

    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (url.searchParams.get("state") !== state) {
        res.writeHead(204).end(); // favicon / stray request — ignore
        return;
      }
      const tok = url.searchParams.get("token");
      res.writeHead(200, { "content-type": "text/html" });
      res.end(
        `<!doctype html><meta charset="utf-8"><body style="margin:0;height:100vh;display:grid;place-items:center;background:#0e0f12;color:#eceae3;font-family:system-ui,sans-serif">${
          tok
            ? "You're signed in to bootible — you can close this tab."
            : "Sign-in didn't complete. Close this tab and try again."
        }</body>`,
      );
      if (tok) {
        token = decodeURIComponent(tok);
        saveToken(token);
        finish({ ok: true });
      } else {
        finish({ ok: false, error: url.searchParams.get("error") ?? "Sign-in failed." });
      }
    });

    server.on("error", () =>
      finish({ ok: false, error: "Couldn't start the local sign-in listener." }),
    );
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      void shell.openExternal(
        `${API_BASE}/desktop/start?provider=${encodeURIComponent(provider)}&port=${port}&state=${state}`,
      );
    });
    setTimeout(() => finish({ ok: false, error: "Sign-in timed out." }), 5 * 60 * 1000);
  });
}

/** Run a full profile sync when signed in + unlocked. Best-effort (offline-safe). */
async function doSync(): Promise<SyncReport | null> {
  if (!token || !dek) return null;
  try {
    return await runSync(api(), dek, makeLocalStore());
  } catch {
    return null;
  }
}

export function registerCloudIpc(): void {
  token = loadToken();
  dek = loadDek();

  ipcMain.handle("cloud:status", async () => {
    if (!token) return { signedIn: false };
    try {
      const res = await fetch(`${API_BASE}/api/auth/get-session`, {
        headers: { Origin: ORIGIN, authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        token = null;
        clearToken();
        return { signedIn: false };
      }
      const s = (await res.json()) as {
        user?: { id?: string; email?: string; twoFactorEnabled?: boolean };
      } | null;
      if (!s?.user?.id) {
        token = null;
        clearToken();
        return { signedIn: false };
      }
      return {
        signedIn: true,
        accountId: s.user.id,
        email: s.user.email,
        twoFactorEnabled: !!s.user.twoFactorEnabled,
      };
    } catch {
      // Network down — keep the cached session rather than signing out.
      return { signedIn: true };
    }
  });

  ipcMain.handle(
    "cloud:signUpEmail",
    (_e, b: { email: string; password: string; name?: string }): Promise<AuthResult> =>
      emailAuth("sign-up/email", { email: b.email, password: b.password, name: b.name || b.email }),
  );

  ipcMain.handle(
    "cloud:signInEmail",
    (_e, b: { email: string; password: string }): Promise<AuthResult> =>
      emailAuth("sign-in/email", b),
  );

  ipcMain.handle("cloud:signOut", async (): Promise<AuthResult> => {
    token = null;
    clearToken();
    clearDek();
    return { ok: true };
  });

  // ── Sync key (E2E) ─────────────────────────────────────────────────────────
  // Where the user is in the key lifecycle: needs setup, needs unlock, or ready.
  ipcMain.handle("cloud:keyStatus", async () => {
    if (!token) return { signedIn: false, hasServerKey: false, unlocked: false };
    // Default to the NON-destructive path (unlock): only treat a key as absent on
    // a clean "no key" — never offer Setup just because a check failed, or "Generate
    // new" could overwrite an existing key and orphan the user's encrypted secrets.
    let hasServerKey = true;
    try {
      hasServerKey = (await api().getKeys()) !== null;
    } catch {
      // couldn't check — keep hasServerKey = true (unlock), the safe default
    }
    return { signedIn: true, hasServerKey, unlocked: dek !== null };
  });

  // First-ever: mint the DEK, wrap it by the passphrase + a recovery code, upload wrapped.
  ipcMain.handle(
    "cloud:setupKey",
    async (_e, passphrase: string): Promise<AuthResult & { recoveryCode?: string }> => {
      if (!token) return { ok: false, error: "Not signed in" };
      if (!passphrase || passphrase.length < 8)
        return { ok: false, error: "Use a passphrase of at least 8 characters." };
      try {
        // Never overwrite an existing key — that would orphan already-synced secrets.
        if (await api().getKeys()) {
          return {
            ok: false,
            error: "You already have a sync key — unlock with your passphrase or recovery code.",
          };
        }
        const setup = await createKeyMaterial(passphrase);
        await api().putKeys(toKeyDTO(setup.material));
        dek = setup.dek;
        saveDek(dek);
        void doSync();
        return { ok: true, recoveryCode: setup.recoveryCode };
      } catch (e) {
        return { ok: false, error: errMsg(e) };
      }
    },
  );

  // New device: unwrap the DEK with the sync passphrase.
  ipcMain.handle("cloud:unlock", async (_e, passphrase: string): Promise<AuthResult> => {
    try {
      const dto = await api().getKeys();
      if (!dto) return { ok: false, error: "No sync key set up yet." };
      const r = await unlockWithPassphrase(fromKeyDTO(dto), passphrase);
      if (!r.ok) return { ok: false, error: "That passphrase didn't match." };
      dek = r.value;
      saveDek(dek);
      void doSync();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errMsg(e) };
    }
  });

  // Forgot the passphrase: unwrap with the recovery code.
  ipcMain.handle("cloud:unlockRecovery", async (_e, code: string): Promise<AuthResult> => {
    try {
      const dto = await api().getKeys();
      if (!dto) return { ok: false, error: "No sync key set up yet." };
      const r = await unlockWithRecovery(fromKeyDTO(dto), code);
      if (!r.ok) return { ok: false, error: "That recovery code didn't match." };
      dek = r.value;
      saveDek(dek);
      void doSync();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errMsg(e) };
    }
  });

  // Set a NEW passphrase for the already-unlocked DEK (used after recovery).
  // Re-wraps the same DEK — secrets stay decryptable, recovery code unchanged.
  ipcMain.handle("cloud:resetPassphrase", async (_e, newPass: string): Promise<AuthResult> => {
    if (!token || !dek) return { ok: false, error: "Unlock first." };
    if (!newPass || newPass.length < 8)
      return { ok: false, error: "Use a passphrase of at least 8 characters." };
    try {
      const dto = await api().getKeys();
      if (!dto) return { ok: false, error: "No sync key to update." };
      const updated = await rewrapWithPassphrase(fromKeyDTO(dto), dek, newPass);
      await api().putKeys(toKeyDTO(updated));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errMsg(e) };
    }
  });

  // ── Two-factor (TOTP) ──────────────────────────────────────────────────────
  // Complete a sign-in second factor: replay the pending cookie, get the token.
  ipcMain.handle("cloud:verifyTotp", async (_e, code: string): Promise<AuthResult> => {
    if (!pendingCookie) return { ok: false, error: "No sign-in in progress." };
    try {
      const res = await fetch(`${API_BASE}/api/auth/two-factor/verify-totp`, {
        method: "POST",
        headers: { "content-type": "application/json", Origin: ORIGIN, Cookie: pendingCookie },
        body: JSON.stringify({ code, trustDevice: false }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        return { ok: false, error: d.message ?? "That code didn't match." };
      }
      const t = res.headers.get("set-auth-token");
      if (t) {
        token = t;
        saveToken(t);
      }
      pendingCookie = null;
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errMsg(e) };
    }
  });

  // Begin enrollment: returns the TOTP URI (for a QR) + one-time backup codes.
  ipcMain.handle(
    "cloud:enable2FA",
    async (
      _e,
      password: string,
    ): Promise<AuthResult & { totpURI?: string; backupCodes?: string[] }> => {
      if (!token) return { ok: false, error: "Not signed in" };
      try {
        const res = await fetch(`${API_BASE}/api/auth/two-factor/enable`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Origin: ORIGIN,
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ password }),
        });
        const d = (await res.json().catch(() => ({}))) as {
          message?: string;
          totpURI?: string;
          backupCodes?: string[];
        };
        if (!res.ok) return { ok: false, error: d.message ?? "Couldn't start 2FA setup." };
        captureToken(res);
        return { ok: true, totpURI: d.totpURI, backupCodes: d.backupCodes };
      } catch (e) {
        return { ok: false, error: errMsg(e) };
      }
    },
  );

  // Confirm enrollment with a code from the authenticator app.
  ipcMain.handle("cloud:verify2FASetup", async (_e, code: string): Promise<AuthResult> => {
    if (!token) return { ok: false, error: "Not signed in" };
    try {
      const res = await fetch(`${API_BASE}/api/auth/two-factor/verify-totp`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Origin: ORIGIN,
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        return { ok: false, error: d.message ?? "That code didn't match." };
      }
      captureToken(res); // enabling 2FA rotates the session token
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errMsg(e) };
    }
  });

  // Turn 2FA off (requires the password).
  ipcMain.handle("cloud:disable2FA", async (_e, password: string): Promise<AuthResult> => {
    if (!token) return { ok: false, error: "Not signed in" };
    try {
      const res = await fetch(`${API_BASE}/api/auth/two-factor/disable`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Origin: ORIGIN,
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        return { ok: false, error: d.message ?? "Couldn't disable 2FA." };
      }
      captureToken(res);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errMsg(e) };
    }
  });

  // Manual / post-save sync trigger. Returns the report, or null if not ready.
  ipcMain.handle("cloud:syncNow", () => doSync());

  // Social: run the provider OAuth in an in-app window, capture the session.
  ipcMain.handle("cloud:signInSocial", (_e, provider: string) => runSocialSignIn(provider));

  // Resend the email-verification link.
  ipcMain.handle("cloud:resendVerification", async (_e, email: string): Promise<AuthResult> => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/send-verification-email`, {
        method: "POST",
        headers: { "content-type": "application/json", Origin: ORIGIN },
        body: JSON.stringify({ email, callbackURL: "/verified" }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        return { ok: false, error: d.message ?? "Couldn't resend the email." };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errMsg(e) };
    }
  });
}
