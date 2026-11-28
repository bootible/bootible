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

  it("stages the beacon agent only when a buildId is given", () => {
    const without = buildUsbBundle(base, allyExecutor);
    expect(without.some((f) => f.path.endsWith("beacon.ps1"))).toBe(false);
    const withId = buildUsbBundle({ ...base, buildId: "abc123" }, allyExecutor);
    const beacon = withId.find((f) => f.path.endsWith("beacon.ps1"));
    expect(beacon?.path).toContain("$OEM$/$1/bootible");
    expect(beacon?.content).toContain("abc123");
  });

  it("installs the edition the user picked", () => {
    const auto = buildUsbBundle({ ...base, edition: "Windows 11 Pro" }, allyExecutor).find(
      (f) => f.path === "autounattend.xml",
    );
    expect(auto?.content).toContain("<Value>Windows 11 Pro</Value>");
    expect(auto?.content).not.toContain("Windows 11 Home");
  });

  describe("a Sunshine password", () => {
    const secret = "hunter2'x";
    const files = buildUsbBundle(
      {
        ...base,
        config: {
          ...base.config,
          modules: ["sunshine-creds"],
          settings: { sunshine_user: "me", sunshine_pass: secret },
        },
      },
      allyExecutor,
    );
    const file = (end: string) => files.find((f) => f.path.endsWith(end))?.content ?? "";

    it("is left out of the config.yml kept on the device", () => {
      expect(file("bootible/config.yml")).toContain("sunshine_user: me");
      expect(file("bootible/config.yml")).not.toContain("hunter2");
    });

    it("is used to set the login but never written to bootstrap.log", () => {
      const boot = file("bootible/bootstrap.ps1");
      expect(boot).toContain("'--creds' 'me' 'hunter2''x'");
      const logged = boot.split("\n").filter((l) => l.startsWith("Write-Bootible"));
      expect(logged.some((l) => l.includes("--creds"))).toBe(true);
      expect(logged.join("\n")).not.toContain("hunter2");
    });

    it("is removed from the device with bootstrap.ps1 once the run ends", () => {
      const boot = file("bootible/bootstrap.ps1");
      const remove = boot.indexOf("Remove-Item -LiteralPath $PSCommandPath");
      expect(remove).toBeGreaterThan(boot.indexOf("bootible onboard complete"));
    });

    it("leaves bootstrap.ps1 in place when there is no secret", () => {
      const plain = buildUsbBundle(base, allyExecutor).find((f) =>
        f.path.endsWith("bootstrap.ps1"),
      );
      expect(plain?.content).not.toContain("$PSCommandPath");
    });
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
