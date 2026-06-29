import { describe, expect, it } from "vitest";
import { capabilitiesFor, devicesWithCapabilities } from "./device-capabilities";

describe("capabilitiesFor", () => {
  it("describes the ROG/Windows device (infers network from the host)", () => {
    const c = capabilitiesFor("rog-ally");
    expect(c).toMatchObject({
      family: "windows",
      apps: true,
      ssh: true,
      streaming: true,
      network: { staticIp: true, interfaces: ["wifi", "ethernet"], inferFromHost: true },
    });
    expect(c?.media).toContain("usb-install");
  });

  it("describes the Steam Deck (no host inference; provision + reimage media)", () => {
    const c = capabilitiesFor("steamdeck");
    expect(c).toMatchObject({
      family: "steamos",
      network: { staticIp: true, interfaces: ["wifi", "ethernet"], inferFromHost: false },
    });
    expect(c?.media).toEqual(expect.arrayContaining(["provision", "reimage"]));
  });

  it("returns undefined for an unknown device", () => {
    expect(capabilitiesFor("nintendo-switch")).toBeUndefined();
    expect(capabilitiesFor(undefined)).toBeUndefined();
  });
});

describe("devicesWithCapabilities", () => {
  it("lists every registered device id", () => {
    const ids = devicesWithCapabilities();
    expect(ids).toContain("rog-ally");
    expect(ids).toContain("steamdeck");
  });
});
