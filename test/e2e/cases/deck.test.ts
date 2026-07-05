import { describe, it, expect } from "vitest";
import { deckCases } from "./deck.mts";
import { TI_PUBKEY } from "../lib/generate.mts";
import { genDeckProvision } from "../lib/generate.mts";

describe("deck-provision cases", () => {
  it("every case bakes the ti key (no lockout) and sets a timeout", () => {
    for (const c of deckCases) {
      expect(c.timeoutMs, `${c.id} needs a timeout`).toBeGreaterThan(0);
    }
  });
  it("the everything-on config still emits the ti key", () => {
    const full = deckCases.find((c) => c.id === "deck:everything-on")!;
    // config is attached for introspection:
    expect((full as any).config.ssh.authorizedKeys).toContain(TI_PUBKEY);
    expect(genDeckProvision((full as any).config)).toContain("ti test infrastructure");
  });
});
