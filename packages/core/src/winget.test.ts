import { describe, expect, it } from "vitest";
import { getWingetInstallCommands } from "./winget";

describe("getWingetInstallCommands", () => {
  it("builds a silent winget install per package id", () => {
    expect(getWingetInstallCommands(["Valve.Steam"])).toEqual([
      [
        "winget",
        "install",
        "--id",
        "Valve.Steam",
        "--accept-source-agreements",
        "--accept-package-agreements",
        "--silent",
      ],
    ]);
  });

  it("returns no commands for an empty list", () => {
    expect(getWingetInstallCommands([])).toEqual([]);
  });

  it("preserves order and count", () => {
    const cmds = getWingetInstallCommands(["A", "B", "C"]);
    expect(cmds).toHaveLength(3);
    expect(cmds.map((c) => c[3])).toEqual(["A", "B", "C"]);
  });
});
