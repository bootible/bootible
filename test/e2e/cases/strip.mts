import type { Case } from "./payload.mts";
import type { CaseResult } from "../lib/report.mts";
import { loadConfig } from "../lib/config.mts";
import { genStripKit, type StripKitRequest } from "../lib/generate.mts";
import { push, runPwsh } from "../lib/remote.mts";
import { reset } from "../lib/ti.mts";
import { wingetListed, regEquals, appxAbsent } from "../lib/assert.mts";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface StripCheck {
  name: string;
  run(t: { ip: string; user: string; os: "linux" | "windows" }, key: string): Promise<string | null>;
}

function stripCase(
  id: string,
  vm: "win11" | "win11home",
  req: StripKitRequest,
  checks: StripCheck[],
  timeoutMs = 900_000,
): Case & { req: StripKitRequest } {
  return {
    id,
    vm,
    kind: "strip-kit",
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
        r.code === 0 ? null : `strip script exited non-zero (code ${r.code})`,
      ];
      for (const check of checks) {
        failures.push(await check.run(t, cfg.keyPath));
      }
      return { id, vm, tier: "auto", pass: failures.every((f) => f == null), failures: failures.filter((f): f is string => !!f) };
    },
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
    return r.out.trim() === expected ? null : `hostname changed (expected ${expected}, got ${r.out.trim()})`;
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
