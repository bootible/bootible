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
/** Strip must not rename the machine. Compares against the pristine VM's own
 *  name (captured before the script runs) rather than a hard-coded one — the
 *  golden images keep Windows' generated DESKTOP-xxxx name. */
const hostnameUnchanged = (): StripCheck => {
  let before = "";
  const hostname = async (t: Parameters<StripCheck["run"]>[0], key: string) =>
    (await runPwsh(t, "$env:COMPUTERNAME", key)).stdout.trim();
  return {
    name: "hostname unchanged",
    prepare: async (t, key) => {
      before = await hostname(t, key);
    },
    run: async (t, key) => {
      const after = await hostname(t, key);
      if (!before) return "hostname baseline was not captured";
      return after === before ? null : `hostname changed (was ${before}, now ${after})`;
    },
  };
};

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
      hostnameUnchanged(),
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
      hostnameUnchanged(),
    ],
  ),
];
