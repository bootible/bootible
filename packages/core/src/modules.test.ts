import { describe, expect, it } from "vitest";
import type { BootibleModule } from "./modules";
import { checkModules, groupCatalog, selectModules } from "./modules";
import type { ApplyContext } from "./orchestrator";

const noop = () => ({ status: "skipped" as const });

const mods: BootibleModule[] = [
  { id: "power", name: "Power", group: "system", description: "", apply: noop },
  { id: "display", name: "Display", group: "system", description: "", apply: noop },
  { id: "trim", name: "Trim", group: "performance", description: "", apply: noop },
  { id: "steam", name: "Steam", group: "apps", description: "", apply: noop },
];

describe("groupCatalog", () => {
  it("groups modules in canonical group order with labels and counts", () => {
    const groups = groupCatalog(mods);
    expect(groups.map((g) => g.group)).toEqual(["system", "performance", "apps"]);
    expect(groups[0]).toMatchObject({
      group: "system",
      label: "System essentials",
      moduleCount: 2,
    });
    expect(groups[0]?.modules).toEqual([
      { id: "power", name: "Power", description: "", changes: undefined, planned: false },
      { id: "display", name: "Display", description: "", changes: undefined, planned: false },
    ]);
  });

  it("omits groups that have no modules", () => {
    const groups = groupCatalog(mods);
    expect(groups.some((g) => g.group === "library")).toBe(false);
  });
});

describe("checkModules", () => {
  const ctx: ApplyContext = {
    device: { id: "x", name: "X", provisioning_models: ["on-device"] },
    config: { schema: 2, device: "x" },
  };

  it("reports each module's probed state; no check or a throw → unknown", () => {
    const probed: BootibleModule[] = [
      { id: "a", name: "A", group: "system", description: "", apply: noop, check: () => "applied" },
      {
        id: "b",
        name: "B",
        group: "system",
        description: "",
        apply: noop,
        check: () => {
          throw new Error("probe failed");
        },
      },
      { id: "c", name: "C", group: "apps", description: "", apply: noop },
    ];
    const report = checkModules(probed, ctx, () => "");
    expect(report.map((r) => r.state)).toEqual(["applied", "unknown", "unknown"]);
    expect(report[0]).toMatchObject({ id: "a", group: "system" });
  });
});

describe("selectModules", () => {
  it("returns everything when no ids are given", () => {
    expect(selectModules(mods)).toHaveLength(mods.length);
  });

  it("keeps only the selected module ids", () => {
    const picked = selectModules(mods, ["power", "steam"]);
    expect(picked.map((m) => m.id)).toEqual(["power", "steam"]);
  });

  it("returns nothing for an empty selection", () => {
    expect(selectModules(mods, [])).toEqual([]);
  });
});
