import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import {
  type D1Like,
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

// Thin adapter so the real D1 data-access runs against an in-memory SQLite,
// exercising the actual migration SQL + queries.
function d1(sqlite: DatabaseSync): D1Like {
  return {
    prepare(query) {
      const stmt = sqlite.prepare(query);
      let bound: unknown[] = [];
      const api: ReturnType<D1Like["prepare"]> = {
        bind(...values) {
          bound = values;
          return api;
        },
        async all<T>() {
          return { results: stmt.all(...(bound as never[])).map((r) => ({ ...r })) as T[] };
        },
        async run() {
          return stmt.run(...(bound as never[]));
        },
        async first<T>() {
          const r = stmt.get(...(bound as never[]));
          return (r ? { ...r } : null) as T | null;
        },
      };
      return api;
    },
  };
}

const schema = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../migrations/0001_app.sql"),
  "utf8",
);

const profile = (over: Partial<ProfileRow> = {}): ProfileRow => ({
  id: "p1",
  name: "My ROG",
  device_id: "rog-ally",
  base_id: "full-rog",
  ui_json: '{"selectedApps":["vlc"]}',
  secrets_enc: "ZW5j",
  version: 1,
  updated_at: 1000,
  deleted: 0,
  ...over,
});

const keys = (): KeyRow => ({
  kdf: "argon2id",
  params_json: '{"memorySize":65536,"iterations":3,"parallelism":1}',
  passphrase_salt: "c2FsdA==",
  recovery_salt: "cnNhbHQ=",
  wrapped_by_passphrase: "d3A=",
  wrapped_by_recovery: "d3I=",
  updated_at: 2000,
});

let db: D1Like;
beforeEach(() => {
  const s = new DatabaseSync(":memory:");
  s.exec(schema);
  db = d1(s);
});

describe("profiles data-access", () => {
  it("upserts then reads back the full profile", async () => {
    await upsertProfile(db, "acct", profile());
    expect(await getProfile(db, "acct", "p1")).toEqual(profile());
  });

  it("upsert on the same id updates in place (no duplicate, new version)", async () => {
    await upsertProfile(db, "acct", profile());
    await upsertProfile(db, "acct", profile({ name: "Renamed", version: 2, updated_at: 1500 }));
    const list = await listProfiles(db, "acct");
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual({
      id: "p1",
      name: "Renamed",
      version: 2,
      updated_at: 1500,
      deleted: 0,
    });
  });

  it("scopes by account — one account never sees another's rows", async () => {
    await upsertProfile(db, "alice", profile({ id: "a" }));
    await upsertProfile(db, "bob", profile({ id: "b" }));
    expect((await listProfiles(db, "alice")).map((p) => p.id)).toEqual(["a"]);
    expect(await getProfile(db, "alice", "b")).toBeNull();
  });

  it("tombstones a profile (deleted=1, version bumped)", async () => {
    await upsertProfile(db, "acct", profile({ version: 3 }));
    await tombstoneProfile(db, "acct", "p1", 9999);
    const row = await getProfile(db, "acct", "p1");
    expect(row).toMatchObject({ deleted: 1, version: 4, updated_at: 9999 });
  });

  it("returns null for a missing profile", async () => {
    expect(await getProfile(db, "acct", "nope")).toBeNull();
  });
});

describe("account keys data-access", () => {
  it("puts then gets the wrapped key material", async () => {
    await putKeys(db, "acct", keys());
    expect(await getKeys(db, "acct")).toEqual(keys());
  });

  it("put replaces existing material (upsert)", async () => {
    await putKeys(db, "acct", keys());
    await putKeys(db, "acct", { ...keys(), wrapped_by_passphrase: "TEW=", updated_at: 3000 });
    const k = await getKeys(db, "acct");
    expect(k?.wrapped_by_passphrase).toBe("TEW=");
    expect(k?.updated_at).toBe(3000);
  });

  it("returns null when no keys set", async () => {
    expect(await getKeys(db, "acct")).toBeNull();
  });
});

describe("account deletion", () => {
  it("wipes only that account's profiles and keys", async () => {
    await upsertProfile(db, "alice", profile());
    await putKeys(db, "alice", keys());
    await upsertProfile(db, "bob", profile());
    await putKeys(db, "bob", keys());

    await deleteAccountData(db, "alice");

    expect(await listProfiles(db, "alice")).toHaveLength(0);
    expect(await getKeys(db, "alice")).toBeNull();
    expect(await listProfiles(db, "bob")).toHaveLength(1);
    expect(await getKeys(db, "bob")).not.toBeNull();
  });
});
