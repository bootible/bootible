import { describe, expect, it } from "vitest";
import { sshReachable, verifyProbe } from "./verify-probe";

describe("verifyProbe", () => {
  it("never calls `hostname` on Linux — SteamOS doesn't ship it (exit 127 on a real Deck)", () => {
    expect(verifyProbe("linux")).not.toContain("hostname");
    expect(verifyProbe("linux")).toContain("uname -n");
    expect(verifyProbe("linux")).toContain("~/.bootible/receipt");
  });

  it("reads the Windows bootstrap status + receipt", () => {
    expect(verifyProbe("windows")).toContain("C:\\bootible\\receipt.txt");
  });
});

describe("sshReachable", () => {
  it("treats ssh's own failure code (255) as unreachable", () => {
    expect(sshReachable(255)).toBe(false);
  });

  it("treats any remote exit code as reachable — we connected", () => {
    expect(sshReachable(0)).toBe(true);
    expect(sshReachable(1)).toBe(true);
    expect(sshReachable(127)).toBe(true);
  });

  it("treats no exit status (timeout / spawn failure) as unreachable", () => {
    expect(sshReachable(null)).toBe(false);
    expect(sshReachable(undefined)).toBe(false);
  });
});
