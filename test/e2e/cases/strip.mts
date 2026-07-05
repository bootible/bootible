import type { Case } from "./payload.mts";
import { genStripKit, type StripKitRequest } from "../lib/generate.mts";
import { winModuleCase, type VmCheck } from "../lib/vmcase.mts";
import { wingetListed, regEquals, appxAbsent } from "../lib/assert.mts";
import { runPwsh } from "../lib/remote.mts";

export type StripCheck = VmCheck;

function stripCase(
  id: string,
  vm: "win11" | "win11home",
  req: StripKitRequest,
  checks: StripCheck[],
  timeoutMs = 900_000,
): Case & { req: StripKitRequest } {
  return {
    ...winModuleCase({
      id,
      vm,
      kind: "strip-kit",
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
      failLabel: "strip script",
    }),
    req,
  };
}

const winget = (id: string): StripCheck => ({
  name: `winget:${id}`,
  run: (t, key) => wingetListed(t, key, id),
});
const appxGone = (pattern: string): StripCheck => ({
  name: `appx-absent:${pattern}`,
  run: (t, key) => appxAbsent(t, key, pattern),
});
const reg = (path: string, name: string, val: string): StripCheck => ({
  name: `reg:${path}\\${name}`,
  run: (t, key) => regEquals(t, key, path, name, val),
});
const hostnameUnchanged = (expected: string): StripCheck => ({
  name: "hostname unchanged",
  run: async (t, key) => {
    const r = await runPwsh(t, "$env:COMPUTERNAME", key);
    return r.stdout.trim() === expected ? null : `hostname changed (expected ${expected}, got ${r.stdout.trim()})`;
  },
});

export const stripCases: (Case & { req: StripKitRequest })[] = [
  stripCase(
    "strip:win11-full",
    "win11",
    {
      modules: ["power", "windows-defaults", "apps"],
      settings: {
        sleep_mode: "hibernate",
        hibernate_after_minutes: 30,
        power_button_action: "sleep",
        disable_cpu_boost_on_battery: true,
        strip_removals: ["mcafee", "glidex"],
        selected_apps: ["vlc"],
      },
    },
    [
      winget("VideoLAN.VLC"),
      appxGone("*Glidex*"),
      reg(
        "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsCopilot",
        "TurnOffWindowsCopilot",
        "1",
      ),
      hostnameUnchanged("WIN11-TI"),
    ],
  ),
  stripCase(
    "strip:win11home-minimal",
    "win11home",
    {
      settings: { sleep_mode: "hibernate" },
    },
    [
      appxGone("*McAfee*"),
      reg(
        "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsCopilot",
        "TurnOffWindowsCopilot",
        "1",
      ),
      hostnameUnchanged("WIN11HOME-TI"),
    ],
  ),
];
