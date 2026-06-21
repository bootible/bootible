import type { Bundle } from "./bundles";
import { getDisplayTweakCommands } from "./display";
import type { BootibleModule, ModuleGroup, ModuleState } from "./modules";
import { getServiceTrimCommands } from "./optimization";
import { getPowerConfigCommands } from "./power";
import type { Exec } from "./secrets";
import { getWindowsDefaultsCommands } from "./windows-defaults";
import { getWingetInstallCommands } from "./winget";

/** Read a REG_DWORD value via `reg query`, or null if absent/unreadable. */
function regDword(exec: Exec, path: string, name: string): number | null {
  const out = exec(["reg", "query", path, "/v", name]);
  const match = out.match(/REG_DWORD\s+0x([0-9a-fA-F]+)/);
  return match ? Number.parseInt(match[1] ?? "", 16) : null;
}

/** "applied" when a registry DWORD already equals the wanted value. */
function regState(exec: Exec, path: string, name: string, want: number): ModuleState {
  return regDword(exec, path, name) === want ? "applied" : "pending";
}

/** Power & thermals — the first module ported from v1 (config/rog-ally). */
const power: BootibleModule = {
  id: "power",
  name: "Power & thermals",
  group: "system",
  description: "Hibernate instead of sleep, with standby tuning — so it doesn't drain in your bag.",
  changes: "powercfg: hibernate + standby timeouts",
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
  check(_ctx, exec) {
    return regState(exec, "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Power", "HibernateEnabled", 1);
  },
};

/**
 * A module declared in the catalog but whose v1 PowerShell logic has not been
 * ported yet. It appears in the plan and reports honestly as planned, so the
 * step counts and the live log never overstate what bootible actually does.
 */
function planned(
  id: string,
  name: string,
  group: ModuleGroup,
  description: string,
): BootibleModule {
  return {
    id,
    name,
    group,
    description,
    planned: true,
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
  description: string,
  packageIds: string[],
): BootibleModule {
  return {
    id,
    name,
    group: "apps",
    description,
    changes: `${packageIds.length} package${packageIds.length === 1 ? "" : "s"} (winget)`,
    apply(_ctx, exec) {
      const commands = getWingetInstallCommands(packageIds);
      if (commands.length === 0) {
        return { status: "skipped", detail: "no packages configured" };
      }
      return { status: "applied", actions: runCommands(exec, commands) };
    },
    check(_ctx, exec) {
      const installed = packageIds.every((id) => exec(["winget", "list", "--id", id]).includes(id));
      return installed ? "applied" : "pending";
    },
  };
}

/** Windows defaults — curated debloat/registry tweaks ported from v1. */
const windowsDefaults: BootibleModule = {
  id: "windows-defaults",
  name: "Windows defaults",
  group: "system",
  description: "Turn off telemetry, Copilot and Bing search; show file extensions.",
  changes: "6 registry values",
  apply(_ctx, exec) {
    return { status: "applied", actions: runCommands(exec, getWindowsDefaultsCommands()) };
  },
  check(_ctx, exec) {
    return regState(
      exec,
      "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection",
      "AllowTelemetry",
      0,
    );
  },
};

/** Display & GPU — HAGS on, AMD Vari-Bright off (ported from v1). */
const display: BootibleModule = {
  id: "display",
  name: "Display & GPU",
  group: "system",
  description:
    "Turn on hardware GPU scheduling (needed for AMD frame-gen) and stop the screen dimming on battery.",
  changes: "HwSchMode + AMD Vari-Bright (registry)",
  apply(_ctx, exec) {
    return { status: "applied", actions: runCommands(exec, getDisplayTweakCommands()) };
  },
  check(_ctx, exec) {
    return regState(
      exec,
      "HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers",
      "HwSchMode",
      2,
    );
  },
};

/** Background trim — set non-essential services to manual (ported from v1). */
const backgroundTrim: BootibleModule = {
  id: "optimization",
  name: "Background trim",
  group: "performance",
  description: "Set telemetry, maps & remote-registry services to manual — more left for games.",
  changes: "sc config on non-essential services",
  apply(_ctx, exec) {
    return { status: "applied", actions: runCommands(exec, getServiceTrimCommands()) };
  },
  check(_ctx, exec) {
    // DiagTrack as the representative service: manual start = DEMAND_START.
    return /DEMAND_START/.test(exec(["sc", "qc", "DiagTrack"])) ? "applied" : "pending";
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
  display,
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
    "Install PowerToys, 7-Zip, Everything and Windows Terminal.",
    ["Microsoft.PowerToys", "7zip.7zip", "voidtools.Everything", "Microsoft.WindowsTerminal"],
  ),
  planned("emudeck", "EmuDeck", "apps", "Emulation frontend — kept current, never frozen."),
  appInstall("steam", "Steam", "Install Steam and boot it straight into Big Picture.", [
    "Valve.Steam",
  ]),
  planned("streaming", "Game streaming", "apps", "Moonlight / Chiaki streaming clients."),
  planned(
    "sync-target",
    "Sync target & saves",
    "library",
    "Connect a target so saves and BIOS follow you.",
  ),
];

/** Recommended bundles for the Ally — outcome-described "set it up for me"
 *  presets. Module ids reference real (implemented) modules only. */
export const allyBundles: Bundle[] = [
  {
    id: "full",
    name: "The full setup",
    description:
      "Your Ally the way most people want it — runs games smoothly, doesn't drain in your bag, Windows junk trimmed, and Steam + handy tools installed.",
    tag: "recommended",
    recommended: true,
    moduleIds: ["power", "display", "windows-defaults", "optimization", "steam", "utilities"],
  },
  {
    id: "lean",
    name: "Lean & clean",
    description:
      "Just the system tuning — power, display, sensible Windows defaults and less background junk. No apps installed.",
    tag: "minimal",
    moduleIds: ["power", "display", "windows-defaults", "optimization"],
  },
  {
    id: "games",
    name: "Just the games",
    description:
      "Install Steam + tools and the gaming tweaks, skip the Windows cleanup. For a machine you've already set up how you like.",
    tag: "apps",
    moduleIds: ["power", "display", "steam", "utilities"],
  },
];
