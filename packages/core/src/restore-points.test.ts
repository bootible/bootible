import { describe, expect, it } from "vitest";
import { getCheckpointCommand, getEnableRestoreCommands } from "./restore-points";

describe("getEnableRestoreCommands", () => {
  it("enables system restore on the drive", () => {
    const cmds = getEnableRestoreCommands();
    expect(cmds[0]?.join(" ")).toContain("Enable-ComputerRestore");
  });

  it("uncaps the checkpoint frequency so two points can be made minutes apart", () => {
    // Windows throttles System Restore to one point per 1440 min by default;
    // without this the post-config checkpoint is silently skipped.
    const cmds = getEnableRestoreCommands();
    expect(cmds.some((c) => c.includes("SystemRestorePointCreationFrequency"))).toBe(true);
    const freq = cmds.find((c) => c.includes("SystemRestorePointCreationFrequency"));
    expect(freq?.at(-2)).toBe("0");
  });
});

describe("getCheckpointCommand", () => {
  it("builds a Checkpoint-Computer command carrying the description", () => {
    const cmd = getCheckpointCommand("Fresh Windows");
    expect(cmd[0]).toBe("powershell");
    expect(cmd.join(" ")).toContain("Checkpoint-Computer");
    expect(cmd.join(" ")).toContain("Fresh Windows");
    expect(cmd.join(" ")).toContain("MODIFY_SETTINGS");
  });
});
