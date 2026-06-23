import { describe, expect, it } from "vitest";
import { getPowerConfigCommands } from "./power";

describe("getPowerConfigCommands (ported from v1 power-helpers.ps1)", () => {
  it("returns no commands for default mode", () => {
    expect(getPowerConfigCommands({})).toEqual([]);
  });

  it("never sleeps or hibernates on AC, and disables unattended sleep", () => {
    const cmds = getPowerConfigCommands({ sleepMode: "hibernate" });
    expect(cmds).toContainEqual(["/hibernate", "on"]);
    expect(cmds).toContainEqual(["/change", "standby-timeout-ac", "0"]);
    expect(cmds).toContainEqual(["/change", "hibernate-timeout-ac", "0"]);
    expect(cmds).toContainEqual(["/change", "standby-timeout-dc", "0"]);
    expect(cmds).toContainEqual([
      "/setacvalueindex",
      "SCHEME_CURRENT",
      "SUB_SLEEP",
      "UNATTENDSLEEP",
      "0",
    ]);
    expect(cmds).toContainEqual(["/setactive", "SCHEME_CURRENT"]);
  });

  it("hibernates on battery only (DC) after the idle time — never on AC", () => {
    const cmds = getPowerConfigCommands({ sleepMode: "hibernate", hibernateAfterMinutes: 30 });
    expect(cmds).toContainEqual(["/change", "hibernate-timeout-dc", "30"]);
    // AC stays at 0 (never), so plugged-in downloads aren't interrupted
    expect(cmds).toContainEqual(["/change", "hibernate-timeout-ac", "0"]);
    expect(cmds).not.toContainEqual(["/change", "hibernate-timeout-ac", "30"]);
  });

  it("maps the power-button action and activates the scheme", () => {
    const cmds = getPowerConfigCommands({ powerButtonAction: "hibernate" });
    expect(cmds).toContainEqual([
      "/setacvalueindex",
      "SCHEME_CURRENT",
      "SUB_BUTTONS",
      "PBUTTONACTION",
      "2",
    ]);
    expect(cmds).toContainEqual(["/setactive", "SCHEME_CURRENT"]);
  });

  it("disables CPU boost on battery (DC only) and activates", () => {
    const cmds = getPowerConfigCommands({ disableCpuBoostOnBattery: true });
    expect(cmds).toContainEqual([
      "/setdcvalueindex",
      "SCHEME_CURRENT",
      "SUB_PROCESSOR",
      "PERFBOOSTMODE",
      "0",
    ]);
    expect(cmds).toContainEqual(["/setactive", "SCHEME_CURRENT"]);
  });
});
