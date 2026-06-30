import { describe, expect, it } from "vitest";
import {
  CURRENT_PROFILE_VERSION,
  deviceFamilyOf,
  groupProfilesForDevice,
  migrateProfile,
  visibleProfiles,
} from "./profile-schema";

describe("visibleProfiles", () => {
  const profiles = [
    { name: "rog", deviceModel: "rog-ally" },
    { name: "deck", deviceModel: "steamdeck" },
    { name: "legacy", deviceModel: undefined }, // untagged / unknown family
  ];

  it("shows a device its own family's profiles plus untagged, hiding other families", () => {
    expect(visibleProfiles(profiles, "rog-ally").map((p) => p.name)).toEqual(["rog", "legacy"]);
    expect(visibleProfiles(profiles, "steamdeck").map((p) => p.name)).toEqual(["deck", "legacy"]);
  });

  it("matches by family, not exact id (a windows profile shows on any windows device)", () => {
    expect(
      visibleProfiles([{ name: "a", deviceModel: "rog-ally" }], "rog-ally-x").map((p) => p.name),
    ).toEqual(["a"]);
  });
});

describe("groupProfilesForDevice", () => {
  const list = [
    { name: "rog", deviceModel: "rog-ally" },
    { name: "ally-x", deviceModel: "rog-ally-x" }, // same family (windows), different model
    { name: "deck", deviceModel: "steamdeck" },
    { name: "shared", deviceModel: undefined }, // untagged — applies anywhere
  ];

  it("splits into this-model and same-family (incl. untagged), hiding other families", () => {
    const g = groupProfilesForDevice(list, "rog-ally");
    expect(g.model.map((p) => p.name)).toEqual(["rog"]); // exact model
    expect(g.family.map((p) => p.name)).toEqual(["ally-x", "shared"]); // windows + untagged
  });

  it("puts everything in the model group when no device is selected (never hide)", () => {
    const g = groupProfilesForDevice(list, "");
    expect(g.model.map((p) => p.name)).toEqual(["rog", "ally-x", "deck", "shared"]);
    expect(g.family).toEqual([]);
  });
});

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

  it("upgrades a legacy (unversioned) profile, mapping the old deviceId → deviceModel", () => {
    const p = migrateProfile({ name: "My ROG", deviceId: "rog-ally", ui: { hostname: "x" } }, NOW);
    expect(p).not.toBeNull();
    expect(p?.schemaVersion).toBe(CURRENT_PROFILE_VERSION);
    expect(p?.deviceModel).toBe("rog-ally"); // back-compat: old `deviceId` carried the model
    expect(p?.deviceFamily).toBe("windows");
    expect(p?.id).toBe("My ROG"); // id defaults to name when absent
    expect(p?.ui).toEqual({ hostname: "x" });
  });

  it("carries an optional instanceId through migration", () => {
    expect(migrateProfile({ name: "p", instanceId: "VengeanceX" }, NOW)?.instanceId).toBe(
      "VengeanceX",
    );
    expect(migrateProfile({ name: "p" }, NOW)?.instanceId).toBeUndefined();
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
      deviceModel: "steamdeck",
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
