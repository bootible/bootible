import type { Case } from "./payload.mts";
import type { CaseResult } from "../lib/report.mts";
import type { Target } from "../lib/config.mts";
import { loadConfig } from "../lib/config.mts";
import { genStripKit, genAutounattend, TI_PUBKEY, type StripKitRequest } from "../lib/generate.mts";
import { push, runPwsh } from "../lib/remote.mts";
import { reset } from "../lib/ti.mts";
import { regEquals, firewallGroupEnabled, portOpen, serviceRunning, fileContains, textContains } from "../lib/assert.mts";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

interface BootstrapCheck {
  name: string;
  run(t: Target, key: string): Promise<string | null>;
}

/** Run a module via the same strip-kit generator strip.mts uses (it walks
 *  allyCatalog and calls mod.apply for every selected module id), then assert
 *  the module's effect on the VM. Mirrors stripCase in strip.mts. */
function bootstrapCase(
  id: string,
  vm: "win11" | "win11home",
  req: StripKitRequest,
  checks: BootstrapCheck[],
  timeoutMs = 300_000,
): Case & { req: StripKitRequest } {
  return {
    id,
    vm,
    kind: "bootstrap",
    tier: "auto",
    timeoutMs,
    req,
    async run(): Promise<CaseResult> {
      const cfg = loadConfig();
      const t = cfg.targets[vm];
      await reset(cfg.tiModule, vm);
      const kit = genStripKit(req);
      const scriptTmp = join(tmpdir(), `${id.replace(/[:]/g, "_")}.ps1`);
      const launcherTmp = join(tmpdir(), `${id.replace(/[:]/g, "_")}.bat`);
      writeFileSync(scriptTmp, kit.script);
      writeFileSync(launcherTmp, kit.launcher);
      await push(t, scriptTmp, "C:\\bootible\\bootible.ps1", cfg.keyPath);
      await push(t, launcherTmp, "C:\\bootible\\bootible.bat", cfg.keyPath);
      const r = await runPwsh(
        t,
        "powershell -NoProfile -ExecutionPolicy Bypass -File C:\\bootible\\bootible.ps1 -FromLauncher",
        cfg.keyPath,
        timeoutMs,
      );
      const failures: (string | null)[] = [
        r.code === 0 ? null : `bootstrap script exited non-zero (code ${r.code})`,
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

/** Windows Pro + RDP: the remote-desktop module clears fDenyTSConnections,
 *  enables the Remote Desktop firewall group, and 3389 answers. */
const rdpProCase: Case & { req: StripKitRequest } = bootstrapCase(
  "bootstrap:rdp-pro",
  "win11",
  { modules: ["remote-desktop"], settings: {} },
  [
    {
      name: "fDenyTSConnections=0",
      run: (t, key) =>
        regEquals(
          t,
          key,
          "HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server",
          "fDenyTSConnections",
          "0",
        ),
    },
    { name: "firewall group enabled", run: (t, key) => firewallGroupEnabled(t, key, "Remote Desktop") },
    { name: "port 3389 open", run: (t, key) => portOpen(t, key, 3389) },
  ],
);

/** SSH-on-Windows: the ssh-key module installs OpenSSH, starts sshd, and
 *  authorises the harness's test key in administrators_authorized_keys. */
const sshOnWindowsCase: Case & { req: StripKitRequest } = bootstrapCase(
  "bootstrap:ssh-on-windows",
  "win11",
  { modules: ["ssh-key"], settings: { ssh_public_keys: [TI_PUBKEY] } },
  [
    { name: "sshd running", run: (t, key) => serviceRunning(t, key, "sshd") },
    {
      name: "key authorised",
      run: (t, key) =>
        fileContains(t, key, "$env:ProgramData\\ssh\\administrators_authorized_keys", TI_PUBKEY),
    },
  ],
);

/** MSA sign-in stays semi-attended: OOBE keeps the online-account screens and
 *  never falls back to a baked LocalAccounts answer. Pure — asserts the
 *  generated autounattend only; the actual OOBE sign-in is manual (Gavin). A
 *  skipped case never fails the overall run (see report.mts exitCode). */
const msaSemiCase: Case = {
  id: "bootstrap:msa-semi",
  vm: "win11",
  kind: "bootstrap",
  tier: "semi",
  async run(): Promise<CaseResult> {
    const xml = genAutounattend({
      account: { mode: "microsoft" },
      edition: "Windows 11 Pro",
      locale: "en-NZ",
      uiLanguage: "en-GB",
      firstLogonCommand: "powershell.exe -ExecutionPolicy Bypass -File C:\\bootible\\bootstrap.ps1",
    });
    const failures = [
      textContains(xml, "<HideOnlineAccountScreens>false</HideOnlineAccountScreens>", "MSA semi-attended"),
      xml.includes("<LocalAccounts>") ? "MSA mode must NOT emit LocalAccounts" : null,
    ].filter((f): f is string => !!f);
    return {
      id: "bootstrap:msa-semi",
      vm: "win11",
      tier: "semi",
      pass: failures.length === 0,
      failures,
      skipped: "manual OOBE sign-in with test MSA",
    };
  },
};

export const bootstrapCases: Case[] = [rdpProCase, sshOnWindowsCase, msaSemiCase];
