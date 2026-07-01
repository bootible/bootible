import { describe, expect, it } from "vitest";
import { CHANNELS } from "./app-ipc";

describe("CHANNELS", () => {
  const values = Object.values(CHANNELS);

  it("declares 68 IPC channels", () => {
    expect(values).toHaveLength(68);
  });

  it("has no duplicate channel strings", () => {
    expect(new Set(values).size).toBe(values.length);
  });

  it("every channel is a namespaced `area:name` string (never a bare word or node: import)", () => {
    for (const v of values) {
      expect(v).toMatch(/^[a-z]+:[a-zA-Z0-9:-]+$/);
      expect(v.startsWith("node:")).toBe(false);
    }
  });

  it("keeps stable wire names for a few load-bearing channels", () => {
    expect(CHANNELS.appsGroups).toBe("apps:groups");
    expect(CHANNELS.cloudSignUpEmail).toBe("cloud:signUpEmail");
    expect(CHANNELS.hostInstallStreaming).toBe("host:install-streaming");
    expect(CHANNELS.sshGenerateKey).toBe("ssh:generate-key");
    expect(CHANNELS.usbProgress).toBe("usb:progress");
  });
});
