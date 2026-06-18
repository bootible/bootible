import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadArtifact } from "./config";

const here = fileURLToPath(new URL("./", import.meta.url));
const root = fileURLToPath(new URL("../../../", import.meta.url));
const schemas = {
  config: JSON.parse(readFileSync(`${root}schemas/config.schema.json`, "utf8")),
  targets: JSON.parse(readFileSync(`${root}schemas/targets.schema.json`, "utf8")),
};

describe("loadArtifact", () => {
  it("loads and validates a .bootible config + targets bundle", () => {
    const artifact = loadArtifact(`${here}__fixtures__/example-instance`, schemas);
    expect(artifact.config.device).toBe("rog-ally");
    expect(artifact.config.schema).toBe(2);
    expect(artifact.targets.targets).toHaveLength(2);
  });
});
