import { describe, expect, it } from "vitest";
import { CloudApi, CloudError, type FetchLike } from "./cloud-api";

function mock(
  handler: (
    url: string,
    init?: { method?: string; body?: string },
  ) => { status: number; body?: unknown },
) {
  const calls: { url: string; method?: string; body?: string; headers?: Record<string, string> }[] =
    [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, method: init?.method, body: init?.body, headers: init?.headers });
    const r = handler(url, init);
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => r.body ?? null,
    };
  };
  return { fetchImpl, calls };
}

const base = "https://api.example";

describe("CloudApi", () => {
  it("lists profiles (unwraps {profiles})", async () => {
    const { fetchImpl, calls } = mock(() => ({ status: 200, body: { profiles: [{ id: "a" }] } }));
    const api = new CloudApi({ baseUrl: base, fetchImpl });
    expect(await api.listProfiles()).toEqual([{ id: "a" }]);
    expect(calls[0]).toMatchObject({ url: `${base}/api/profiles`, method: "GET" });
  });

  it("attaches the auth header when provided", async () => {
    const { fetchImpl, calls } = mock(() => ({ status: 200, body: { profiles: [] } }));
    const api = new CloudApi({ baseUrl: base, fetchImpl, authHeader: () => "Bearer tok" });
    await api.listProfiles();
    expect(calls[0]?.headers?.authorization).toBe("Bearer tok");
  });

  it("PUTs a profile as JSON to its id path", async () => {
    const { fetchImpl, calls } = mock(() => ({ status: 200 }));
    const api = new CloudApi({ baseUrl: base, fetchImpl });
    await api.putProfile({
      id: "p 1",
      name: "n",
      device_id: null,
      base_id: null,
      ui_json: "{}",
      secrets_enc: null,
      version: 1,
      updated_at: 1,
      deleted: 0,
    });
    expect(calls[0]?.method).toBe("PUT");
    expect(calls[0]?.url).toBe(`${base}/api/profiles/p%201`);
    expect(JSON.parse(calls[0]?.body ?? "{}").name).toBe("n");
  });

  it("returns null on 404 for getProfile / getKeys", async () => {
    const { fetchImpl } = mock(() => ({ status: 404 }));
    const api = new CloudApi({ baseUrl: base, fetchImpl });
    expect(await api.getProfile("x")).toBeNull();
    expect(await api.getKeys()).toBeNull();
  });

  it("throws CloudError with the status on failure", async () => {
    const { fetchImpl } = mock(() => ({ status: 401 }));
    const api = new CloudApi({ baseUrl: base, fetchImpl });
    await expect(api.listProfiles()).rejects.toMatchObject({ status: 401 });
    await expect(api.listProfiles()).rejects.toBeInstanceOf(CloudError);
  });

  it("sessionAccountId returns the user id, or null when unauthenticated", async () => {
    const ok = mock(() => ({ status: 200, body: { user: { id: "u1" } } }));
    expect(await new CloudApi({ baseUrl: base, fetchImpl: ok.fetchImpl }).sessionAccountId()).toBe(
      "u1",
    );
    const no = mock(() => ({ status: 401 }));
    expect(
      await new CloudApi({ baseUrl: base, fetchImpl: no.fetchImpl }).sessionAccountId(),
    ).toBeNull();
  });
});
