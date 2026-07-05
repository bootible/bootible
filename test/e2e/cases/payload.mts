import type { UsbBuildSpec } from "@bootible/core";
import { genAutounattend, genDeckBundle, genUsbBundle } from "../lib/generate.mts";
import { bundleHasFile, textContains } from "../lib/assert.mts";
import type { CaseResult } from "../lib/report.mts";

export interface Case {
  id: string;
  vm: string;
  kind: string;
  tier: "auto" | "semi" | "manual";
  timeoutMs?: number;
  run(ctx: unknown): Promise<CaseResult>;
}

const ok = (id: string, tier: "auto" | "semi" | "manual", failures: (string | null)[]): CaseResult => ({
  id,
  vm: "none",
  tier,
  pass: failures.every((f) => f == null),
  failures: failures.filter((f): f is string => !!f),
});

// Mirrors the shape validated in packages/core/src/bundle.test.ts — a real
// (fake-hardware) ROG Ally, local-account onboard config.
const rogLocalSpec: UsbBuildSpec = {
  device: { id: "rog-ally", name: "ROG Ally", provisioning_models: ["on-device"] },
  config: { schema: 2, device: "rog-ally", groups: ["system"] },
  account: { mode: "local", username: "gavin", password: "hunter2" },
};

export const payloadCases: Case[] = [
  {
    id: "payload:rog-local",
    vm: "none",
    kind: "payload-validate",
    tier: "auto",
    async run() {
      const files = genUsbBundle(rogLocalSpec);
      return ok("payload:rog-local", "auto", [
        bundleHasFile(files, "autounattend.xml"),
        bundleHasFile(files, "sources/$OEM$/$1/bootible/bootstrap.ps1"),
        bundleHasFile(files, "sources/$OEM$/$1/bootible/config.yml"),
      ]);
    },
  },
  {
    id: "payload:autounattend-msa",
    vm: "none",
    kind: "payload-validate",
    tier: "auto",
    async run() {
      const xml = genAutounattend({
        account: { mode: "microsoft" },
        edition: "Windows 11 Pro",
        locale: "en-NZ",
        uiLanguage: "en-GB",
        firstLogonCommand: "powershell.exe -ExecutionPolicy Bypass -File C:\\bootible\\bootstrap.ps1",
      });
      return ok("payload:autounattend-msa", "auto", [
        textContains(xml, "<HideOnlineAccountScreens>false</HideOnlineAccountScreens>", "MSA semi-attended"),
        xml.includes("<LocalAccounts>") ? "MSA mode must NOT emit LocalAccounts" : null,
      ]);
    },
  },
  {
    id: "payload:deck-bundle",
    vm: "none",
    kind: "payload-validate",
    tier: "auto",
    async run() {
      const files = genDeckBundle({
        flatpakApps: ["flatseal"],
        ssh: { enabled: true, port: 22, authorizedKeys: [] },
      });
      return ok("payload:deck-bundle", "auto", [
        bundleHasFile(files, "bootible/provision.sh"),
        bundleHasFile(files, "bootible/config.json"),
      ]);
    },
  },
];
