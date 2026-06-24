import { describe, expect, it } from "vitest";
import { generateStripLauncher, generateStripScript } from "./strip";

const config = {
  schema: 2 as const,
  device: "rog-ally",
  settings: {
    sleep_mode: "hibernate",
    hibernate_after_minutes: 30,
    power_button_action: "sleep",
    disable_cpu_boost_on_battery: true,
  },
};

describe("generateStripLauncher", () => {
  it("is a .bat that runs the sibling strip-rog.ps1 with bypass", () => {
    const bat = generateStripLauncher();
    expect(bat).toContain("@echo off");
    expect(bat).toContain("-ExecutionPolicy Bypass");
    expect(bat).toContain('"%~dp0strip-rog.ps1"');
    expect(bat).toContain("\r\n"); // Windows line endings for a .bat
  });
});

describe("generateStripScript", () => {
  const script = generateStripScript(config);

  it("self-elevates (UAC), pauses at the end, and takes a restore point", () => {
    expect(script).toContain("IsInRole");
    expect(script).toContain("-Verb RunAs"); // self-elevation relaunch
    expect(script).toContain("Checkpoint-Computer");
    expect(script).toContain("Press Enter to close"); // window stays open on error
  });

  it("writes a full inventory before stripping anything", () => {
    expect(script).toContain("inventory-appx.txt");
    expect(script).toContain("inventory-win32.txt");
  });

  it("applies the floor (incl. Copilot removal + Recall off)", () => {
    expect(script).toContain("powercfg"); // power floor
    expect(script).toContain("HwSchMode"); // display floor
    expect(script).toContain("DisableAIDataAnalysis"); // Recall off
    expect(script).toContain("Copilot"); // Copilot removal from windows-defaults
  });

  it("offers GitHub-key SSH (prompt + fetch + OpenSSH setup)", () => {
    expect(script).toContain("GitHub username");
    expect(script).toContain("github.com/$ghUser.keys");
    expect(script).toContain("Microsoft.OpenSSH.Preview");
    expect(script).toContain("administrators_authorized_keys");
  });

  it("strips trialware but guards the ROG essentials", () => {
    expect(script).toContain("McAfee");
    expect(script).toContain("Live Update");
    // keep-guard must protect Armoury Crate / System Control / MyASUS / Dolby
    expect(script).toContain("Armoury Crate");
    expect(script).toContain("MyASUS");
    expect(script).toContain("Dolby");
  });
});
