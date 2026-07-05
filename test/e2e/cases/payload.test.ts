import { describe, it, expect } from "vitest";
import { payloadCases } from "./payload.mts";

describe("payload-validate cases", () => {
  it("the ROG local-account bundle case passes on generated output", async () => {
    const c = payloadCases.find((c) => c.id === "payload:rog-local")!;
    const res = await c.run({} as any);
    expect(res.pass, res.failures.join("; ")).toBe(true);
  });
  it("the MSA autounattend case asserts the semi-attended path", async () => {
    const c = payloadCases.find((c) => c.id === "payload:autounattend-msa")!;
    const res = await c.run({} as any);
    expect(res.pass, res.failures.join("; ")).toBe(true);
  });
  it("the Deck bundle case passes on generated output", async () => {
    const c = payloadCases.find((c) => c.id === "payload:deck-bundle")!;
    const res = await c.run({} as any);
    expect(res.pass, res.failures.join("; ")).toBe(true);
  });
});
