import { describe, expect, it } from "vitest";
import { generateTwoPassInstall, getWingetInstallCommands } from "./winget";

describe("generateTwoPassInstall", () => {
  it("emits an elevated pass + a de-elevated retry for failures", () => {
    const block = generateTwoPassInstall(getWingetInstallCommands(["Spotify.Spotify"]), "$Root");
    expect(block).toContain("Spotify.Spotify");
    expect(block).toContain("$bootRetry"); // collects failures
    expect(block).toContain("RunLevel Limited"); // de-elevated retry
    expect(block).toContain("LogonType Interactive");
  });
  it("is empty when there's nothing to install", () => {
    expect(generateTwoPassInstall([], "$Root")).toBe("");
  });
});

describe("getWingetInstallCommands", () => {
  it("builds a silent winget install per package id", () => {
    expect(getWingetInstallCommands(["Valve.Steam"])).toEqual([
      [
        "winget",
        "install",
        "--id",
        "Valve.Steam",
        "--source",
        "winget",
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
