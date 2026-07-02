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
  it("runs the strip elevated, then user-scope installs in the non-elevated session", () => {
    const bat = generateStripLauncher();
    expect(bat).toContain("@echo off");
    expect(bat).toContain("-Verb RunAs"); // strip runs elevated
    // Poll for the strip.done marker rather than -Verb RunAs -Wait, which doesn't
    // reliably wait across the UAC boundary (raced the user-scope step on real HW).
    expect(bat).toContain("strip.done");
    expect(bat).toContain(":bootible_wait"); // the wait-for-completion poll loop
    expect(bat).toContain("bootible.ps1"); // aligned name
    expect(bat).toContain("bootible*.ps1"); // wildcard fallback
    expect(bat).toContain("user-installs.ps1"); // user-scope step in THIS session
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

  it("stages wallpaper/lock screen into the user's Pictures (not C:\\bootible)", () => {
    expect(script).toContain("wallpapers\\$($img[0]).*"); // globs the staged images
    expect(script).toContain("$env:USERPROFILE\\Pictures"); // copies them there
    expect(script).toContain("PersonalizationCSP"); // and points Windows at them
  });

  it("beacons on the LAN at the end so the desktop can discover it (no IP needed)", () => {
    expect(script).toContain("status = 'done'");
    expect(script).toContain("EnableBroadcast");
    expect(script).toContain("beacon.ps1");
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
    expect(withApps).not.toContain("aka.ms/getwinget"); // no Store update without msstore apps
  });

  it("updates App Installer first only when a Store app is picked", () => {
    const withStore = generateStripScript({
      schema: 2,
      device: "rog-ally",
      modules: ["apps"],
      settings: { sleep_mode: "hibernate", selected_apps: ["chatgpt"] },
    });
    expect(withStore).toContain("aka.ms/getwinget"); // chatgpt is msstore → update first
  });

  it("applies the floor (incl. Copilot removal + Recall off)", () => {
    expect(script).toContain("powercfg"); // power floor
    expect(script).toContain("HwSchMode"); // display floor
    expect(script).toContain("DisableAIDataAnalysis"); // Recall off
    expect(script).toContain("Copilot"); // Copilot removal from windows-defaults
  });

  it("offers GitHub-key SSH (prompt + fetch + OpenSSH setup) for the standalone strip", () => {
    expect(script).toContain("GitHub username");
    expect(script).toContain("github.com/$ghUser.keys");
    expect(script).toContain("Microsoft.OpenSSH.Preview");
    expect(script).toContain("administrators_authorized_keys");
  });

  it("skips the runtime GitHub prompt when the app already baked SSH keys", () => {
    const baked = generateStripScript({
      schema: 2,
      device: "rog-ally",
      modules: ["ssh-key"],
      settings: { sleep_mode: "hibernate", ssh_public_keys: ["ssh-ed25519 AAAA... me"] },
    });
    expect(baked).not.toContain("Read-Host 'GitHub username");
    expect(baked).toContain("SSH keys are baked in"); // the no-prompt note
  });

  it("strips the recommended set by default + ASUS GlideX, guards the essentials", () => {
    expect(script).toContain("McAfee");
    expect(script).toContain("*Glidex*"); // the real factory-image catch
    expect(script).not.toContain("Microsoft.YourPhone"); // Phone Link not recommended → kept
    // keep-guard protects Armoury Crate / MyASUS / Dolby AND Xbox (gaming handheld)
    expect(script).toContain("Armoury Crate");
    expect(script).toContain("MyASUS");
    expect(script).toContain("Dolby");
    expect(script).toContain("Xbox");
  });

  it("strips only the opted-in removals when the config selects them", () => {
    const picked = generateStripScript({
      schema: 2,
      device: "rog-ally",
      settings: { sleep_mode: "hibernate", strip_removals: ["glidex", "phone-link"] },
    });
    expect(picked).toContain("*Glidex*"); // opted in
    expect(picked).toContain("Microsoft.YourPhone"); // opted in this time
    expect(picked).not.toContain("MSTeams"); // not selected → kept
  });
});
