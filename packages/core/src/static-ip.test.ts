import { describe, expect, it } from "vitest";
import { normalizeStaticIp, validateStaticIp } from "./static-ip";

describe("validateStaticIp", () => {
  it("accepts a valid entry and returns the normalized value", () => {
    const r = validateStaticIp({ iface: "ethernet", ip: "192.168.1.50", prefix: 24 });
    expect(r).toEqual({ ok: true, value: { iface: "ethernet", ip: "192.168.1.50", prefix: 24 } });
  });

  it("reports a missing or malformed address", () => {
    expect(validateStaticIp({ ip: "" })).toEqual({ ok: false, errors: { ip: expect.any(String) } });
    expect(validateStaticIp({ ip: "999.1.1.1" })).toEqual({
      ok: false,
      errors: { ip: expect.any(String) },
    });
  });

  it("reports an out-of-range prefix", () => {
    const r = validateStaticIp({ ip: "10.0.0.5", prefix: 33 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.prefix).toEqual(expect.any(String));
  });

  it("reports a malformed gateway and DNS without dropping them silently", () => {
    const r = validateStaticIp({ ip: "10.0.0.5", gateway: "10.0.0.300", dns: "1.1.1.1,nope" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.gateway).toEqual(expect.any(String));
      expect(r.errors.dns).toEqual(expect.any(String));
    }
  });

  it("accepts a fully-specified valid entry", () => {
    const r = validateStaticIp({
      iface: "wifi",
      ip: "10.0.0.5",
      prefix: 24,
      gateway: "10.0.0.1",
      dns: "1.1.1.1,8.8.8.8",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.dns).toBe("1.1.1.1,8.8.8.8");
  });
});

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

  it("rejects out-of-range octets in the address", () => {
    expect(normalizeStaticIp({ ip: "999.999.999.999" })).toBeUndefined();
    expect(normalizeStaticIp({ ip: "256.1.1.1" })).toBeUndefined();
    expect(normalizeStaticIp({ ip: "1.2.3.256" })).toBeUndefined();
    // valid boundaries still pass
    expect(normalizeStaticIp({ ip: "255.255.255.255" })?.ip).toBe("255.255.255.255");
    expect(normalizeStaticIp({ ip: "0.0.0.0" })?.ip).toBe("0.0.0.0");
  });

  it("drops a gateway and filters DNS entries with out-of-range octets", () => {
    const r = normalizeStaticIp({
      ip: "10.0.0.5",
      gateway: "10.0.0.300",
      dns: "10.0.0.1,8.8.8.999",
    });
    expect(r?.gateway).toBeUndefined();
    expect(r?.dns).toBe("10.0.0.1");
  });
});
