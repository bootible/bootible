import { describe, expect, it } from "vitest";
import { generateStripScript } from "./strip";

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

describe("generateStripScript", () => {
  const script = generateStripScript(config);

  it("requires elevation and takes a restore point first", () => {
    expect(script).toContain("IsInRole");
    expect(script).toContain("Checkpoint-Computer");
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

  it("strips trialware but guards the ROG essentials", () => {
    expect(script).toContain("McAfee");
    expect(script).toContain("Live Update");
    // keep-guard must protect Armoury Crate / System Control / MyASUS / Dolby
    expect(script).toContain("Armoury Crate");
    expect(script).toContain("MyASUS");
    expect(script).toContain("Dolby");
  });
});
