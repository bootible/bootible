import type { Case } from "./payload.mts";
import type { CaseResult } from "../lib/report.mts";
import { genStripKit, genAutounattend, TI_PUBKEY, type StripKitRequest } from "../lib/generate.mts";
import { winModuleCase, type VmCheck } from "../lib/vmcase.mts";
import { regEquals, firewallGroupEnabled, portOpen, serviceRunning, fileContains, textContains } from "../lib/assert.mts";

type BootstrapCheck = VmCheck;

/** Run a module via the same strip-kit generator strip.mts uses (it walks
 *  allyCatalog and calls mod.apply for every selected module id), then assert
 *  the module's effect on the VM. Thin wrapper over winModuleCase — mirrors
 *  stripCase in strip.mts. */
function bootstrapCase(
  id: string,
  vm: "win11" | "win11home",
  req: StripKitRequest,
  checks: BootstrapCheck[],
  timeoutMs = 300_000,
): Case & { req: StripKitRequest } {
  return {
    ...winModuleCase({
      id,
      vm,
      kind: "bootstrap",
      timeoutMs,
      genArtifacts: () => {
        const kit = genStripKit(req);
        return [
          { ext: "ps1", content: kit.script, remotePath: "C:\\bootible\\bootible.ps1" },
          { ext: "bat", content: kit.launcher, remotePath: "C:\\bootible\\bootible.bat" },
        ];
      },
      remoteScript: "powershell -NoProfile -ExecutionPolicy Bypass -File C:\\bootible\\bootible.ps1 -FromLauncher",
      checks,
      failLabel: "bootstrap script",
    }),
    req,
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
