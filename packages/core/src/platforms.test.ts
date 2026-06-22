import { describe, expect, it } from "vitest";
import { PLATFORMS, platformById, platformForOs, ROADMAP_DEVICES } from "./platforms";

describe("platform catalog", () => {
  it("covers windows, linux and android in order", () => {
    expect(PLATFORMS.map((p) => p.id)).toEqual(["windows", "linux", "android"]);
  });

  it("maps registry os values to a platform (case-insensitive)", () => {
    expect(platformForOs("windows")).toBe("windows");
    expect(platformForOs("steamos")).toBe("linux");
    expect(platformForOs("Linux")).toBe("linux");
    expect(platformForOs("android")).toBe("android");
    expect(platformForOs("beos")).toBeUndefined();
    expect(platformForOs(undefined)).toBeUndefined();
  });

  it("resolves a platform by id", () => {
    expect(platformById("windows")?.label).toBe("Windows handheld");
    expect(platformById("nope")).toBeUndefined();
  });

  it("only lists roadmap devices for known platforms", () => {
    const ids = new Set(PLATFORMS.map((p) => p.id));
    for (const device of ROADMAP_DEVICES) expect(ids.has(device.platform)).toBe(true);
  });
});
