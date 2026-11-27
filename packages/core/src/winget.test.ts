import { describe, expect, it } from "vitest";
import {
  generateAppInstallerUpdate,
  generateTwoPassInstall,
  generateWingetSourceRepair,
  getWingetInstallCommands,
} from "./winget";

describe("generateWingetSourceRepair", () => {
  it("registers the winget source package only when it's missing", () => {
    const block = generateWingetSourceRepair("Write-Strip");
    expect(block).toContain("Get-AppxPackage Microsoft.Winget.Source");
    expect(block).toContain("cdn.winget.microsoft.com/cache/source.msix");
    expect(block).toContain("Add-AppxPackage");
    expect(block).toMatch(/if \(-not \(Get-AppxPackage Microsoft\.Winget\.Source/);
    expect(block).toContain("Write-Strip");
  });

  it("never aborts the script when the repair itself fails", () => {
    expect(generateWingetSourceRepair("Write-Bootible")).toMatch(/try \{[\s\S]*\} catch \{/);
  });
});

describe("generateAppInstallerUpdate", () => {
  it("DISM-provisions the latest App Installer for the Store source", () => {
    const block = generateAppInstallerUpdate("Write-Strip");
    expect(block).toContain("aka.ms/getwinget");
    expect(block).toContain("Add-AppxProvisionedPackage");
  });
});

describe("generateTwoPassInstall", () => {
  it("emits an elevated pass + defers admin-rejecting installs to next sign-in", () => {
    const block = generateTwoPassInstall(getWingetInstallCommands(["Spotify.Spotify"]), "$Root");
    expect(block).toContain("Spotify.Spotify");
    expect(block).toContain("$bootRetry"); // collects failures
    expect(block).toContain("RunOnce"); // deferred to next interactive logon
    expect(block).toContain("user-installs.ps1");
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
