import { describe, it, expect } from "vitest";
import { stripCases } from "./strip.mts";

describe("strip-kit cases", () => {
  it("target Windows VMs and carry timeouts", () => {
    for (const c of stripCases) {
      expect(["win11", "win11home"]).toContain(c.vm);
      expect(c.timeoutMs).toBeGreaterThan(0);
    }
  });
});
