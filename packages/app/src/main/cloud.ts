/**
 * Cloud client (Electron main). Holds the better-auth session token in the OS
 * keychain (safeStorage) and authenticates the API via Authorization: Bearer.
 * Email/password signs in fully in-process (reads the set-auth-token header);
 * social sign-in opens the system browser (token capture lands next).
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CloudApi } from "@bootible/core";
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
    return { ok: true };
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
