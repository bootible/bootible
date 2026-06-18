import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadRegistry } from "./registry";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const schema = JSON.parse(readFileSync(`${root}schemas/device.schema.json`, "utf8"));

describe("loadRegistry", () => {
  it("loads and validates every device entry in the registry", () => {
    const devices = loadRegistry(`${root}registry/devices`, schema);
    const ids = devices.map((d) => d.id).sort();
    expect(ids).toEqual(["rog-ally", "steamdeck"]);
  });
});
