import { describe, expect, it } from "vitest";
import { groupProfilesForDevice } from "./profiles";

const list = [
  { name: "rog", deviceId: "rog-ally" },
  { name: "ally-x", deviceId: "rog-ally-x" }, // same family (windows), different model
  { name: "deck", deviceId: "steamdeck" },
  { name: "shared", deviceId: undefined }, // untagged — applies anywhere
];

describe("groupProfilesForDevice", () => {
  it("splits into this-model and same-family (incl. untagged), hiding other families", () => {
    const g = groupProfilesForDevice(list, "rog-ally");
    expect(g.model.map((p) => p.name)).toEqual(["rog"]); // exact model
    expect(g.family.map((p) => p.name)).toEqual(["ally-x", "shared"]); // windows + untagged
    // deck (steamos) is not visible for a windows device — in neither group
  });

  it("puts everything in the model group when no device is selected (never hide)", () => {
    const g = groupProfilesForDevice(list, "");
    expect(g.model.map((p) => p.name)).toEqual(["rog", "ally-x", "deck", "shared"]);
    expect(g.family).toEqual([]);
  });
});
