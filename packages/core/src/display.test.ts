import { describe, expect, it } from "vitest";
import { getDisplayTweakCommands } from "./display";

describe("getDisplayTweakCommands", () => {
  it("builds reg add commands", () => {
    const cmds = getDisplayTweakCommands();
    expect(cmds.length).toBeGreaterThan(0);
    for (const cmd of cmds) {
      expect(cmd.slice(0, 2)).toEqual(["reg", "add"]);
      expect(cmd).toContain("/f");
    }
  });

  it("enables hardware GPU scheduling (HwSchMode = 2)", () => {
    expect(getDisplayTweakCommands()).toContainEqual([
      "reg",
      "add",
      "HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers",
      "/v",
      "HwSchMode",
      "/t",
      "REG_DWORD",
      "/d",
      "2",
      "/f",
    ]);
  });

  it("disables AMD Vari-Bright on both AC and DC", () => {
    const cmds = getDisplayTweakCommands();
    expect(cmds.some((c) => c.includes("PP_VariBrightDefaultOnAC"))).toBe(true);
    expect(cmds.some((c) => c.includes("PP_VariBrightDefaultOnDC"))).toBe(true);
  });
});
