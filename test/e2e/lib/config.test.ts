import { describe, it, expect } from "vitest";
import { parseConfig } from "./config.mts";

describe("e2e config", () => {
  it("parses a valid config and exposes typed targets", () => {
    const cfg = parseConfig({
      keyPath: "C:/Users/gavin/.ssh/ti_ed25519",
      tiModule: "G:/code/Tools/test-infrastructure/ti/ti.psd1",
      targets: { bazzite: { ip: "172.30.90.13", user: "test-infra", os: "linux" } },
    });
    expect(cfg.targets.bazzite.ip).toBe("172.30.90.13");
    expect(cfg.targets.bazzite.os).toBe("linux");
  });

  it("throws a clear error when keyPath is missing", () => {
    expect(() => parseConfig({ tiModule: "x", targets: {} } as any))
      .toThrow(/keyPath/);
  });
});
