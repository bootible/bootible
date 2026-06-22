import { describe, expect, it } from "vitest";
import { deviceSummary, prettyOs, selectDevice } from "./app-view";
import type { DeviceEntry } from "./registry";

const ally: DeviceEntry = {
  id: "rog-ally",
  name: "ROG Ally / Ally X",
  provisioning_models: ["on-device"],
  os: "windows",
  detect: { manufacturer: "ASUSTeK", models: ["RC71L", "RC72LA"] },
  capabilities: { great: ["nes", "snes", "ps1"], varies: ["switch"] },
};

const deck: DeviceEntry = {
  id: "steamdeck",
  name: "Steam Deck",
  provisioning_models: ["on-device"],
  os: "linux",
};

describe("prettyOs", () => {
  it("maps known os ids to display names", () => {
    expect(prettyOs("windows")).toBe("Windows 11");
    expect(prettyOs("linux")).toBe("Linux");
    expect(prettyOs("steamos")).toBe("SteamOS");
  });

  it("title-cases unknown os ids", () => {
    expect(prettyOs("haiku")).toBe("Haiku");
  });
});

describe("deviceSummary", () => {
  it("projects a registry entry into a renderer view-model", () => {
    expect(deviceSummary(ally)).toEqual({
      id: "rog-ally",
      name: "ROG Ally / Ally X",
      system: "Windows 11",
      provisioning: "on-device",
      emulationCount: 3,
    });
  });

  it("defaults missing os and capabilities", () => {
    expect(deviceSummary(deck)).toEqual({
      id: "steamdeck",
      name: "Steam Deck",
      system: "Linux",
      provisioning: "on-device",
      emulationCount: 0,
    });
  });
});

describe("selectDevice", () => {
  it("matches a device by its hardware whitelist (manufacturer + model)", () => {
    const device = selectDevice([deck, ally], {
      platform: "win32",
      manufacturer: "ASUSTeK COMPUTER INC.",
      model: "RC72LA",
    });
    expect(device?.id).toBe("rog-ally");
  });

  it("hard-blocks: returns null on hardware that is not whitelisted", () => {
    expect(
      selectDevice([deck, ally], {
        platform: "win32",
        manufacturer: "Gigabyte Technology Co., Ltd.",
        model: "X870E AORUS ELITE WIFI7",
      }),
    ).toBeNull();
  });

  it("returns null for entries without a detect whitelist", () => {
    expect(selectDevice([deck], { platform: "linux", model: "Jupiter" })).toBeNull();
  });
});
