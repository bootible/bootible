import { describe, expect, it } from "vitest";
import { profilesForDevice } from "./profiles";

const list = [
  { name: "rog", deviceId: "rog-ally" },
  { name: "deck", deviceId: "steamdeck" },
  { name: "untagged", deviceId: undefined },
];

describe("profilesForDevice", () => {
  it("shows everything when no device is selected (unknown context — never hide)", () => {
    expect(profilesForDevice(list, "").map((p) => p.name)).toEqual(["rog", "deck", "untagged"]);
  });

  it("shows untagged + this-device profiles when a device is selected", () => {
    expect(profilesForDevice(list, "rog-ally").map((p) => p.name)).toEqual(["rog", "untagged"]);
  });
});
