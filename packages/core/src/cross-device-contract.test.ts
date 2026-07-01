import { describe, expect, it } from "vitest";
import { buildDeckBundle } from "./deck-bundle";
import { DEFAULT_DECK_CONFIG } from "./deck-config";
import { generateDeckProvision } from "./deck-provision";
import { capabilitiesFor, devicesWithCapabilities } from "./device-capabilities";
import { buildProvisioningPlan } from "./provisioning-plan";
import { validateStaticIp } from "./static-ip";

/**
 * Cross-device contract: the shared, family-agnostic guarantees every device
 * family must uphold, in one suite. Catches a family losing its build path, a
 * device added without capabilities, or the shared validation drifting per device
 * (coding-standard #17). Per-artifact detail is covered by each builder's own test.
 */
describe("cross-device contract", () => {
  it("every capability-registered device declares a known family and at least one media mode", () => {
    for (const id of devicesWithCapabilities()) {
      const cap = capabilitiesFor(id);
      expect(cap, id).toBeDefined();
      expect(["windows", "steamos"]).toContain(cap?.family);
      expect(cap?.media.length, `${id} media`).toBeGreaterThan(0);
    }
  });

  it("windows family: a build choice resolves to a module set + settings bag", () => {
    const plan = buildProvisioningPlan({
      modules: ["power"],
      baseId: "raw",
      sshPublicKeys: ["ssh-ed25519 AAA"],
    });
    expect(plan.modules).toContain("power");
    expect(plan.modules).toContain("ssh-key");
    expect(Object.keys(plan.settings).length).toBeGreaterThan(0);
    expect(plan.settings.ssh_public_keys).toEqual(["ssh-ed25519 AAA"]);
  });

  it("steamos family: the default config generates a provision script + a non-empty bundle", () => {
    const script = generateDeckProvision(DEFAULT_DECK_CONFIG);
    expect(typeof script).toBe("string");
    expect(script.length).toBeGreaterThan(100);
    const bundle = buildDeckBundle(DEFAULT_DECK_CONFIG);
    expect(bundle.length).toBeGreaterThan(0);
    expect(bundle.every((f) => typeof f.path === "string")).toBe(true);
  });

  it("network validation is shared and device-agnostic (same result for any family)", () => {
    const good = validateStaticIp({ iface: "wifi", ip: "192.168.1.5", prefix: 24 });
    expect(good.ok).toBe(true);
    const bad = validateStaticIp({ iface: "wifi", ip: "not-an-ip", prefix: 24 });
    expect(bad.ok).toBe(false);
  });
});
