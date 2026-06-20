import { describe, expect, it } from "vitest";
import { provisioningMethods } from "./provisioning";
import type { DeviceEntry } from "./registry";

const ally: DeviceEntry = {
  id: "rog-ally",
  name: "ROG Ally",
  provisioning_models: ["host-media-prep", "on-device"],
};

const androidDevice: DeviceEntry = {
  id: "odin",
  name: "Retroid",
  provisioning_models: ["android-host"],
};

describe("provisioningMethods", () => {
  it("derives methods from the device's provisioning_models, in order", () => {
    expect(provisioningMethods(ally).map((m) => m.id)).toEqual(["usb", "device", "export"]);
  });

  it("adapts to other device types (android-host → ADB push)", () => {
    expect(provisioningMethods(androidDevice).map((m) => m.id)).toEqual(["android", "export"]);
  });

  it("always offers export, even for a device with no provisioning models", () => {
    const bare: DeviceEntry = { id: "x", name: "X", provisioning_models: [] };
    expect(provisioningMethods(bare).map((m) => m.id)).toEqual(["export"]);
  });

  it("carries label/description/tag for each method", () => {
    const usb = provisioningMethods(ally).find((m) => m.id === "usb");
    expect(usb?.label).toBeTruthy();
    expect(usb?.description).toBeTruthy();
    expect(usb?.tag).toBeTruthy();
  });
});
