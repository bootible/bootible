import { describe, it, expect } from "vitest";
import { genDeckProvision, withTiKey, TI_PUBKEY } from "./generate.mts";

describe("generate wrappers", () => {
  it("bakes the ti key into every deck-provision config", () => {
    const cfg = withTiKey({ ssh: { enabled: true, port: 22, authorizedKeys: [] } });
    expect(cfg.ssh!.authorizedKeys).toContain(TI_PUBKEY);
  });

  it("dedupes rather than clobbers a pre-existing authorized key", () => {
    const cfg = withTiKey({
      ssh: { enabled: true, port: 22, authorizedKeys: ["ssh-ed25519 AAAAEXISTING someone@else"] },
    });
    expect(cfg.ssh!.authorizedKeys).toContain("ssh-ed25519 AAAAEXISTING someone@else");
    expect(cfg.ssh!.authorizedKeys).toContain(TI_PUBKEY);
  });

  it("emits a runnable provision.sh with the ti key present", () => {
    const sh = genDeckProvision({ flatpakApps: ["flatseal"], ssh: { enabled: true, port: 22, authorizedKeys: [] } });
    expect(sh).toMatch(/^#!\/usr\/bin\/env bash/);
    expect(sh).toContain("ti test infrastructure");
  });
});
