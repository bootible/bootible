import { describe, expect, it } from "vitest";
import { allyExecutor } from "./ally-executor";
import { buildUsbBundle, type UsbBuildSpec } from "./bundle";
import type { DeviceEntry } from "./registry";

const device: DeviceEntry = {
  id: "rog-ally",
  name: "ROG Ally",
  provisioning_models: ["on-device"],
};

const base: UsbBuildSpec = {
  device,
  config: { schema: 2, device: "rog-ally", groups: ["system"] },
  account: { mode: "local", username: "gavin", password: "pw" },
};

describe("buildUsbBundle", () => {
  it("includes autounattend.xml at the USB root", () => {
    const auto = buildUsbBundle(base, allyExecutor).find((f) => f.path === "autounattend.xml");
    expect(auto).toBeDefined();
    expect(auto?.content).toContain("<unattend");
  });

  it("stages bootstrap.ps1 where the autounattend first-logon command expects it", () => {
    const files = buildUsbBundle(base, allyExecutor);
    const boot = files.find((f) => f.path.endsWith("bootible/bootstrap.ps1"));
    expect(boot?.path).toContain("$OEM$/$1/bootible");
    expect(boot?.content).toContain("Checkpoint-Computer");
    // the autounattend points at the on-device path the $OEM$/$1 staging yields
    const auto = files.find((f) => f.path === "autounattend.xml");
    expect(auto?.content).toContain("C:\\bootible\\bootstrap.ps1");
  });

  it("stages the reusable config.yml alongside the bootstrap", () => {
    const cfg = buildUsbBundle(base, allyExecutor).find((f) =>
      f.path.endsWith("bootible/config.yml"),
    );
    expect(cfg?.content).toContain("device: rog-ally");
  });

  it("stages a wifi profile only when wifi is given, where netsh expects it", () => {
    const withWifi = buildUsbBundle(
      { ...base, wifi: { ssid: "Net", password: "pw" } },
      allyExecutor,
    );
    expect(withWifi.some((f) => f.path.endsWith("Setup/Files/wifi.xml"))).toBe(true);
    expect(buildUsbBundle(base, allyExecutor).some((f) => f.path.endsWith("wifi.xml"))).toBe(false);
  });

  it("includes a README", () => {
    expect(
      buildUsbBundle(base, allyExecutor).some((f) => f.path.toLowerCase().includes("readme")),
    ).toBe(true);
  });

  it("bakes the chosen UI language + region into the answer file (so it matches the ISO)", () => {
    const auto = buildUsbBundle(
      { ...base, uiLanguage: "en-US", locale: "en-AU" },
      allyExecutor,
    ).find((f) => f.path === "autounattend.xml");
    expect(auto?.content).toContain(
      "<SetupUILanguage><UILanguage>en-US</UILanguage></SetupUILanguage>",
    );
    expect(auto?.content).toContain("<UserLocale>en-AU</UserLocale>");
    expect(auto?.content).not.toContain("en-GB");
  });
});
