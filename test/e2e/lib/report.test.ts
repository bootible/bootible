import { describe, it, expect } from "vitest";
import { renderReport, exitCode } from "./report.mts";

const results = [
  { id: "deck:minimal", vm: "bazzite", tier: "auto" as const, pass: true, failures: [] },
  { id: "deck:tailscale", vm: "bazzite", tier: "auto" as const, pass: false, failures: ["tailscale not on PATH"] },
  { id: "usb:msa", vm: "win11", tier: "semi" as const, pass: true, failures: [], skipped: "manual OOBE" },
  { id: "usb:usb-write", vm: "win11", tier: "manual" as const, pass: false, failures: ["real stick"], skipped: "manual" },
];

describe("reporter", () => {
  it("exits non-zero when any case failed", () => {
    expect(exitCode(results)).toBe(1);
    expect(exitCode(results.filter(r => r.pass))).toBe(0);
  });
  it("never lets a skipped case push the exit code to 1 on its own", () => {
    // deck:tailscale (not skipped, failing) still forces a non-zero exit...
    expect(exitCode(results)).toBe(1);
    // ...but with that case removed, the remaining skipped+failing case
    // (usb:usb-write) must NOT trip the exit code by itself.
    expect(exitCode(results.filter(r => r.id !== "deck:tailscale"))).toBe(0);
  });
  it("renders each case, its failures, and a totals line", () => {
    const out = renderReport(results);
    expect(out).toContain("deck:tailscale");
    expect(out).toContain("tailscale not on PATH");
    expect(out).toMatch(/1 failed/);
    expect(out).toContain("skipped");
  });
});
