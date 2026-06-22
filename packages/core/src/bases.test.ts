import { describe, expect, it } from "vitest";
import { allyCatalog } from "./ally-modules";
import { BASES, type Base, baseById, baseModuleIds, UNIVERSAL_FLOOR } from "./bases";

describe("base catalog", () => {
  it("offers the four bases in order", () => {
    expect(BASES.map((b) => b.id)).toEqual(["raw", "steam-bp", "xbox", "full-rog"]);
  });

  it("marks exactly one base recommended", () => {
    expect(BASES.filter((b) => b.recommended).map((b) => b.id)).toEqual(["xbox"]);
  });

  it("resolves a base to its floor + software + shell, de-duped", () => {
    const xbox = baseById("xbox");
    expect(xbox).toBeDefined();
    const ids = baseModuleIds(xbox as Base);
    for (const floor of UNIVERSAL_FLOOR) expect(ids).toContain(floor);
    expect(ids).toContain("xbox-fullscreen");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("raw base is just the tuned floor (no shell, no extra software)", () => {
    expect(baseModuleIds(baseById("raw") as Base)).toEqual(UNIVERSAL_FLOOR);
  });

  it("steam base pre-installs Steam and boots Big Picture", () => {
    const ids = baseModuleIds(baseById("steam-bp") as Base);
    expect(ids).toContain("steam");
    expect(ids).toContain("steam-bigpicture");
  });

  it("full-rog base includes Armoury Crate + the Xbox shell", () => {
    const ids = baseModuleIds(baseById("full-rog") as Base);
    expect(ids).toContain("armoury-crate");
    expect(ids).toContain("xbox-fullscreen");
  });

  it("every base's resolved modules exist in the catalog", () => {
    const known = new Set(allyCatalog.map((m) => m.id));
    for (const base of BASES) {
      for (const id of baseModuleIds(base)) {
        expect(known.has(id), `base ${base.id} references unknown module ${id}`).toBe(true);
      }
    }
  });
});
