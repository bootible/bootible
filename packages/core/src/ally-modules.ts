import type { BootibleModule, ModuleGroup } from "./modules";
import { getServiceTrimCommands } from "./optimization";
import { getPowerConfigCommands } from "./power";
import { getWindowsDefaultsCommands } from "./windows-defaults";
import { getWingetInstallCommands } from "./winget";

/** Power & thermals — the first module ported from v1 (config/rog-ally). */
const power: BootibleModule = {
  id: "power",
  name: "Power & thermals",
  group: "system",
  summary: "Balanced power profile, sleep and hibernate behaviour.",
  apply(ctx, exec) {
    const settings = (ctx.config.settings ?? {}) as Record<string, unknown>;
    const commands = getPowerConfigCommands({
      sleepMode: settings.sleep_mode as string | undefined,
      hibernateAfterMinutes: settings.hibernate_after_minutes as number | undefined,
      powerButtonAction: settings.power_button_action as string | undefined,
      disableCpuBoostOnBattery: settings.disable_cpu_boost_on_battery as boolean | undefined,
    });
    if (commands.length === 0) {
      return { status: "skipped", detail: "no power settings configured" };
    }
    const actions: string[] = [];
    for (const args of commands) {
      exec(["powercfg", ...args]);
      actions.push(`powercfg ${args.join(" ")}`);
    }
    return { status: "applied", actions };
  },
};

/**
 * A module declared in the catalog but whose v1 PowerShell logic has not been
 * ported yet. It appears in the plan and reports honestly as planned, so the
 * step counts and the live log never overstate what bootible actually does.
 */
function planned(id: string, name: string, group: ModuleGroup, summary: string): BootibleModule {
  return {
    id,
    name,
    group,
    summary,
    apply: () => ({ status: "skipped", detail: "planned — not yet ported from v1" }),
  };
}

/** Run a fixed list of command arrays via the injected runner, recording them. */
function runCommands(exec: (cmd: string[]) => string, commands: string[][]): string[] {
  const actions: string[] = [];
  for (const args of commands) {
    exec(args);
    actions.push(args.join(" "));
  }
  return actions;
}

/**
 * An app-install module ported from v1 apps.ps1 — installs a set of verified
 * winget packages via the injected runner.
 */
function appInstall(
  id: string,
  name: string,
  summary: string,
  packageIds: string[],
): BootibleModule {
  return {
    id,
    name,
    group: "apps",
    summary,
    apply(_ctx, exec) {
      const commands = getWingetInstallCommands(packageIds);
      if (commands.length === 0) {
        return { status: "skipped", detail: "no packages configured" };
      }
      return { status: "applied", actions: runCommands(exec, commands) };
    },
  };
}

/** Windows defaults — curated debloat/registry tweaks ported from v1. */
const windowsDefaults: BootibleModule = {
  id: "windows-defaults",
  name: "Windows defaults",
  group: "system",
  summary: "Disable telemetry, Copilot & Bing search; show file extensions.",
  apply(_ctx, exec) {
    return { status: "applied", actions: runCommands(exec, getWindowsDefaultsCommands()) };
  },
};

/** Background trim — set non-essential services to manual (ported from v1). */
const backgroundTrim: BootibleModule = {
  id: "optimization",
  name: "Background trim",
  group: "performance",
  summary: "Set non-essential services (telemetry, maps, remote registry) to manual.",
  apply(_ctx, exec) {
    return { status: "applied", actions: runCommands(exec, getServiceTrimCommands()) };
  },
};

/** The ROG Ally / Windows module catalog, in run order. */
export const allyCatalog: BootibleModule[] = [
  power,
  planned(
    "controller",
    "Controller & input",
    "system",
    "Map buttons, enable gyro and trigger ranges.",
  ),
  planned("display", "Display & refresh", "system", "Native resolution, refresh rate and VRR."),
  windowsDefaults,
  backgroundTrim,
  planned(
    "health",
    "System health check",
    "performance",
    "Driver, storage and firmware sanity checks.",
  ),
  appInstall(
    "utilities",
    "Desktop utilities",
    "PowerToys, 7-Zip, Everything and Windows Terminal.",
    ["Microsoft.PowerToys", "7zip.7zip", "voidtools.Everything", "Microsoft.WindowsTerminal"],
  ),
  planned("emudeck", "EmuDeck", "apps", "Emulation frontend — kept current, never frozen."),
  appInstall("steam", "Steam", "Steam and Big Picture mode.", ["Valve.Steam"]),
  planned("streaming", "Game streaming", "apps", "Moonlight / Chiaki streaming clients."),
  planned(
    "sync-target",
    "Sync target & saves",
    "library",
    "Connect a target so saves and BIOS follow you.",
  ),
];
