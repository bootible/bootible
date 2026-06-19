import type { BootibleModule, ModuleGroup } from "./modules";
import { getPowerConfigCommands } from "./power";
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
      const actions: string[] = [];
      for (const args of commands) {
        exec(args);
        actions.push(args.join(" "));
      }
      return { status: "applied", actions };
    },
  };
}

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
  planned(
    "windows-defaults",
    "Windows defaults",
    "system",
    "Sensible handheld defaults for Windows.",
  ),
  planned(
    "optimization",
    "Background trim",
    "performance",
    "Trim background apps and services for games.",
  ),
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
