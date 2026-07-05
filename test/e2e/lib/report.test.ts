import { describe, it, expect } from "vitest";
import { renderReport, exitCode } from "./report.mts";

const results = [
  { id: "deck:minimal", vm: "bazzite", tier: "auto" as const, pass: true, failures: [] },
  { id: "deck:tailscale", vm: "bazzite", tier: "auto" as const, pass: false, failures: ["tailscale not on PATH"] },
  { id: "usb:msa", vm: "win11", tier: "semi" as const, pass: true, failures: [], skipped: "manual OOBE" },
];

describe("reporter", () => {
  it("exits non-zero when any case failed", () => {
    expect(exitCode(results)).toBe(1);
    expect(exitCode(results.filter(r => r.pass))).toBe(0);
  });
  it("renders each case, its failures, and a totals line", () => {
    const out = renderReport(results);
    expect(out).toContain("deck:tailscale");
    expect(out).toContain("tailscale not on PATH");
    expect(out).toMatch(/1 failed/);
    expect(out).toContain("skipped");
  });
});
