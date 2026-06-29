import { describe, expect, it } from "vitest";
import { CURRENT_PROFILE_VERSION, deviceFamilyOf, migrateProfile } from "./profile-schema";

const NOW = 1_700_000_000_000;

describe("deviceFamilyOf", () => {
  it("maps device ids to families", () => {
    expect(deviceFamilyOf("rog-ally")).toBe("windows");
    expect(deviceFamilyOf("steamdeck")).toBe("steamos");
    expect(deviceFamilyOf("steam-deck")).toBe("steamos");
    expect(deviceFamilyOf(undefined)).toBe("unknown");
    expect(deviceFamilyOf("something-else")).toBe("unknown");
  });
});

describe("migrateProfile", () => {
  it("rejects non-objects and entries without a name", () => {
    expect(migrateProfile(null, NOW)).toBeNull();
    expect(migrateProfile("nope", NOW)).toBeNull();
    expect(migrateProfile({ ui: {} }, NOW)).toBeNull();
    expect(migrateProfile({ name: "   " }, NOW)).toBeNull();
  });

  it("upgrades a legacy (unversioned) profile to the current schema", () => {
    const p = migrateProfile({ name: "My ROG", deviceId: "rog-ally", ui: { hostname: "x" } }, NOW);
    expect(p).not.toBeNull();
    expect(p?.schemaVersion).toBe(CURRENT_PROFILE_VERSION);
    expect(p?.deviceFamily).toBe("windows");
    expect(p?.id).toBe("My ROG"); // id defaults to name when absent
    expect(p?.ui).toEqual({ hostname: "x" });
  });

  it("back-fills missing sync metadata with safe defaults", () => {
    const p = migrateProfile({ name: "p" }, NOW);
    expect(p?.version).toBe(1);
    expect(p?.lastSyncedVersion).toBeNull();
    expect(p?.updatedAt).toBe(NOW);
    expect(p?.deleted).toBe(false);
    expect(p?.secretsEnc).toBe("");
  });

  it("derives updatedAt from savedAt when present and updatedAt is absent", () => {
    const p = migrateProfile({ name: "p", savedAt: "2023-01-01T00:00:00.000Z" }, NOW);
    expect(p?.updatedAt).toBe(Date.parse("2023-01-01T00:00:00.000Z"));
  });

  it("preserves an already-current profile's fields", () => {
    const existing = {
      schemaVersion: 1,
      id: "abc",
      name: "Deck",
      deviceId: "steamdeck",
      ui: { a: 1 },
      secretsEnc: "enc",
      version: 5,
      lastSyncedVersion: 4,
      updatedAt: 123,
      deleted: false,
    };
    const p = migrateProfile(existing, NOW);
    expect(p).toMatchObject({
      schemaVersion: 1,
      id: "abc",
      name: "Deck",
      deviceFamily: "steamos",
      version: 5,
      lastSyncedVersion: 4,
      updatedAt: 123,
    });
  });
});
