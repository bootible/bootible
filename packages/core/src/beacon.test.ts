import { describe, expect, it } from "vitest";
import { BEACON_PORT, generateBeaconScript } from "./beacon";

describe("generateBeaconScript", () => {
  it("bakes in the buildId and broadcasts on the beacon port", () => {
    const script = generateBeaconScript({ buildId: "abc123def456" });
    expect(script).toContain("$buildId = 'abc123def456'");
    expect(script).toContain(`$port = ${BEACON_PORT}`);
    expect(script).toContain("EnableBroadcast = $true");
    expect(script).toContain("[System.Net.IPAddress]::Broadcast");
  });

  it("reads status from the bootstrap's status file (installing when absent)", () => {
    const script = generateBeaconScript({ buildId: "x" });
    expect(script).toContain("status.txt");
    expect(script).toContain("'installing'");
  });

  it("broadcasts the bootible marker, mac, ip and hostname", () => {
    const script = generateBeaconScript({ buildId: "x" });
    expect(script).toContain("bootible = 1");
    expect(script).toContain("$mac");
    expect(script).toContain("$ip");
    expect(script).toContain("COMPUTERNAME");
  });

  it("honours a custom port and escapes the buildId", () => {
    const script = generateBeaconScript({ buildId: "a'b", port: 40000 });
    expect(script).toContain("$port = 40000");
    expect(script).toContain("$buildId = 'a''b'");
  });

  it("is ASCII-only (PowerShell 5.1 reads it without a BOM)", () => {
    // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional ASCII-range check
    expect(generateBeaconScript({ buildId: "x" })).toMatch(/^[\x00-\x7F]*$/);
  });
});
