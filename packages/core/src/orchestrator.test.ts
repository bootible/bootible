import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type ApplyContext, restore } from "./orchestrator";
import { loadRegistry } from "./registry";
import { localTarget } from "./sync-target";

const here = fileURLToPath(new URL("./", import.meta.url));
const root = fileURLToPath(new URL("../../../", import.meta.url));
const deviceSchema = JSON.parse(readFileSync(`${root}schemas/device.schema.json`, "utf8"));
const schemas = {
  config: JSON.parse(readFileSync(`${root}schemas/config.schema.json`, "utf8")),
  targets: JSON.parse(readFileSync(`${root}schemas/targets.schema.json`, "utf8")),
};
const registry = loadRegistry(`${root}registry/devices`, deviceSchema);

describe("restore (flow L1)", () => {
  it("pulls the config, resolves the device, applies via the executor, and restores saves", () => {
    const base = mkdtempSync(join(tmpdir(), "bootible-restore-"));
    const targetRoot = join(base, "target");
    cpSync(`${here}__fixtures__/example-instance`, join(targetRoot, "config"), { recursive: true });
    mkdirSync(join(targetRoot, "saves"), { recursive: true });
    writeFileSync(join(targetRoot, "saves", "zelda.srm"), "save");

    const seen: ApplyContext[] = [];
    const executor = {
      apply: (ctx: ApplyContext) => {
        seen.push(ctx);
        return { actions: ["installed emulation"] };
      },
    };
    const secrets = { resolve: (k: string) => `secret-${k}` };

    const receipt = restore({
      target: localTarget(targetRoot),
      registry,
      schemas,
      secrets,
      executor,
      workdir: join(base, "work"),
      savesDest: join(base, "saves-restored"),
    });

    expect(receipt.device).toBe("rog-ally");
    expect(receipt.applied).toEqual(["installed emulation"]);
    expect(receipt.savesRestored).toBe(true);
    expect(seen[0]?.device.id).toBe("rog-ally");
    expect(existsSync(join(base, "saves-restored", "zelda.srm"))).toBe(true);
  });
});
