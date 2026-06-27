/**
 * Typed client for the bootible cloud API (packages/api Worker). Transport- and
 * auth-agnostic: pass a `fetchImpl` (defaults to global fetch) and an `authHeader`
 * provider (the Electron main supplies the better-auth session token). Mirrors the
 * Worker's routes; the row shapes match the D1 columns.
 */

export interface ProfileSummary {
  id: string;
  name: string;
  version: number;
  updated_at: number;
  deleted: number;
}

export interface ProfilePayload extends ProfileSummary {
  device_id: string | null;
  base_id: string | null;
  ui_json: string;
  secrets_enc: string | null;
}

export interface KeyMaterialDTO {
  kdf: string;
  params_json: string;
  passphrase_salt: string;
  recovery_salt: string;
  wrapped_by_passphrase: string;
  wrapped_by_recovery: string;
  updated_at: number;
}

/** Minimal fetch shape — the global `fetch` satisfies it; trivial to mock. */
export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface CloudApiOptions {
  baseUrl: string;
  fetchImpl?: FetchLike;
  /** Returns the auth header value (e.g. "Bearer <token>"), or undefined when signed out. */
  authHeader?: () => string | undefined;
}

export class CloudError extends Error {
  constructor(
    readonly status: number,
    readonly op: string,
  ) {
    super(`cloud ${op} failed: HTTP ${status}`);
    this.name = "CloudError";
  }
}

export class CloudApi {
  constructor(private readonly opts: CloudApiOptions) {}

  private async req(method: string, path: string, body?: unknown) {
    const f = this.opts.fetchImpl ?? (fetch as unknown as FetchLike);
    const headers: Record<string, string> = { "content-type": "application/json" };
    const auth = this.opts.authHeader?.();
    if (auth) headers.authorization = auth;
    return f(this.opts.baseUrl + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  /** The signed-in account id, or null when there's no valid session. */
  async sessionAccountId(): Promise<string | null> {
    const r = await this.req("GET", "/api/auth/get-session");
    if (!r.ok) return null;
    const s = (await r.json()) as { user?: { id?: string } } | null;
    return s?.user?.id ?? null;
  }

  async listProfiles(): Promise<ProfileSummary[]> {
    const r = await this.req("GET", "/api/profiles");
    if (!r.ok) throw new CloudError(r.status, "listProfiles");
    return ((await r.json()) as { profiles: ProfileSummary[] }).profiles;
  }

  async getProfile(id: string): Promise<ProfilePayload | null> {
    const r = await this.req("GET", `/api/profiles/${encodeURIComponent(id)}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new CloudError(r.status, "getProfile");
    return (await r.json()) as ProfilePayload;
  }

  async putProfile(p: ProfilePayload): Promise<void> {
    const r = await this.req("PUT", `/api/profiles/${encodeURIComponent(p.id)}`, p);
    if (!r.ok) throw new CloudError(r.status, "putProfile");
  }

  async deleteProfile(id: string): Promise<void> {
    const r = await this.req("DELETE", `/api/profiles/${encodeURIComponent(id)}`);
    if (!r.ok) throw new CloudError(r.status, "deleteProfile");
  }

  async getKeys(): Promise<KeyMaterialDTO | null> {
    const r = await this.req("GET", "/api/keys");
    if (r.status === 404) return null;
    if (!r.ok) throw new CloudError(r.status, "getKeys");
    return (await r.json()) as KeyMaterialDTO;
  }

  async putKeys(k: KeyMaterialDTO): Promise<void> {
    const r = await this.req("PUT", "/api/keys", k);
    if (!r.ok) throw new CloudError(r.status, "putKeys");
  }

  async deleteAccount(): Promise<void> {
    const r = await this.req("DELETE", "/api/account");
    if (!r.ok) throw new CloudError(r.status, "deleteAccount");
  }
}
