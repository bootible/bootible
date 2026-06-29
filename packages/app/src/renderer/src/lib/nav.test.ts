import { describe, expect, it } from "vitest";
import { needsDevicePick } from "./nav";

describe("needsDevicePick", () => {
  it("redirects device-dependent screens reached without a selected device", () => {
    for (const v of ["home", "base", "customise", "deck", "decksetup"]) {
      expect(needsDevicePick(v, "")).toBe(true);
    }
  });

  it("allows them once a device is selected", () => {
    expect(needsDevicePick("customise", "rog-ally")).toBe(false);
    expect(needsDevicePick("deck", "steamdeck")).toBe(false);
  });

  it("never redirects device-independent screens", () => {
    for (const v of ["welcome", "platform", "devices", "done"]) {
      expect(needsDevicePick(v, "")).toBe(false);
    }
  });
});
