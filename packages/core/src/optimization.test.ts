import { describe, expect, it } from "vitest";
import { getServiceTrimCommands } from "./optimization";

describe("getServiceTrimCommands", () => {
  it("sets each service to manual via sc config", () => {
    const cmds = getServiceTrimCommands();
    expect(cmds.length).toBeGreaterThan(0);
    for (const cmd of cmds) {
      expect(cmd[0]).toBe("sc.exe");
      expect(cmd[1]).toBe("config");
      expect(cmd.slice(-2)).toEqual(["start=", "demand"]);
    }
  });

  it("trims the telemetry service DiagTrack", () => {
    expect(getServiceTrimCommands()).toContainEqual([
      "sc.exe",
      "config",
      "DiagTrack",
      "start=",
      "demand",
    ]);
  });
});
