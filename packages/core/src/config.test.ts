import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { buildConfig, deepMerge, serializeConfig } from "./config";

describe("buildConfig", () => {
  it("builds a schema-2 config with device, modules and settings", () => {
    const config = buildConfig({
      device: "rog-ally",
      modules: ["power", "steam"],
      settings: { sleep_mode: "hibernate" },
    });
    expect(config).toEqual({
      schema: 2,
      device: "rog-ally",
      modules: ["power", "steam"],
      settings: { sleep_mode: "hibernate" },
    });
  });

  it("omits modules and settings when not given", () => {
    expect(buildConfig({ device: "rog-ally" })).toEqual({ schema: 2, device: "rog-ally" });
  });
});

describe("serializeConfig", () => {
  it("round-trips through YAML", () => {
    const config = buildConfig({ device: "rog-ally", modules: ["power"] });
    expect(parse(serializeConfig(config))).toEqual(config);
  });
});

describe("deepMerge", () => {
  it("merges nested objects, with override scalars winning", () => {
    const base = { a: { x: 1, y: 2 }, b: 5 };
    const result = deepMerge(base, { a: { y: 3 } } as Partial<typeof base>);
    expect(result).toEqual({ a: { x: 1, y: 3 }, b: 5 });
  });

  it("does not mutate either input", () => {
    const base = { a: { x: 1 } };
    const override = { a: { x: 2 } };
    deepMerge(base, override);
    expect(base).toEqual({ a: { x: 1 } });
    expect(override).toEqual({ a: { x: 2 } });
  });
});
