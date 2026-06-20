import { describe, expect, it } from "vitest";
import { allyExecutor } from "./ally-executor";
import { generateBootstrapScript } from "./bootstrap";
import type { DeviceEntry } from "./registry";

const device: DeviceEntry = {
  id: "rog-ally",
  name: "ROG Ally",
  provisioning_models: ["on-device"],
};

const script = generateBootstrapScript({
  device,
  config: { schema: 2, device: "rog-ally", settings: { sleep_mode: "hibernate" } },
  executorFactory: allyExecutor,
});

describe("generateBootstrapScript", () => {
  it("is a self-contained PowerShell script that needs no node runtime", () => {
    expect(script).toContain("$ErrorActionPreference");
    expect(script.toLowerCase()).not.toContain("node");
  });

  it("enables system restore and creates both named checkpoints", () => {
    expect(script).toContain("Enable-ComputerRestore");
    expect(script).toContain("Fresh Windows (pre-bootible)");
    expect(script).toContain("bootible configured");
  });

  it("bakes in the real module commands (powercfg, winget, reg, sc)", () => {
    expect(script).toContain("powercfg");
    expect(script).toContain("winget");
    expect(script).toContain("reg");
    expect(script).toContain("sc");
  });

  it("orders the fresh checkpoint before module work and post-config after", () => {
    const fresh = script.indexOf("Fresh Windows (pre-bootible)");
    const powercfg = script.indexOf("powercfg");
    const post = script.indexOf("bootible configured");
    expect(fresh).toBeLessThan(powercfg);
    expect(powercfg).toBeLessThan(post);
  });

  it("wraps each step so one failure does not abort the rest", () => {
    expect(script).toContain("try {");
    expect(script).toContain("catch {");
  });
});
