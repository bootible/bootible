import { describe, expect, it } from "vitest";
import type { BootibleModule } from "./modules";
import { groupCatalog } from "./modules";

const noop = () => ({ status: "skipped" as const });

const mods: BootibleModule[] = [
  { id: "power", name: "Power", group: "system", summary: "", apply: noop },
  { id: "display", name: "Display", group: "system", summary: "", apply: noop },
  { id: "trim", name: "Trim", group: "performance", summary: "", apply: noop },
  { id: "steam", name: "Steam", group: "apps", summary: "", apply: noop },
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
      { id: "power", name: "Power" },
      { id: "display", name: "Display" },
    ]);
  });

  it("omits groups that have no modules", () => {
    const groups = groupCatalog(mods);
    expect(groups.some((g) => g.group === "library")).toBe(false);
  });
});
