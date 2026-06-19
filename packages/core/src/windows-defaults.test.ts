import { describe, expect, it } from "vitest";
import { getWindowsDefaultsCommands } from "./windows-defaults";

describe("getWindowsDefaultsCommands", () => {
  it("builds reg add commands for the curated tweak set", () => {
    const cmds = getWindowsDefaultsCommands();
    expect(cmds.length).toBeGreaterThan(0);
    for (const cmd of cmds) {
      expect(cmd.slice(0, 2)).toEqual(["reg", "add"]);
      expect(cmd).toContain("/f");
    }
  });

  it("disables telemetry via the DataCollection policy", () => {
    expect(getWindowsDefaultsCommands()).toContainEqual([
      "reg",
      "add",
      "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection",
      "/v",
      "AllowTelemetry",
      "/t",
      "REG_DWORD",
      "/d",
      "0",
      "/f",
    ]);
  });

  it("shows file extensions (HideFileExt = 0)", () => {
    const hideFileExt = getWindowsDefaultsCommands().find((c) => c.includes("HideFileExt"));
    expect(hideFileExt).toBeDefined();
    expect(hideFileExt?.at(-2)).toBe("0");
  });
});
