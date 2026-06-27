import { beforeAll, describe, expect, it } from "vitest";
import type { ProfilePayload } from "./cloud-api";
import { createKeyMaterial, encryptSecrets, type KdfParams } from "./cloud-crypto";
import {
  conflictId,
  type LocalProfile,
  type LocalStore,
  runSync,
  type SyncApi,
} from "./cloud-sync-run";

const FAST: KdfParams = { memorySize: 1024, iterations: 1, parallelism: 1 };
let dek: Uint8Array;
beforeAll(async () => {
  dek = (await createKeyMaterial("pw", FAST)).dek;
});

function fakeApi(seed: ProfilePayload[] = []) {
  const store = new Map(seed.map((p) => [p.id, p]));
  const api: SyncApi = {
    async listProfiles() {
      return [...store.values()].map((p) => ({
        id: p.id,
        name: p.name,
        version: p.version,
        updated_at: p.updated_at,
        deleted: p.deleted,
      }));
    },
    async getProfile(id) {
      return store.get(id) ?? null;
    },
    async putProfile(p) {
      store.set(p.id, { ...p });
    },
    async deleteProfile(id) {
      const e = store.get(id);
      if (e) store.set(id, { ...e, deleted: 1, version: e.version + 1 });
    },
  };
  return { api, store };
}

function fakeStore(initial: LocalProfile[] = []) {
  const m = new Map(initial.map((p) => [p.id, p]));
  const store: LocalStore = {
    async list() {
      return [...m.values()];
    },
    async put(p) {
      m.set(p.id, p);
    },
    async markSynced(id, v) {
      const e = m.get(id);
      if (e) e.lastSyncedVersion = v;
    },
  };
  return { store, m };
}

const localProfile = (o: Partial<LocalProfile> & { id: string }): LocalProfile => ({
  name: "N",
  deviceId: null,
  baseId: null,
  ui: {},
  secrets: null,
  version: 1,
  updatedAt: 100,
  deleted: false,
  lastSyncedVersion: null,
  ...o,
});

const payload = (o: Partial<ProfilePayload> & { id: string }): ProfilePayload => ({
  name: "N",
  device_id: null,
  base_id: null,
  ui_json: "{}",
  secrets_enc: null,
  version: 1,
  updated_at: 100,
  deleted: 0,
  ...o,
});

describe("runSync", () => {
  it("pushes a local-only profile (encrypts secrets, marks synced)", async () => {
    const { api, store: remote } = fakeApi();
    const { store, m } = fakeStore([localProfile({ id: "a", secrets: { pw: "x" } })]);
    const rep = await runSync(api, dek, store);
    expect(rep.pushed).toContain("a");
    expect(remote.get("a")?.secrets_enc).toBeTruthy();
    expect(remote.get("a")?.secrets_enc).not.toContain("pw"); // encrypted, not plaintext
    expect(m.get("a")?.lastSyncedVersion).toBe(1);
  });

  it("pulls a cloud-only profile and decrypts its secrets", async () => {
    const enc = await encryptSecrets(dek, { token: "abc" });
    const { api } = fakeApi([payload({ id: "b", secrets_enc: enc, version: 2 })]);
    const { store, m } = fakeStore([]);
    const rep = await runSync(api, dek, store);
    expect(rep.pulled).toContain("b");
    expect(m.get("b")?.secrets).toEqual({ token: "abc" });
    expect(m.get("b")?.lastSyncedVersion).toBe(2);
  });

  it("keeps both on divergence: cloud copy imported as conflict, local pushed", async () => {
    const remoteEnc = await encryptSecrets(dek, { who: "remote" });
    const { api, store: remote } = fakeApi([
      payload({ id: "a", name: "A", secrets_enc: remoteEnc, version: 3 }),
    ]);
    const { store, m } = fakeStore([
      localProfile({
        id: "a",
        name: "A",
        secrets: { who: "local" },
        version: 2,
        lastSyncedVersion: 1,
      }),
    ]);
    const rep = await runSync(api, dek, store);
    expect(rep.conflicted).toContain("a");
    // remote edits preserved locally as a conflict copy
    const copy = m.get(conflictId("a"));
    expect(copy?.name).toBe("A (conflict)");
    expect(copy?.secrets).toEqual({ who: "remote" });
    expect(copy?.lastSyncedVersion).toBeNull(); // fresh local-only → pushes next sync
    // local edits pushed under the original id
    expect(remote.get("a")?.version).toBe(2);
  });

  it("propagates a local delete as a cloud tombstone", async () => {
    const { api, store: remote } = fakeApi([payload({ id: "a", version: 1 })]);
    const { store } = fakeStore([
      localProfile({ id: "a", deleted: true, version: 2, lastSyncedVersion: 1 }),
    ]);
    const rep = await runSync(api, dek, store);
    expect(rep.pushed).toContain("a");
    expect(remote.get("a")?.deleted).toBe(1);
  });

  it("does nothing when already in sync", async () => {
    const { api } = fakeApi([payload({ id: "a", version: 5 })]);
    const { store } = fakeStore([localProfile({ id: "a", version: 5, lastSyncedVersion: 5 })]);
    const rep = await runSync(api, dek, store);
    expect(rep).toEqual({ pulled: [], pushed: [], conflicted: [], failed: [] });
  });
});
