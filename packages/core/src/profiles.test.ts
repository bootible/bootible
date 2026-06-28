import { describe, expect, it } from "vitest";
import { allyBundles, allyCatalog } from "./ally-modules";
import { bundleModules } from "./bundles";
import { deviceProfile, usesDeckCarrier } from "./profiles";

describe("deviceProfile", () => {
  it("resolves the Ally profile with catalog, bundles and executor", () => {
    const profile = deviceProfile("rog-ally");
    expect(profile).not.toBeNull();
    expect(profile?.catalog).toBe(allyCatalog);
    expect(profile?.bundles).toBe(allyBundles);
    expect(typeof profile?.executor).toBe("function");
  });

  it("returns null for an unknown device", () => {
    expect(deviceProfile("nintendo-switch")).toBeNull();
  });
});

describe("usesDeckCarrier", () => {
  it("is true for SteamOS (the host-carrier flow)", () => {
    expect(usesDeckCarrier("steamos")).toBe(true);
  });

  it("is false for Windows and other OSes", () => {
    expect(usesDeckCarrier("windows")).toBe(false);
    expect(usesDeckCarrier("linux")).toBe(false);
  });
});

describe("allyBundles", () => {
  it("has a single recommended bundle", () => {
    expect(allyBundles.filter((b) => b.recommended)).toHaveLength(1);
  });

  it("only references real (non-planned) modules", () => {
    const planned = new Set(allyCatalog.filter((m) => m.planned).map((m) => m.id));
    for (const bundle of allyBundles) {
      for (const id of bundle.moduleIds) {
        expect(planned.has(id), `${bundle.id} → ${id} must not be planned`).toBe(false);
      }
    }
  });

  it("references only ids that exist in the catalog", () => {
    const ids = new Set(allyCatalog.map((m) => m.id));
    for (const bundle of allyBundles) {
      for (const id of bundle.moduleIds) {
        expect(ids.has(id), `${bundle.id} → ${id} must exist`).toBe(true);
      }
    }
  });
});

describe("bundleModules", () => {
  it("resolves ids to catalog modules in catalog order", () => {
    const full = allyBundles.find((b) => b.id === "full");
    if (!full) throw new Error("full bundle missing");
    const resolved = bundleModules(full, allyCatalog).map((m) => m.id);
    expect(resolved).toEqual([
      "power",
      "display",
      "windows-defaults",
      "optimization",
      "utilities",
      "steam",
    ]);
  });
});
