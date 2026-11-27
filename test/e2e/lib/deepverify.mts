import { manifestProbe, parseVerifyOutput, readProbedManifest, verifyPlan } from "@bootible/core";
import type { Target } from "./config.mts";
import { push, runRemote } from "./remote.mts";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** The app's deep verify, exactly as Verify runs it: read the build manifest the
 *  provisioner saved, generate the check script for that build, run it on the
 *  guest, and return one failure line per failed check (skips are fine). This is
 *  what proves the verifier and the provisioner agree on a real OS. */
export async function deepVerify(
  t: Target,
  key: string,
  os: "linux" | "windows",
): Promise<string[]> {
  const probe = await runRemote(t, manifestProbe(os), "", key, 30_000);
  const manifest = readProbedManifest(probe.stdout);
  if (!manifest) return [`deep verify: no build manifest on the guest (${probe.out.trim().slice(0, 200)})`];
  const plan = verifyPlan(manifest);
  if (plan.upload) {
    const local = join(mkdtempSync(join(tmpdir(), "bootible-verify-")), "verify.ps1");
    writeFileSync(local, plan.script, "ascii");
    const up = await push(t, local, plan.upload, key);
    if (up.code !== 0) return [`deep verify: couldn't copy the check script (${up.out.trim().slice(0, 200)})`];
  }
  const r = await runRemote(t, plan.remote, plan.upload ? "" : plan.script, key, 300_000);
  const checks = parseVerifyOutput(r.stdout);
  if (checks.length === 0) return [`deep verify: no check results (exit ${r.code}) ${r.stderr.trim().slice(0, 300)}`];
  return checks.filter((c) => c.status === "fail").map((c) => `verify ${c.id}: ${c.detail}`);
}
