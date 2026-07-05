import type { Case } from "../cases/payload.mts";
import type { CaseResult } from "./report.mts";
import type { Target } from "./config.mts";
import { loadConfig } from "./config.mts";
import { push, runPwsh, waitForSsh } from "./remote.mts";
import { reset } from "./ti.mts";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** A single file to materialise locally and push to the VM before the
 *  remote script runs. */
export interface VmCaseArtifact {
  /** Local tmp-file extension, e.g. "ps1" or "bat". */
  ext: string;
  content: string;
  remotePath: string;
}

export interface VmCheck {
  name: string;
  run(t: Target, key: string): Promise<string | null>;
}

export interface WinModuleCaseOpts {
  id: string;
  vm: "win11" | "win11home";
  kind: string;
  timeoutMs: number;
  /** Deferred so artifact generation happens after reset(), matching the
   *  original strip/bootstrap ordering. */
  genArtifacts(): VmCaseArtifact[];
  remoteScript: string;
  checks: VmCheck[];
  /** Prefix used in the non-zero-exit failure message, e.g. "strip script". */
  failLabel: string;
}

/** Shared choreography for a Windows VM case: reset the VM, write + push
 *  generated artifacts, run the remote script over pwsh, then run each
 *  check. Common to strip-kit and bootstrap cases (test/e2e/cases/strip.mts
 *  and bootstrap.mts) — only the artifacts, remote command, and checks
 *  differ between them. */
export function winModuleCase(opts: WinModuleCaseOpts): Case {
  const { id, vm, kind, timeoutMs, genArtifacts, remoteScript, checks, failLabel } = opts;
  return {
    id,
    vm,
    kind,
    tier: "auto",
    timeoutMs,
    async run(): Promise<CaseResult> {
      const cfg = loadConfig();
      const t = cfg.targets[vm];
      await reset(cfg.tiModule, vm);
      await waitForSsh(t, cfg.keyPath);
      await runPwsh(t, "New-Item -ItemType Directory -Force -Path C:\\bootible | Out-Null", cfg.keyPath);
      const artifacts = genArtifacts();
      for (const a of artifacts) {
        const tmp = join(tmpdir(), `${id.replace(/[:]/g, "_")}.${a.ext}`);
        writeFileSync(tmp, a.content);
        await push(t, tmp, a.remotePath, cfg.keyPath);
      }
      const r = await runPwsh(t, remoteScript, cfg.keyPath, timeoutMs);
      const failures: (string | null)[] = [
        r.code === 0 ? null : `${failLabel} exited non-zero (code ${r.code})`,
      ];
      for (const check of checks) {
        failures.push(await check.run(t, cfg.keyPath));
      }
      return {
        id,
        vm,
        tier: "auto",
        pass: failures.every((f) => f == null),
        failures: failures.filter((f): f is string => !!f),
      };
    },
  };
}
