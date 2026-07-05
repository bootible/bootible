import { describe, expect, it } from "vitest";
import { BEACON_PORT, generateBeaconScript, parseBeacon } from "./beacon";

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

describe("parseBeacon", () => {
  const donePayload = (buildId: string) =>
    JSON.stringify({
      bootible: 1,
      buildId,
      mac: "aa:bb:cc:dd:ee:ff",
      ip: "172.30.90.13",
      hostname: "ti-bazzite",
      username: "test-infra",
      status: "done",
    });

  it("parses a done beacon and flags mine when the buildId matches", () => {
    const d = parseBeacon(Buffer.from(donePayload("abc123")), "abc123");
    expect(d).toEqual({
      buildId: "abc123",
      mac: "aa:bb:cc:dd:ee:ff",
      ip: "172.30.90.13",
      hostname: "ti-bazzite",
      username: "test-infra",
      status: "done",
      mine: true,
    });
  });

  it("flags mine false when the buildId doesn't match", () => {
    const d = parseBeacon(Buffer.from(donePayload("someone-elses-build")), "abc123");
    expect(d?.mine).toBe(false);
  });

  it("returns null for non-JSON traffic", () => {
    expect(parseBeacon(Buffer.from("not json at all"), "abc123")).toBeNull();
  });

  it("returns null for JSON that lacks the bootible marker", () => {
    expect(parseBeacon(Buffer.from(JSON.stringify({ hello: "world" })), "abc123")).toBeNull();
  });

  it("returns null when the bootible marker isn't exactly 1", () => {
    expect(
      parseBeacon(Buffer.from(JSON.stringify({ bootible: 2, buildId: "abc123" })), "abc123"),
    ).toBeNull();
  });
});
