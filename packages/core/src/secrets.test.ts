import { describe, expect, it, vi } from "vitest";
import {
  bitwardenProvider,
  isSecretRef,
  onePasswordProvider,
  parseSecretRef,
  resolveSecrets,
} from "./secrets";

describe("secret references", () => {
  it("detects secret:// strings", () => {
    expect(isSecretRef("secret://home-wifi")).toBe(true);
    expect(isSecretRef("plain")).toBe(false);
    expect(isSecretRef(42)).toBe(false);
  });

  it("parses the key after secret://", () => {
    expect(parseSecretRef("secret://home-wifi")).toBe("home-wifi");
  });
});

describe("CLI providers", () => {
  it("onePasswordProvider runs op read and trims", () => {
    const exec = vi.fn(() => "topsecret\n");
    const pw = onePasswordProvider(exec).resolve("op://vault/wifi/password");
    expect(pw).toBe("topsecret");
    expect(exec).toHaveBeenCalledWith(["op", "read", "op://vault/wifi/password"]);
  });

  it("bitwardenProvider runs bw get password and trims", () => {
    const exec = vi.fn(() => "topsecret\n");
    expect(bitwardenProvider(exec).resolve("home-wifi")).toBe("topsecret");
    expect(exec).toHaveBeenCalledWith(["bw", "get", "password", "home-wifi"]);
  });
});

describe("resolveSecrets", () => {
  it("recursively replaces secret refs, leaving other values and not mutating", () => {
    const provider = { resolve: (k: string) => `resolved:${k}` };
    const input = {
      wifi: "secret://home",
      nested: { token: "secret://api" },
      port: 22,
      list: ["secret://x", "plain"],
    };
    const out = resolveSecrets(input, provider);
    expect(out).toEqual({
      wifi: "resolved:home",
      nested: { token: "resolved:api" },
      port: 22,
      list: ["resolved:x", "plain"],
    });
    expect(input.wifi).toBe("secret://home");
  });
});
