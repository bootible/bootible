import { describe, expect, it } from "vitest";
import { normalizeStaticIp } from "./static-ip";

describe("normalizeStaticIp", () => {
  it("returns undefined for missing or non-IPv4 addresses", () => {
    expect(normalizeStaticIp(undefined)).toBeUndefined();
    expect(normalizeStaticIp({ ip: "" })).toBeUndefined();
    expect(normalizeStaticIp({ ip: "not-an-ip" })).toBeUndefined();
    expect(normalizeStaticIp({ ip: "10.0.0" })).toBeUndefined();
  });

  it("defaults iface to wifi and prefix to 24", () => {
    expect(normalizeStaticIp({ ip: "192.168.1.50" })).toEqual({
      iface: "wifi",
      ip: "192.168.1.50",
      prefix: 24,
      gateway: undefined,
      dns: undefined,
    });
  });

  it("keeps ethernet, clamps the prefix, and validates gateway + dns", () => {
    expect(
      normalizeStaticIp({
        iface: "ethernet",
        ip: " 10.0.0.5 ",
        prefix: 99,
        gateway: "10.0.0.1",
        dns: "1.1.1.1, junk, 8.8.8.8",
      }),
    ).toEqual({
      iface: "ethernet",
      ip: "10.0.0.5",
      prefix: 32,
      gateway: "10.0.0.1",
      dns: "1.1.1.1,8.8.8.8",
    });
  });

  it("drops an invalid gateway", () => {
    expect(normalizeStaticIp({ ip: "10.0.0.5", gateway: "nope" })?.gateway).toBeUndefined();
  });
});
