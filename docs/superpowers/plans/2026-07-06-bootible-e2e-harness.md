# bootible E2E Test Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node/TS harness that runs bootible's *real* provisioning artifacts against pristine `ti` Hyper-V VMs and asserts the result — closing the gap between "the generator emits the right string" (368 existing tests) and "the script actually works on the target."

**Architecture:** A TypeScript harness under `test/e2e/`, executed with `tsx` from an **elevated** pwsh (needed for `ti`/Hyper-V). It imports bootible's core generators directly, and shells out to `ti` (via pwsh), `ssh`, and `scp` for VM lifecycle and remote execution. Pure units (generation wrappers, assertion helpers, the reporter, the case matrix) are vitest-unit-tested with no VM; the VM-touching orchestration is verified by an elevated run. It is **separate** from `npm test` (the fast gate).

**Tech Stack:** TypeScript, `tsx` (ESM TS runner), Node `node:child_process`/`node:fs`, vitest (for the harness's own unit tests), `@bootible/core` generators, OpenSSH (`ssh`/`scp`), the `ti` PowerShell module.

## Global Constraints

- **Elevation:** `ti up`/`reset`/`down` require an elevated pwsh (Hyper-V). The harness is authored in a non-elevated session but MUST be run from an elevated one. Never assume the authoring session can drive `ti`.
- **ti SSH key:** `C:\Users\gavin\.ssh\ti_ed25519`. Guest user `test-infra`, password `test-infra`, passwordless sudo (Linux) / local admin (Windows).
- **Target IPs (ti-net):** `bazzite=172.30.90.13`, `cachyos=172.30.90.14`, `win11=172.30.90.11`, `win11home=172.30.90.15`. No `steamos` VM (not virtualizable).
- **ti-key lockout gotcha:** bootible OWNS `~/.ssh/authorized_keys`. Every Linux (`deck-provision`) case config MUST include the ti public key (`ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAID8/PsgGbtGk4JZITuqWoW8i/99tAhgsIGRcUsDs7ycO ti test infrastructure`) in `ssh.authorizedKeys`, or the provision wipes it and the harness locks itself out.
- **SteamOS-only mechanisms** (`steamos-readonly`, `/etc/atomic-update.conf.d`, Decky, deck-tailscale sysext, SteamOS Waydroid installer) CANNOT be validated on the bazzite proxy — they stay real-Deck-manual. The harness asserts the portable behavior and that these steps warn-not-fail on the proxy.
- **Semi/Manual (never assert as auto):** MSA OAuth sign-in, the strip default-browser "Set default" tap, and physical USB write/eject.
- **Per-case timeouts:** default 240 s; Proton-GE and distrobox cases need 900 s.
- **No secrets in the repo:** the ti key path and IPs come from a gitignored `test/e2e/e2e.config.json` (with a committed `.example`), never hardcoded credentials.

---

## File Structure

```
test/e2e/
  README.md                 # how to run (elevated), what each kind does
  e2e.config.example.json   # committed template: keyPath, ti module path, targets
  e2e.config.json           # gitignored: real local paths
  run.mts                   # CLI entrypoint: parse args, load cases, orchestrate, report
  lib/
    config.mts              # load+validate e2e.config.json; TARGETS map
    generate.mts            # wrap @bootible/core generators -> Artifact objects
    ti.mts                  # ti driver: up/reset/down/ip via pwsh
    remote.mts              # scp/ssh helpers (linux bash + windows pwsh), tty logic
    assert.mts              # assertion primitives (pure + remote probes)
    report.mts              # Result model, matrix formatter, exit code
  cases/
    index.mts               # collect all cases into one array
    payload.mts             # payload-validate cases (no VM)
    deck.mts                # deck-provision cases (bazzite/cachyos)
    strip.mts               # strip-kit cases (win11/win11home)
    bootstrap.mts           # clean-install bootstrap + RDP cases
    discovery.mts           # discovery listener + end-to-end beacon
  lib/*.test.ts             # vitest unit tests for the pure units
```

**Import boundary:** the harness imports core via the workspace package `@bootible/core` (Node context — the Node-only barrel is fine here, unlike the renderer). If a symbol isn't on the barrel, import the subpath `@bootible/core/dist/<module>.js` or `../../packages/core/src/<module>.ts` (tsx resolves TS).

---

## Task 1: Harness scaffold + config module

**Files:**
- Create: `test/e2e/lib/config.mts`, `test/e2e/e2e.config.example.json`, `test/e2e/README.md`
- Modify: `package.json` (root — add `tsx` devDep + `test:e2e` script), `.gitignore` (add `test/e2e/e2e.config.json`)
- Test: `test/e2e/lib/config.test.ts`

**Interfaces:**
- Produces: `loadConfig(): E2EConfig` where `E2EConfig = { keyPath: string; tiModule: string; targets: Record<TargetName, { ip: string; user: string; os: "linux"|"windows" }> }`; `TARGETS: Record<TargetName,Target>` after load; `TargetName = "bazzite"|"cachyos"|"win11"|"win11home"`.

- [ ] **Step 1: Write the failing test**

```ts
// test/e2e/lib/config.test.ts
import { describe, it, expect } from "vitest";
import { parseConfig } from "./config.mts";

describe("e2e config", () => {
  it("parses a valid config and exposes typed targets", () => {
    const cfg = parseConfig({
      keyPath: "C:/Users/gavin/.ssh/ti_ed25519",
      tiModule: "G:/code/Tools/test-infrastructure/ti/ti.psd1",
      targets: { bazzite: { ip: "172.30.90.13", user: "test-infra", os: "linux" } },
    });
    expect(cfg.targets.bazzite.ip).toBe("172.30.90.13");
    expect(cfg.targets.bazzite.os).toBe("linux");
  });

  it("throws a clear error when keyPath is missing", () => {
    expect(() => parseConfig({ tiModule: "x", targets: {} } as any))
      .toThrow(/keyPath/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/e2e/lib/config.test.ts`
Expected: FAIL — `parseConfig` not exported.

- [ ] **Step 3: Write minimal implementation**

```ts
// test/e2e/lib/config.mts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export type TargetName = "bazzite" | "cachyos" | "win11" | "win11home";
export interface Target { ip: string; user: string; os: "linux" | "windows"; }
export interface E2EConfig { keyPath: string; tiModule: string; targets: Record<string, Target>; }

export function parseConfig(raw: unknown): E2EConfig {
  const c = raw as Partial<E2EConfig>;
  if (!c || typeof c.keyPath !== "string") throw new Error("e2e config: keyPath (string) is required");
  if (typeof c.tiModule !== "string") throw new Error("e2e config: tiModule (string) is required");
  if (!c.targets || typeof c.targets !== "object") throw new Error("e2e config: targets map is required");
  return { keyPath: c.keyPath, tiModule: c.tiModule, targets: c.targets };
}

export function loadConfig(): E2EConfig {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = join(here, "..", "e2e.config.json");
  return parseConfig(JSON.parse(readFileSync(path, "utf8")));
}
```

- [ ] **Step 4: Create the example config, README stub, package wiring**

```json
// test/e2e/e2e.config.example.json
{
  "keyPath": "C:/Users/gavin/.ssh/ti_ed25519",
  "tiModule": "G:/code/Tools/test-infrastructure/ti/ti.psd1",
  "targets": {
    "bazzite":   { "ip": "172.30.90.13", "user": "test-infra", "os": "linux" },
    "cachyos":   { "ip": "172.30.90.14", "user": "test-infra", "os": "linux" },
    "win11":     { "ip": "172.30.90.11", "user": "test-infra", "os": "windows" },
    "win11home": { "ip": "172.30.90.15", "user": "test-infra", "os": "windows" }
  }
}
```

Add to root `package.json` `scripts`: `"test:e2e": "tsx test/e2e/run.mts"`, and to `devDependencies`: `"tsx": "^4.19.0"`. Add `test/e2e/e2e.config.json` to `.gitignore`. Write `test/e2e/README.md` with: "Run from an **elevated** pwsh: `cp test/e2e/e2e.config.example.json test/e2e/e2e.config.json` then `npm run test:e2e -- --kind payload-validate` (no VM) or `npm run test:e2e -- --vm bazzite` (needs ti + elevation)."

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/e2e/lib/config.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add test/e2e/lib/config.mts test/e2e/lib/config.test.ts test/e2e/e2e.config.example.json test/e2e/README.md package.json .gitignore
git commit -m "test(e2e): scaffold harness config + example + package wiring"
```

---

## Task 2: Generation wrappers (`generate.mts`)

**Files:**
- Create: `test/e2e/lib/generate.mts`
- Test: `test/e2e/lib/generate.test.ts`

**Interfaces:**
- Consumes: `@bootible/core` — `generateDeckProvision(cfg)`, `buildDeckBundle(cfg)`, `buildUsbBundle(req)`, `generateAutounattend(cfg)`, `buildStripKit`/`generateStripScript`. Verify exact export names against `packages/core/src/index.ts` before writing; if a name isn't on the barrel, import its module subpath.
- Produces: `genDeckProvision(cfg: Partial<DeckConfig>): string` (the provision.sh text, ti key auto-injected), `genDeckBundle(cfg): BundleFile[]`, `genUsbBundle(req): BundleFile[]`, `genStripKit(req): { script: string; launcher: string; readme: string }`. `withTiKey(cfg)` helper that guarantees the ti key is in `ssh.authorizedKeys`.

- [ ] **Step 1: Write the failing test**

```ts
// test/e2e/lib/generate.test.ts
import { describe, it, expect } from "vitest";
import { genDeckProvision, withTiKey, TI_PUBKEY } from "./generate.mts";

describe("generate wrappers", () => {
  it("bakes the ti key into every deck-provision config", () => {
    const cfg = withTiKey({ ssh: { enabled: true, port: 22, authorizedKeys: [] } });
    expect(cfg.ssh!.authorizedKeys).toContain(TI_PUBKEY);
  });

  it("emits a runnable provision.sh with the ti key present", () => {
    const sh = genDeckProvision({ flatpakApps: ["flatseal"], ssh: { enabled: true, port: 22, authorizedKeys: [] } });
    expect(sh).toMatch(/^#!\/usr\/bin\/env bash/);
    expect(sh).toContain("ti test infrastructure");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/e2e/lib/generate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// test/e2e/lib/generate.mts
import { generateDeckProvision } from "@bootible/core";
import type { DeckConfig } from "@bootible/core";

export const TI_PUBKEY =
  "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAID8/PsgGbtGk4JZITuqWoW8i/99tAhgsIGRcUsDs7ycO ti test infrastructure";

/** Guarantee the ti test key is authorized so bootible's authorized_keys rewrite
 *  doesn't lock the harness out of the guest. */
export function withTiKey(cfg: Partial<DeckConfig>): Partial<DeckConfig> {
  const ssh = cfg.ssh ?? { enabled: true, port: 22, authorizedKeys: [] };
  const keys = new Set([...(ssh.authorizedKeys ?? []), TI_PUBKEY]);
  return { ...cfg, ssh: { ...ssh, enabled: true, authorizedKeys: [...keys] } };
}

export function genDeckProvision(cfg: Partial<DeckConfig>): string {
  return generateDeckProvision(withTiKey(cfg) as DeckConfig);
}
```

(Extend with `genDeckBundle`, `genUsbBundle`, `genStripKit`, `genAutounattend` in Task 5/11/12 as those kinds are added — each a one-line pass-through to the verified core export.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/e2e/lib/generate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add test/e2e/lib/generate.mts test/e2e/lib/generate.test.ts
git commit -m "test(e2e): core generation wrappers with ti-key injection"
```

---

## Task 3: Reporter (`report.mts`)

**Files:**
- Create: `test/e2e/lib/report.mts`
- Test: `test/e2e/lib/report.test.ts`

**Interfaces:**
- Produces: `CaseResult = { id: string; vm: string; tier: "auto"|"semi"|"manual"; pass: boolean; failures: string[]; skipped?: string }`; `renderReport(results: CaseResult[]): string`; `exitCode(results: CaseResult[]): number` (0 if no `pass===false`, else 1). Skipped cases (`skipped` set) never fail the run.

- [ ] **Step 1: Write the failing test**

```ts
// test/e2e/lib/report.test.ts
import { describe, it, expect } from "vitest";
import { renderReport, exitCode } from "./report.mts";

const results = [
  { id: "deck:minimal", vm: "bazzite", tier: "auto" as const, pass: true, failures: [] },
  { id: "deck:tailscale", vm: "bazzite", tier: "auto" as const, pass: false, failures: ["tailscale not on PATH"] },
  { id: "usb:msa", vm: "win11", tier: "semi" as const, pass: true, failures: [], skipped: "manual OOBE" },
];

describe("reporter", () => {
  it("exits non-zero when any case failed", () => {
    expect(exitCode(results)).toBe(1);
    expect(exitCode(results.filter(r => r.pass))).toBe(0);
  });
  it("renders each case, its failures, and a totals line", () => {
    const out = renderReport(results);
    expect(out).toContain("deck:tailscale");
    expect(out).toContain("tailscale not on PATH");
    expect(out).toMatch(/1 failed/);
    expect(out).toContain("skipped");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/e2e/lib/report.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// test/e2e/lib/report.mts
export interface CaseResult {
  id: string; vm: string; tier: "auto" | "semi" | "manual";
  pass: boolean; failures: string[]; skipped?: string;
}

export function exitCode(results: CaseResult[]): number {
  return results.some(r => !r.skipped && r.pass === false) ? 1 : 0;
}

export function renderReport(results: CaseResult[]): string {
  const lines: string[] = ["", "=== bootible E2E results ==="];
  for (const r of results) {
    const mark = r.skipped ? "SKIP" : r.pass ? "PASS" : "FAIL";
    lines.push(`  [${mark}] ${r.id.padEnd(28)} ${r.vm.padEnd(10)} (${r.tier})${r.skipped ? ` — skipped: ${r.skipped}` : ""}`);
    for (const f of r.failures) lines.push(`         └─ ${f}`);
  }
  const failed = results.filter(r => !r.skipped && !r.pass).length;
  const passed = results.filter(r => !r.skipped && r.pass).length;
  const skipped = results.filter(r => r.skipped).length;
  lines.push("", `  ${passed} passed, ${failed} failed, ${skipped} skipped`, "");
  return lines.join("\n");
}
```

- [ ] **Step 4: Run to verify it passes** → `npx vitest run test/e2e/lib/report.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add test/e2e/lib/report.mts test/e2e/lib/report.test.ts
git commit -m "test(e2e): result model + matrix reporter + exit code"
```

---

## Task 4: Assertion primitives (`assert.mts`)

**Files:**
- Create: `test/e2e/lib/assert.mts`
- Test: `test/e2e/lib/assert.test.ts`

**Interfaces:**
- Produces: pure helpers `receiptHasOk(receipt: string, step: string): string|null` (returns a failure message or null), `textContains(hay: string, needle: string, label: string): string|null`, `bundleHasFile(files: {path:string}[], path: string): string|null`. Remote probes (`flatpakInstalled`, `serviceEnabled`, `regEquals`, `wingetListed`, `appxAbsent`, `portOpen`) are added in Task 8/10 as thin wrappers over `remote.mts` runners — each returns `string|null` (failure message or null) for uniform collection.

- [ ] **Step 1: Write the failing test**

```ts
// test/e2e/lib/assert.test.ts
import { describe, it, expect } from "vitest";
import { receiptHasOk, textContains, bundleHasFile } from "./assert.mts";

describe("assertion primitives", () => {
  it("receiptHasOk returns null on a present ok line, message otherwise", () => {
    const receipt = "ok   flathub ready\nok   flatpak apps done\n";
    expect(receiptHasOk(receipt, "flatpak apps done")).toBeNull();
    expect(receiptHasOk(receipt, "Proton-GE installed")).toMatch(/Proton-GE/);
  });
  it("bundleHasFile finds an expected artifact path", () => {
    const files = [{ path: "autounattend.xml" }, { path: "sources/$OEM$/$1/bootible/bootstrap.ps1" }];
    expect(bundleHasFile(files, "autounattend.xml")).toBeNull();
    expect(bundleHasFile(files, "missing.xml")).toMatch(/missing.xml/);
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL.

- [ ] **Step 3: Implement**

```ts
// test/e2e/lib/assert.mts
export function receiptHasOk(receipt: string, step: string): string | null {
  return new RegExp(`^ok\\s+${escapeRe(step)}`, "m").test(receipt)
    ? null : `receipt missing ok line: "${step}"`;
}
export function textContains(hay: string, needle: string, label: string): string | null {
  return hay.includes(needle) ? null : `${label}: expected to contain "${needle}"`;
}
export function bundleHasFile(files: { path: string }[], path: string): string | null {
  return files.some(f => f.path === path) ? null : `bundle missing file: ${path}`;
}
function escapeRe(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
```

- [ ] **Step 4: Run to verify it passes** → PASS.

- [ ] **Step 5: Commit**

```bash
git add test/e2e/lib/assert.mts test/e2e/lib/assert.test.ts
git commit -m "test(e2e): pure assertion primitives (receipt/text/bundle)"
```

---

## Task 5: `payload-validate` kind + cases + `run.mts` (no VM — first green end-to-end)

**Files:**
- Create: `test/e2e/cases/payload.mts`, `test/e2e/cases/index.mts`, `test/e2e/run.mts`
- Modify: `test/e2e/lib/generate.mts` (add `genUsbBundle`, `genDeckBundle`, `genAutounattend` pass-throughs)
- Test: `test/e2e/cases/payload.test.ts`

**Interfaces:**
- Produces: `Case = { id: string; vm: TargetName|"none"; kind: "payload-validate"|"deck-provision"|"strip-kit"|"bootstrap"|"discovery"; tier: "auto"|"semi"|"manual"; timeoutMs?: number; run(ctx): Promise<CaseResult> }`. `ALL_CASES: Case[]` from `cases/index.mts`. `run.mts` parses `--kind`, `--vm`, `--case`, filters `ALL_CASES`, runs each, prints `renderReport`, `process.exit(exitCode(...))`.

- [ ] **Step 1: Write the failing test** — assert a payload case validates a ROG bundle without a VM.

```ts
// test/e2e/cases/payload.test.ts
import { describe, it, expect } from "vitest";
import { payloadCases } from "./payload.mts";

describe("payload-validate cases", () => {
  it("the ROG local-account bundle case passes on generated output", async () => {
    const c = payloadCases.find(c => c.id === "payload:rog-local")!;
    const res = await c.run({} as any);
    expect(res.pass, res.failures.join("; ")).toBe(true);
  });
  it("the MSA autounattend case asserts the semi-attended path", async () => {
    const c = payloadCases.find(c => c.id === "payload:autounattend-msa")!;
    const res = await c.run({} as any);
    expect(res.pass, res.failures.join("; ")).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL.

- [ ] **Step 3: Implement the payload cases** (uses only generators — deterministic, VM-free).

```ts
// test/e2e/cases/payload.mts
import { genUsbBundle, genAutounattend, genDeckBundle } from "../lib/generate.mts";
import { bundleHasFile, textContains } from "../lib/assert.mts";
import type { CaseResult } from "../lib/report.mts";

export interface Case {
  id: string; vm: string; kind: string; tier: "auto"|"semi"|"manual";
  timeoutMs?: number; run(ctx: unknown): Promise<CaseResult>;
}
const ok = (id: string, tier: "auto"|"semi"|"manual", failures: (string|null)[]): CaseResult =>
  ({ id, vm: "none", tier, pass: failures.every(f => f == null), failures: failures.filter((f): f is string => !!f) });

export const payloadCases: Case[] = [
  {
    id: "payload:rog-local", vm: "none", kind: "payload-validate", tier: "auto",
    async run() {
      const files = genUsbBundle({ account: { mode: "local", username: "gavin" }, edition: "home",
        selectedApps: [], modules: [] } as any);
      return ok("payload:rog-local", "auto", [
        bundleHasFile(files, "autounattend.xml"),
        bundleHasFile(files, "sources/$OEM$/$1/bootible/bootstrap.ps1"),
        bundleHasFile(files, "sources/$OEM$/$1/bootible/config.yml"),
      ]);
    },
  },
  {
    id: "payload:autounattend-msa", vm: "none", kind: "payload-validate", tier: "auto",
    async run() {
      const xml = genAutounattend({ account: { mode: "microsoft" }, edition: "Windows 11 Pro",
        locale: "en-NZ", uiLanguage: "en-GB" } as any);
      return ok("payload:autounattend-msa", "auto", [
        textContains(xml, "HideOnlineAccountScreens>false", "MSA semi-attended"),
        xml.includes("<LocalAccounts>") ? "MSA mode must NOT emit LocalAccounts" : null,
      ]);
    },
  },
  {
    id: "payload:deck-bundle", vm: "none", kind: "payload-validate", tier: "auto",
    async run() {
      const files = genDeckBundle({ flatpakApps: ["flatseal"], ssh: { enabled: true, port: 22, authorizedKeys: [] } });
      return ok("payload:deck-bundle", "auto", [
        bundleHasFile(files, "bootible/provision.sh"),
        bundleHasFile(files, "bootible/config.json"),
      ]);
    },
  },
];
```

Add the three pass-throughs to `generate.mts` (verify exact core signatures first):
```ts
export function genUsbBundle(req: any) { return buildUsbBundle(req); }        // import { buildUsbBundle }
export function genAutounattend(cfg: any) { return generateAutounattend(cfg); } // import { generateAutounattend }
export function genDeckBundle(cfg: any) { return buildDeckBundle(withTiKey(cfg)); } // import { buildDeckBundle }
```

- [ ] **Step 4: Implement `cases/index.mts` + `run.mts`**

```ts
// test/e2e/cases/index.mts
import { payloadCases, type Case } from "./payload.mts";
export const ALL_CASES: Case[] = [...payloadCases];
```
```ts
// test/e2e/run.mts
import { ALL_CASES } from "./cases/index.mts";
import { renderReport, exitCode, type CaseResult } from "./lib/report.mts";
const args = process.argv.slice(2);
const opt = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const kind = opt("--kind"), vm = opt("--vm"), only = opt("--case");
const selected = ALL_CASES.filter(c =>
  (!kind || c.kind === kind) && (!vm || c.vm === vm) && (!only || c.id === only));
const results: CaseResult[] = [];
for (const c of selected) {
  try { results.push(await c.run({})); }
  catch (e) { results.push({ id: c.id, vm: c.vm, tier: c.tier, pass: false, failures: [String(e)] }); }
}
console.log(renderReport(results));
process.exit(exitCode(results));
```

- [ ] **Step 5: Run the harness with no VM**

Run: `npm run test:e2e -- --kind payload-validate`
Expected: all payload cases PASS, exit 0. Also `npx vitest run test/e2e/cases/payload.test.ts` PASS.

- [ ] **Step 6: Commit**

```bash
git add test/e2e/cases/ test/e2e/run.mts test/e2e/lib/generate.mts
git commit -m "test(e2e): payload-validate kind + run.mts (VM-free, first green loop)"
```

---

## Task 6: `ti` driver (`ti.mts`)

**Files:**
- Create: `test/e2e/lib/ti.mts`
- Test: `test/e2e/lib/ti.test.ts`

**Interfaces:**
- Produces: `tiCommand(module: string, verb: string, vm: string): string[]` (pwsh argv builder — pure, unit-testable); `up(vm)`, `reset(vm)`, `down(vm)`, `ip(vm)` async runners that `execFile("pwsh", tiCommand(...))`. Only the argv builder is unit-tested; the runners are exercised by the elevated VM run.

- [ ] **Step 1: Write the failing test** (pure argv builder — no pwsh executed)

```ts
// test/e2e/lib/ti.test.ts
import { describe, it, expect } from "vitest";
import { tiCommand } from "./ti.mts";

describe("ti argv builder", () => {
  it("imports the module and runs the verb non-interactively", () => {
    const argv = tiCommand("G:/x/ti/ti.psd1", "reset", "bazzite");
    expect(argv[0]).toBe("-NoProfile");
    const cmd = argv.join(" ");
    expect(cmd).toContain("Import-Module 'G:/x/ti/ti.psd1'");
    expect(cmd).toContain("ti reset bazzite");
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL.

- [ ] **Step 3: Implement**

```ts
// test/e2e/lib/ti.mts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const pexec = promisify(execFile);

export function tiCommand(module: string, verb: string, vm: string): string[] {
  return ["-NoProfile", "-NonInteractive", "-Command",
    `Import-Module '${module}'; ti ${verb} ${vm}`];
}
async function runTi(module: string, verb: string, vm: string, timeoutMs = 180_000): Promise<string> {
  const { stdout } = await pexec("pwsh", tiCommand(module, verb, vm), { timeout: timeoutMs });
  return stdout;
}
export const up = (m: string, vm: string) => runTi(m, "up", vm);
export const reset = (m: string, vm: string) => runTi(m, "reset", vm);
export const down = (m: string, vm: string) => runTi(m, "down", vm);
export const ip = (m: string, vm: string) => runTi(m, "ip", vm);
```

- [ ] **Step 4: Run to verify it passes** → `npx vitest run test/e2e/lib/ti.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add test/e2e/lib/ti.mts test/e2e/lib/ti.test.ts
git commit -m "test(e2e): ti driver (pwsh argv builder + lifecycle runners)"
```

---

## Task 7: Remote runner (`remote.mts`)

**Files:**
- Create: `test/e2e/lib/remote.mts`
- Test: `test/e2e/lib/remote.test.ts`

**Interfaces:**
- Produces pure argv builders `sshArgs(key,user,ip,{tty?})`, `scpArgs(key,src,user,ip,dst)`; async `runBash(t: Target, script: string, key: string, timeoutMs): Promise<{code:number; out:string}>` (pipes the script to `ssh … bash -s`), `runPwsh(t, script, key, timeoutMs)` (pipes to Windows `powershell -`), `push(t, localPath, remotePath, key)`, `readFile(t, remotePath, key)`.

- [ ] **Step 1: Write the failing test** (argv builders only)

```ts
// test/e2e/lib/remote.test.ts
import { describe, it, expect } from "vitest";
import { sshArgs, scpArgs } from "./remote.mts";

describe("remote argv builders", () => {
  it("ssh uses the key, disables host-key prompts, no tty by default", () => {
    const a = sshArgs("K", "test-infra", "172.30.90.13").join(" ");
    expect(a).toContain("-i K");
    expect(a).toContain("StrictHostKeyChecking=accept-new");
    expect(a).toContain("test-infra@172.30.90.13");
    expect(a).not.toContain("-tt");
  });
  it("ssh adds -tt only when tty requested", () => {
    expect(sshArgs("K", "u", "1.1.1.1", { tty: true })).toContain("-tt");
  });
  it("scp targets user@ip:dst", () => {
    expect(scpArgs("K", "a.sh", "u", "1.1.1.1", "~/a.sh").join(" ")).toContain("u@1.1.1.1:~/a.sh");
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL.

- [ ] **Step 3: Implement**

```ts
// test/e2e/lib/remote.mts
import { spawn } from "node:child_process";
import type { Target } from "./config.mts";

const BASE = ["-o", "ConnectTimeout=10", "-o", "StrictHostKeyChecking=accept-new", "-o", "ServerAliveInterval=5"];
export function sshArgs(key: string, user: string, ip: string, opts: { tty?: boolean } = {}): string[] {
  return [...(opts.tty ? ["-tt"] : []), "-i", key, ...BASE, `${user}@${ip}`];
}
export function scpArgs(key: string, src: string, user: string, ip: string, dst: string): string[] {
  return ["-i", key, ...BASE, src, `${user}@${ip}:${dst}`];
}
function run(cmd: string, args: string[], input: string | null, timeoutMs: number): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { timeout: timeoutMs });
    let out = ""; p.stdout.on("data", d => out += d); p.stderr.on("data", d => out += d);
    if (input != null) { p.stdin.write(input); p.stdin.end(); }
    p.on("close", code => resolve({ code: code ?? -1, out }));
    p.on("error", e => resolve({ code: -1, out: String(e) }));
  });
}
export function runBash(t: Target, script: string, key: string, timeoutMs = 240_000) {
  return run("ssh", [...sshArgs(key, t.user, t.ip), "bash -s"], script, timeoutMs);
}
export function runPwsh(t: Target, script: string, key: string, timeoutMs = 240_000) {
  return run("ssh", [...sshArgs(key, t.user, t.ip), "powershell -NoProfile -Command -"], script, timeoutMs);
}
export function push(t: Target, local: string, remote: string, key: string) {
  return run("scp", scpArgs(key, local, t.user, t.ip, remote), null, 120_000);
}
```

- [ ] **Step 4: Run to verify it passes** → PASS.

- [ ] **Step 5: Commit**

```bash
git add test/e2e/lib/remote.mts test/e2e/lib/remote.test.ts
git commit -m "test(e2e): remote runner (ssh/scp argv builders + bash/pwsh exec)"
```

---

## Task 8: `deck-provision` kind + bazzite cases (isolation + minimal + everything-on)

**Files:**
- Create: `test/e2e/cases/deck.mts`
- Modify: `test/e2e/cases/index.mts` (add `deckCases`), `test/e2e/lib/assert.mts` (add remote probes)
- Test: `test/e2e/cases/deck.test.ts` (shape only — validates every case bakes the ti key + has a timeout)

**Interfaces:**
- Consumes: `genDeckProvision`, `runBash`/`push`, `receiptHasOk`, remote probes.
- Produces: `deckCases: Case[]`; a `deckCase(id, config, expectOk[], timeoutMs?)` factory that: `ti.reset(vm)` → write provision.sh to a temp file → `push` → `runBash("bash ~/provision.sh")` → `readFile ~/.bootible/receipt` → assert each `expectOk` line + no unexpected `WARN`.
- Remote probes added to `assert.mts`: `flatpakInstalled(t,key,ref)`, `serviceEnabled(t,key,unit)`, `commandOnPath(t,key,bin)` — each `runBash` a one-liner and return `string|null`.

- [ ] **Step 1: Write the failing test (shape guard — the load-bearing correctness property, VM-free)**

```ts
// test/e2e/cases/deck.test.ts
import { describe, it, expect } from "vitest";
import { deckCases } from "./deck.mts";
import { TI_PUBKEY } from "../lib/generate.mts";
import { genDeckProvision } from "../lib/generate.mts";

describe("deck-provision cases", () => {
  it("every case bakes the ti key (no lockout) and sets a timeout", () => {
    for (const c of deckCases) {
      expect(c.timeoutMs, `${c.id} needs a timeout`).toBeGreaterThan(0);
    }
  });
  it("the everything-on config still emits the ti key", () => {
    const full = deckCases.find(c => c.id === "deck:everything-on")!;
    // config is attached for introspection:
    expect((full as any).config.ssh.authorizedKeys).toContain(TI_PUBKEY);
    expect(genDeckProvision((full as any).config)).toContain("ti test infrastructure");
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL.

- [ ] **Step 3: Implement `deck.mts`** (config-carrying cases + the run factory)

```ts
// test/e2e/cases/deck.mts
import type { Case } from "./payload.mts";
import type { CaseResult } from "../lib/report.mts";
import { loadConfig } from "../lib/config.mts";
import { withTiKey, genDeckProvision } from "../lib/generate.mts";
import { push, runBash } from "../lib/remote.mts";
import { reset } from "../lib/ti.mts";
import { receiptHasOk } from "../lib/assert.mts";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const KEY = "static-ip"; // marker; real key path from loadConfig()

function deckCase(id: string, config: any, expectOk: string[], timeoutMs = 240_000): Case & { config: any } {
  return {
    id, vm: "bazzite", kind: "deck-provision", tier: "auto", timeoutMs, config: withTiKey(config),
    async run(): Promise<CaseResult> {
      const cfg = loadConfig(); const t = cfg.targets.bazzite;
      await reset(cfg.tiModule, "bazzite");
      const sh = genDeckProvision(config);
      const tmp = join(tmpdir(), `${id.replace(/[:]/g, "_")}.sh`);
      writeFileSync(tmp, sh);
      await push(t, tmp, "~/provision.sh", cfg.keyPath);
      const r = await runBash(t, "bash ~/provision.sh; echo EXIT=$?", cfg.keyPath, timeoutMs);
      const receipt = (await runBash(t, "cat ~/.bootible/receipt", cfg.keyPath)).out;
      const failures = [
        r.out.includes("EXIT=0") ? null : `provision exited non-zero`,
        ...expectOk.map(step => receiptHasOk(receipt, step)),
      ].filter((f): f is string => !!f);
      return { id, vm: "bazzite", tier: "auto", pass: failures.length === 0, failures };
    },
  };
}

const base = { ssh: { enabled: true, port: 22, authorizedKeys: [] } };
export const deckCases: (Case & { config: any })[] = [
  deckCase("deck:minimal", { ...base, createSnapshot: false, flatpakApps: ["flatseal"] },
    ["flathub ready", "flatpak apps done", "ssh ready"]),
  deckCase("deck:flatpak-apps", { ...base, flatpakApps: ["flatseal", "vlc", "discord"] },
    ["flatpak apps done"]),
  deckCase("deck:default-browser", { ...base, flatpakApps: ["chrome"], defaultBrowser: "chrome" },
    ["default browser: Chrome"]),
  deckCase("deck:tailscale", { ...base, tailscale: true },
    ["Trayscale installed"]),
  deckCase("deck:sunshine", { ...base, sunshine: { enabled: true, user: "nerdz", pass: "x" } },
    ["Sunshine credentials set"]),
  deckCase("deck:vnc", { ...base, vnc: true }, ["flatpak apps done"]),
  deckCase("deck:static-ip", { ...base, staticIp: { iface: "wifi", ip: "172.30.90.13", prefix: 24 } },
    ["static IP"]),
  deckCase("deck:stickdeck", { ...base, stickdeck: true }, ["StickDeck installed"]),
  deckCase("deck:pw-flatpak", { ...base, passwordManagers: { managers: ["bitwarden"], method: "flatpak" } },
    ["flatpak apps done"]),
  deckCase("deck:pw-distrobox", { ...base, passwordManagers: { managers: ["bitwarden"], method: "distrobox" } },
    ["ssh ready"], 900_000),
  deckCase("deck:everything-on", {
    ...base, hostname: "ti-bazzite", flatpakApps: ["flatseal", "vlc"], tailscale: true,
    sunshine: { enabled: true, user: "nerdz", pass: "x" }, vnc: true, stickdeck: true, waydroid: true,
    passwordManagers: { managers: ["bitwarden"], method: "distrobox" },
  }, ["flatpak apps done", "ssh ready", "Trayscale installed"], 900_000),
];
```

Add remote probes to `assert.mts`:
```ts
import { runBash } from "./remote.mts"; import type { Target } from "./config.mts";
export async function commandOnPath(t: Target, key: string, bin: string): Promise<string | null> {
  const r = await runBash(t, `command -v ${bin} >/dev/null && echo Y || echo N`, key);
  return r.out.includes("Y") ? null : `${bin} not on PATH`;
}
export async function flatpakInstalled(t: Target, key: string, ref: string): Promise<string | null> {
  const r = await runBash(t, `flatpak list --app --columns=application`, key);
  return r.out.includes(ref) ? null : `flatpak ${ref} not installed`;
}
```

Register in `index.mts`: `import { deckCases } from "./deck.mts"; export const ALL_CASES = [...payloadCases, ...deckCases];`

- [ ] **Step 4: Run the shape test** → `npx vitest run test/e2e/cases/deck.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add test/e2e/cases/deck.mts test/e2e/cases/deck.test.ts test/e2e/cases/index.mts test/e2e/lib/assert.mts
git commit -m "test(e2e): deck-provision kind + bazzite isolation/full cases"
```

---

## Task 9: Verify the Deck suite on real bazzite (elevated run — verification, not code)

**Files:** none (verification task).

- [ ] **Step 1: From an ELEVATED pwsh, run the Deck suite**

Run: `npm run test:e2e -- --vm bazzite`
Expected: each isolation case + `everything-on` boots pristine bazzite, runs provision.sh, and PASSES its receipt assertions; the report shows all `deck:*` PASS, exit 0. (This mirrors the manual 2026-07-05 validation.)

- [ ] **Step 2: If a case fails, triage with the systematic-debugging skill** — the receipt line names the failing step. Distinguish a real provision.sh bug (fix in `packages/core`) from a proxy-limit (mark the step Deck-only, drop the assertion for the proxy). Do NOT weaken an assertion to pass a real bug.

- [ ] **Step 3: Record the result** in the coverage-map artifact + spec if any classification changed.

---

## Task 10: Windows remote probes + `strip-kit` kind

**Files:**
- Create: `test/e2e/cases/strip.mts`
- Modify: `test/e2e/lib/assert.mts` (Windows probes), `test/e2e/cases/index.mts`
- Test: `test/e2e/cases/strip.test.ts` (shape: each strip case targets a Windows VM + has a timeout)

**Interfaces:**
- Produces Windows probes in `assert.mts`: `wingetListed(t,key,id)`, `regEquals(t,key,path,name,value)`, `appxAbsent(t,key,pattern)`, `portOpen(t,key,port)` — each `runPwsh` a one-liner, return `string|null`. `stripCases: Case[]` with a `stripCase(id, vm, req, checks, timeoutMs)` factory: `ti.reset(vm)` → `genStripKit(req)` → push the `.ps1`/`.bat` → `runPwsh` the elevated strip → run `checks`.

- [ ] **Step 1: Write the failing shape test**

```ts
// test/e2e/cases/strip.test.ts
import { describe, it, expect } from "vitest";
import { stripCases } from "./strip.mts";
describe("strip-kit cases", () => {
  it("target Windows VMs and carry timeouts", () => {
    for (const c of stripCases) {
      expect(["win11", "win11home"]).toContain(c.vm);
      expect(c.timeoutMs).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL.

- [ ] **Step 3: Implement `strip.mts`** — factory + `win11` full-strip case + `win11home` case. Push the generated `bootible.ps1`/`bootible.bat` to `C:\bootible\`, run elevated via `runPwsh`, poll for `strip.done`, then run Windows probes (`wingetListed` for an installed app, `appxAbsent` for a removed one, `regEquals` for a floor tweak, hostname unchanged). Add the Windows probes to `assert.mts` using `runPwsh`.

```ts
// probes (assert.mts)
export async function wingetListed(t: Target, key: string, id: string): Promise<string | null> {
  const r = await runPwsh(t, `winget list --id ${id} -e 2>$null | Select-String ${id}`, key);
  return r.out.includes(id) ? null : `winget ${id} not installed`;
}
export async function regEquals(t: Target, key: string, path: string, name: string, val: string): Promise<string | null> {
  const r = await runPwsh(t, `(Get-ItemProperty '${path}' -Name '${name}' -EA SilentlyContinue).'${name}'`, key);
  return r.out.trim() === val ? null : `${path}\\${name} != ${val} (got ${r.out.trim()})`;
}
```

- [ ] **Step 4: Run the shape test** → PASS.

- [ ] **Step 5: Commit**

```bash
git add test/e2e/cases/strip.mts test/e2e/cases/strip.test.ts test/e2e/lib/assert.mts test/e2e/cases/index.mts
git commit -m "test(e2e): strip-kit kind + Windows remote probes"
```

---

## Task 11: `bootstrap` kind — RDP (Pro) + edition gating + SSH-on-Windows

**Files:**
- Create: `test/e2e/cases/bootstrap.mts`
- Modify: `test/e2e/lib/assert.mts` (`portOpen`, `rdpEnabled`), `test/e2e/cases/index.mts`
- Test: `test/e2e/cases/bootstrap.test.ts` (RDP module present for Pro+rdp, absent for Home)

**Interfaces:**
- Produces `bootstrapCases: Case[]`. RDP case (win11, Pro): resolve modules for `{edition:"pro", remoteAccess:{rdp:true}}`, run the `remote-desktop` module on the VM, assert `fDenyTSConnections=0` + firewall group enabled + `portOpen(3389)`. Home negative case (win11home): assert `resolveModules` does NOT include `remote-desktop`. Uses `provisioning-plan`'s `resolveModules` from core for the gating assertion (pure, no VM).

- [ ] **Step 1: Write the failing test** (edition gating is pure — assert without a VM)

```ts
// test/e2e/cases/bootstrap.test.ts
import { describe, it, expect } from "vitest";
import { resolveModules } from "@bootible/core";
describe("RDP edition gating", () => {
  it("Pro + rdp adds remote-desktop", () => {
    expect(resolveModules({ edition: "pro", remoteAccess: { rdp: true } } as any)).toContain("remote-desktop");
  });
  it("Home + rdp does NOT add remote-desktop", () => {
    expect(resolveModules({ edition: "home", remoteAccess: { rdp: true } } as any)).not.toContain("remote-desktop");
  });
});
```

- [ ] **Step 2: Run to verify it fails/passes** — verify exact `resolveModules` signature in `provisioning-plan.ts`; adjust the arg shape to match. Run `npx vitest run test/e2e/cases/bootstrap.test.ts`.

- [ ] **Step 3: Implement `bootstrap.mts`** — the RDP VM case (assert `fDenyTSConnections`, firewall, `portOpen(t,key,3389)`), the SSH-on-Windows case (`ssh-key` module → assert `sshd` running + key in `administrators_authorized_keys`), and the MSA case (tier `semi`, `skipped: "manual OOBE sign-in with test MSA"` — asserts the generated autounattend's semi-attended path only). Add `portOpen`:

```ts
export async function portOpen(t: Target, key: string, port: number): Promise<string | null> {
  const r = await runPwsh(t, `(Test-NetConnection localhost -Port ${port}).TcpTestSucceeded`, key);
  return /true/i.test(r.out) ? null : `port ${port} not open`;
}
```

- [ ] **Step 4: Run the test** → PASS.

- [ ] **Step 5: Commit**

```bash
git add test/e2e/cases/bootstrap.mts test/e2e/cases/bootstrap.test.ts test/e2e/lib/assert.mts test/e2e/cases/index.mts
git commit -m "test(e2e): bootstrap kind — RDP Pro-gating + SSH-on-Windows + MSA (semi)"
```

---

## Task 12: Verify the Windows suite on real win11/win11home (elevated run)

**Files:** none (verification task).

- [ ] **Step 1: From an ELEVATED pwsh, run the Windows suite**

Run: `npm run test:e2e -- --vm win11` then `--vm win11home`
Expected: strip-kit cases install/remove/tune and PASS their probes; RDP case shows `fDenyTSConnections=0` + `:3389` open on win11; win11home confirms RDP absent; MSA case reports SKIP (manual). Report exit 0.

- [ ] **Step 2: Triage failures** with systematic-debugging. This is the **first-ever execution** of these PowerShell scripts — expect to find real bugs (that's the point). Fix in `packages/core`; re-run.

- [ ] **Step 3: Update the coverage-map artifact** — flip the affected `strip`/`usb` rows from "never executed" to covered.

---

## Task 13: Discovery listener gap + end-to-end host↔guest beacon

**Files:**
- Create: `test/e2e/cases/discovery.mts`; a listener parser test if the desktop parser is untested (locate the beacon-receiver in `packages/app/src/main` — the survey found it has no test).
- Modify: `test/e2e/cases/index.mts`
- Test: `test/e2e/cases/discovery.test.ts`

**Interfaces:**
- Produces: a unit test for the beacon **parser** (feed a crafted `{bootible:1,buildId,ip,hostname,username,status:"done"}` UDP payload, assert it parses to a `DiscoveredDevice` with `mine` set when the buildId matches). An end-to-end case: bake a known `buildId` into a Deck config, run provision on bazzite, and from the host bind a UDP socket on `:50474` for ~30 s asserting the beacon arrives with that buildId (ti-net carries multicast/broadcast host↔guest).

- [ ] **Step 1: Write the failing parser test**

```ts
// test/e2e/cases/discovery.test.ts
import { describe, it, expect } from "vitest";
// import { parseBeacon } from "@bootible/core"  // or the main-process module the survey identifies
import { parseBeacon } from "../../packages/core/src/beacon.ts"; // adjust to the real receiver location
describe("beacon parser", () => {
  it("parses a done beacon and flags mine on buildId match", () => {
    const payload = JSON.stringify({ bootible: 1, buildId: "abc123", ip: "172.30.90.13",
      hostname: "ti-bazzite", username: "test-infra", status: "done" });
    const d = parseBeacon(Buffer.from(payload), "abc123");
    expect(d?.hostname).toBe("ti-bazzite");
    expect(d?.mine).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — if `parseBeacon` doesn't exist as an isolated function, this is the gap: extract the parse logic in `packages/core` (or the main module) into a pure, testable `parseBeacon(buf, myBuildId)` and wire the existing listener to it. That extraction is the fix.

- [ ] **Step 3: Implement the extraction + the end-to-end case** — pure `parseBeacon`; the E2E discovery case binds a `node:dgram` socket on the host, runs the Deck provision with a fixed buildId, and asserts a matching beacon is received within the window.

- [ ] **Step 4: Run** → parser test PASS; the E2E discovery case is verified in the elevated run.

- [ ] **Step 5: Commit**

```bash
git add test/e2e/cases/discovery.mts test/e2e/cases/discovery.test.ts packages/core/src/beacon.ts
git commit -m "test(e2e): beacon parser unit + end-to-end host<->guest discovery"
```

---

## Task 14: Docs — wire the harness into the coverage map + TESTING.md

**Files:**
- Modify: `docs/ai-context/TESTING.md` (gitignored local doc — add a "Running the E2E harness" section), `test/e2e/README.md`

- [ ] **Step 1** Document the four kinds, the elevated-run requirement, the ti-key rule, and the per-VM commands. Note which rows in the coverage-map artifact each kind flips from gap → covered.
- [ ] **Step 2: Commit**

```bash
git add test/e2e/README.md
git commit -m "docs(e2e): harness usage + coverage-map cross-reference"
```

---

## Self-Review

**Spec coverage:**
- payload-validate (spec §Components/kinds) → Task 5 ✓
- deck-provision + isolation cases (spec §Coverage) → Tasks 8–9 ✓
- strip-kit on win11/win11home (spec §Targets) → Tasks 10, 12 ✓
- RDP Pro + edition gating; MS-account config-auto + sign-in semi (spec §Windows Pro) → Task 11 ✓
- ti driver / remote runner / assert / reporter / case matrix (spec §Components) → Tasks 1,3,4,6,7 ✓
- ti-key gotcha (spec §Constraints) → Task 2 (`withTiKey`) + Task 8 shape test ✓
- SteamOS-proxy limits stay manual (spec §Constraints) → Task 9 Step 2 triage rule ✓
- discovery listener gap + end-to-end beacon (spec §Coverage gaps) → Task 13 ✓
- USB write + MSA = manual/semi (spec §Out of scope) → Task 11 MSA `skipped`; USB not a case ✓
- Success criteria 1–5 → Tasks 5, 9, 11/12, 4 (reporter), 2/8 (ti key) ✓

**Placeholder scan:** every code step carries real code; VM-run tasks (9, 12) are explicit verification steps, not placeholders. Case data is complete data, not "similar to". OK.

**Type consistency:** `Case`, `CaseResult`, `Target`, `E2EConfig` names are stable across tasks; probe helpers uniformly return `string | null`; `withTiKey`/`TI_PUBKEY` referenced consistently. `resolveModules`/`buildUsbBundle`/`generateAutounattend`/`buildDeckBundle` are marked "verify exact core signature before writing" where the barrel export isn't yet confirmed — the one place to check core, called out at first use.
