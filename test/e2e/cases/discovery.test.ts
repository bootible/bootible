import { describe, it, expect } from "vitest";
import { parseBeacon } from "@bootible/core";
import { discoveryCases } from "./discovery.mts";

describe("beacon parser (desktop-side receiver)", () => {
  it("parses a done beacon and flags mine on buildId match", () => {
    const payload = JSON.stringify({
      bootible: 1,
      buildId: "abc123",
      ip: "172.30.90.13",
      hostname: "ti-bazzite",
      username: "test-infra",
      status: "done",
    });
    const d = parseBeacon(Buffer.from(payload), "abc123");
    expect(d?.hostname).toBe("ti-bazzite");
    expect(d?.username).toBe("test-infra");
    expect(d?.ip).toBe("172.30.90.13");
    expect(d?.status).toBe("done");
    expect(d?.mine).toBe(true);
  });

  it("flags mine false when the buildId doesn't match this desktop's last build", () => {
    const payload = JSON.stringify({
      bootible: 1,
      buildId: "someone-elses-build",
      ip: "172.30.90.13",
      hostname: "ti-bazzite",
      username: "test-infra",
      status: "done",
    });
    const d = parseBeacon(Buffer.from(payload), "abc123");
    expect(d?.mine).toBe(false);
  });

  it("ignores non-bootible / malformed UDP traffic", () => {
    expect(parseBeacon(Buffer.from("not json"), "abc123")).toBeNull();
    expect(parseBeacon(Buffer.from(JSON.stringify({ hello: "world" })), "abc123")).toBeNull();
    expect(parseBeacon(Buffer.from(JSON.stringify({ bootible: 2 })), "abc123")).toBeNull();
  });
});

describe("discovery e2e case", () => {
  it("is registered with a fixed buildId baked into the deck config and a timeout", () => {
    const c = discoveryCases.find((c) => c.id === "discovery:beacon-e2e")!;
    expect(c).toBeDefined();
    expect(c.vm).toBe("bazzite");
    expect(c.timeoutMs).toBeGreaterThan(0);
    expect(c.config.ssh.enabled).toBe(true);
  });
});
