import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type ApplyContext, loadRegistry } from "@bootible/core";
import { describe, expect, it } from "vitest";
import { type CliEnv, run } from "./run";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const deviceSchema = JSON.parse(readFileSync(`${root}schemas/device.schema.json`, "utf8"));
const schemas = {
  config: JSON.parse(readFileSync(`${root}schemas/config.schema.json`, "utf8")),
  targets: JSON.parse(readFileSync(`${root}schemas/targets.schema.json`, "utf8")),
};
const registry = loadRegistry(`${root}registry/devices`, deviceSchema);

function makeEnv(overrides: Partial<CliEnv> = {}): { env: CliEnv; out: string[] } {
  const out: string[] = [];
  const env: CliEnv = {
    stdout: (l) => out.push(l),
    schemas,
    registry,
    secrets: { resolve: (k) => `secret-${k}` },
    executor: { apply: () => ({ actions: [] }) },
    workdir: mkdtempSync(join(tmpdir(), "bootible-work-")),
    savesDest: mkdtempSync(join(tmpdir(), "bootible-saves-")),
    ...overrides,
  };
  return { env, out };
}

describe("cli run", () => {
  it("prints the version", () => {
    const { env, out } = makeEnv();
    expect(run(["version"], env)).toBe(0);
    expect(out.join("\n")).toContain("bootible");
  });

  it("restores from a local target and reports the receipt", () => {
    const base = mkdtempSync(join(tmpdir(), "bootible-cli-"));
    const targetRoot = join(base, "target");
    mkdirSync(join(targetRoot, "config"), { recursive: true });
    writeFileSync(
      join(targetRoot, "config", "config.yml"),
      "schema: 2\ndevice: rog-ally\nsettings: {}\n",
    );
    writeFileSync(
      join(targetRoot, "config", "targets.yml"),
      "schema: 1\ntargets:\n  - name: local\n    kind: local\n    roles: [config]\n",
    );
    mkdirSync(join(targetRoot, "saves"), { recursive: true });
    writeFileSync(join(targetRoot, "saves", "zelda.srm"), "save");

    const seen: ApplyContext[] = [];
    const { env, out } = makeEnv({
      executor: {
        apply: (ctx: ApplyContext) => {
          seen.push(ctx);
          return { actions: ["installed emulation"] };
        },
      },
    });
    expect(run(["restore", targetRoot], env)).toBe(0);
    expect(seen[0]?.device.id).toBe("rog-ally");
    expect(out.join("\n")).toContain("rog-ally");
  });

  it("returns nonzero for an unknown command", () => {
    const { env, out } = makeEnv();
    expect(run(["bogus"], env)).toBe(1);
    expect(out.join("\n")).toContain("unknown");
  });
});
