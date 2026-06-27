/**
 * Cloud client (Electron main). Holds the better-auth session token in the OS
 * keychain (safeStorage) and authenticates the API via Authorization: Bearer.
 * Email/password signs in fully in-process (reads the set-auth-token header);
 * social sign-in opens the system browser (token capture lands next).
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CloudApi,
  createKeyMaterial,
  type KeyMaterial,
  type KeyMaterialDTO,
  unlockWithPassphrase,
  unlockWithRecovery,
} from "@bootible/core";
import { app, ipcMain, safeStorage, shell } from "electron";

const API_BASE = process.env.BOOTIBLE_API_BASE ?? "https://api.bootible.dev";
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

function api(): CloudApi {
  return new CloudApi({
    baseUrl: API_BASE,
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

interface AuthResult {
  ok: boolean;
  error?: string;
}

/** Email sign-up/in: POST, capture the bearer token from the set-auth-token header. */
async function emailAuth(path: string, body: unknown): Promise<AuthResult> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) return { ok: false, error: data.message ?? `Failed (HTTP ${res.status})` };
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

export function registerCloudIpc(): void {
  token = loadToken();
  dek = loadDek();

  ipcMain.handle("cloud:status", async () => {
    if (!token) return { signedIn: false };
    const accountId = await api().sessionAccountId();
    if (!accountId) {
      token = null;
      clearToken();
      return { signedIn: false };
    }
    return { signedIn: true, accountId };
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
    let hasServerKey = false;
    try {
      hasServerKey = (await api().getKeys()) !== null;
    } catch {
      // network/unauthorized — report best-effort
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
        const setup = await createKeyMaterial(passphrase);
        await api().putKeys(toKeyDTO(setup.material));
        dek = setup.dek;
        saveDek(dek);
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
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errMsg(e) };
    }
  });

  // Social: ask better-auth for the provider authorize URL, open it in the system
  // browser (providers block embedded webviews). Token capture is the next step.
  ipcMain.handle(
    "cloud:signInSocial",
    async (_e, provider: string): Promise<AuthResult & { opened?: boolean }> => {
      if (!PROVIDERS.has(provider)) return { ok: false, error: "unknown provider" };
      try {
        const res = await fetch(`${API_BASE}/api/auth/sign-in/social`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ provider, callbackURL: "bootible://auth-callback" }),
        });
        const data = (await res.json().catch(() => ({}))) as { url?: string };
        if (!data.url) return { ok: false, error: "no authorize url" };
        await shell.openExternal(data.url);
        return { ok: true, opened: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Network error" };
      }
    },
  );
}
