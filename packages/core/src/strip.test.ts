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
  it("is a self-elevating .bat that runs the sibling hyphen-free striprog.ps1", () => {
    const bat = generateStripLauncher();
    expect(bat).toContain("@echo off");
    expect(bat).toContain("net session"); // admin check
    expect(bat).toContain("-Verb RunAs"); // self-elevation
    expect(bat).toContain("-ExecutionPolicy Bypass");
    expect(bat).toContain("striprog.ps1"); // hyphen-free so macOS won't mangle it
    expect(bat).toContain("*strip*.ps1"); // wildcard fallback
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

  it("installs the user's picked apps when the config carries modules", () => {
    const withApps = generateStripScript({
      schema: 2,
      device: "rog-ally",
      modules: ["power", "apps"],
      settings: { sleep_mode: "hibernate", selected_apps: ["vlc"] },
    });
    expect(withApps).toContain("VideoLAN.VLC"); // the app-picker install
    expect(withApps).toContain("powercfg"); // floor still runs
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

  it("strips trialware + ASUS GlideX (an Appx) but guards the ROG + Xbox essentials", () => {
    expect(script).toContain("McAfee");
    expect(script).toContain("Live Update");
    expect(script).toContain("*Glidex*"); // the real factory-image catch
    // keep-guard protects Armoury Crate / MyASUS / Dolby AND Xbox (gaming handheld)
    expect(script).toContain("Armoury Crate");
    expect(script).toContain("MyASUS");
    expect(script).toContain("Dolby");
    expect(script).toContain("Xbox");
  });
});
