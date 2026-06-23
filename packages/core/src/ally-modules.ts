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
  group: ModuleGroup = "apps",
): BootibleModule {
  return {
    id,
    name,
    group,
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
    return /DEMAND_START/.test(exec(["sc.exe", "qc", "DiagTrack"])) ? "applied" : "pending";
  },
};

/**
 * System health check — read-only verification that the other modules' tweaks
 * took. Reports how many checks passed (never changes the device), so it runs
 * last as an honest "did it work" pass.
 */
const health: BootibleModule = {
  id: "health",
  name: "System health check",
  group: "performance",
  description:
    "Verify the key tweaks took — power, GPU scheduling, telemetry and background services.",
  changes: "read-only checks",
  apply(_ctx, exec) {
    const checks: [string, boolean][] = [
      [
        "hibernate",
        regDword(exec, "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Power", "HibernateEnabled") === 1,
      ],
      [
        "gpu scheduling",
        regDword(exec, "HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers", "HwSchMode") ===
          2,
      ],
      [
        "telemetry off",
        regDword(
          exec,
          "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection",
          "AllowTelemetry",
        ) === 0,
      ],
      ["background trim", /DEMAND_START/.test(exec(["sc.exe", "qc", "DiagTrack"]))],
    ];
    const passed = checks.filter(([, ok]) => ok).length;
    const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
    const actions = checks.map(([name, ok]) => `check ${name}: ${ok ? "ok" : "not set"}`);
    const detail = failed.length
      ? `verified ${passed}/${checks.length} — not set: ${failed.join(", ")}`
      : `verified ${passed}/${checks.length} — all good`;
    return { status: "applied", detail, actions };
  },
  check(_ctx, exec) {
    return regDword(
      exec,
      "HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers",
      "HwSchMode",
    ) === 2
      ? "applied"
      : "pending";
  },
};

/**
 * Xbox full-screen experience — set the Xbox app as Windows' gaming home app,
 * which enables Xbox mode (the console-style full-screen shell). The home-app
 * value is the Xbox app's AUMID, written under GamingConfiguration. Verified
 * against Microsoft's Full Screen Experience docs (KB 5070297) / the elevenforum
 * tutorial — not a guessed key. HKCU, applied as the auto-logon user at first
 * logon (the bootstrap's context). The Xbox app is inbox on Win11 24H2+, so no
 * install is needed; if a future image lacks it, add a Store install here. The
 * separate "enter on startup" toggle is captured on real hardware before it's
 * added (the design's known gap) rather than guessed.
 */
const XBOX_HOME_APP = "Microsoft.GamingApp_8wekyb3d8bbwe!Microsoft.Xbox.App";
const GAMING_CONFIG_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\GamingConfiguration";

const xboxFullscreen: BootibleModule = {
  id: "xbox-fullscreen",
  name: "Xbox full-screen experience",
  group: "system",
  description:
    "Boot into the Xbox console-style full-screen experience instead of the Windows desktop.",
  changes: "GamingHomeApp = Xbox (registry)",
  apply(_ctx, exec) {
    exec([
      "reg",
      "add",
      GAMING_CONFIG_KEY,
      "/v",
      "GamingHomeApp",
      "/t",
      "REG_SZ",
      "/d",
      XBOX_HOME_APP,
      "/f",
    ]);
    return { status: "applied", actions: [`set GamingHomeApp = ${XBOX_HOME_APP}`] };
  },
  check(_ctx, exec) {
    return exec(["reg", "query", GAMING_CONFIG_KEY, "/v", "GamingHomeApp"]).includes(
      "Microsoft.Xbox.App",
    )
      ? "applied"
      : "pending";
  },
};

/**
 * SSH access — install the OpenSSH server, open the firewall, and authorise the
 * user's public key so they can SSH into the device later. The key is plain
 * config data (public keys aren't secrets), read from settings.ssh_public_key;
 * skips cleanly when none is given.
 *
 * OpenSSH comes from winget (Microsoft.OpenSSH.Preview), NOT the dism
 * /Add-Capability Feature-on-Demand path: the FoD pulls from Windows Update and
 * can stall indefinitely (hit live on hardware), which would hang the whole
 * first-logon bootstrap. winget downloads from GitHub and can't stall that way.
 *
 * For an admin account, Windows OpenSSH reads
 * %ProgramData%\ssh\administrators_authorized_keys (not the user's ~/.ssh) and
 * requires the file's ACL be restricted to Administrators + SYSTEM — the
 * documented Windows OpenSSH gotcha, handled here.
 */
const sshKey: BootibleModule = {
  id: "ssh-key",
  name: "SSH access",
  group: "system",
  description:
    "Install the OpenSSH server, open the firewall, and authorise your public key — so you can SSH into the device later.",
  changes: "OpenSSH Server (winget) + firewall + authorized key",
  apply(ctx, exec) {
    const settings = (ctx.config.settings ?? {}) as Record<string, unknown>;
    const key = typeof settings.ssh_public_key === "string" ? settings.ssh_public_key.trim() : "";
    if (!key) {
      return { status: "skipped", detail: "no SSH public key provided" };
    }
    const actions: string[] = [];
    // Install OpenSSH via winget (downloads from GitHub — no FoD/Windows-Update
    // stall that could hang the bootstrap).
    exec([
      "winget",
      "install",
      "--id",
      "Microsoft.OpenSSH.Preview",
      "--accept-source-agreements",
      "--accept-package-agreements",
      "--silent",
    ]);
    actions.push("install OpenSSH (winget)");
    // Register the sshd service if the package didn't, then auto-start + start it.
    exec([
      "powershell",
      "-Command",
      "if (-not (Get-Service sshd -ErrorAction SilentlyContinue)) { " +
        "$s = Get-ChildItem 'C:\\Program Files\\OpenSSH*' -Filter install-sshd.ps1 -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1; " +
        "if ($s) { & $s.FullName } }; " +
        "Set-Service sshd -StartupType Automatic -ErrorAction SilentlyContinue; " +
        "Start-Service sshd -ErrorAction SilentlyContinue",
    ]);
    actions.push("register + start sshd");
    // Open the firewall for inbound SSH (the standalone install often skips this).
    exec([
      "powershell",
      "-Command",
      "if (-not (Get-NetFirewallRule -Name bootible-sshd -ErrorAction SilentlyContinue)) { " +
        "New-NetFirewallRule -Name bootible-sshd -DisplayName 'OpenSSH Server (bootible)' " +
        "-Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22 | Out-Null }",
    ]);
    actions.push("open firewall TCP 22");
    // Authorise the key for admin SSH: write administrators_authorized_keys and
    // lock its ACL to Administrators + SYSTEM (required, or sshd ignores it).
    const escaped = key.replace(/'/g, "''");
    exec([
      "powershell",
      "-Command",
      `$f="$env:ProgramData\\ssh\\administrators_authorized_keys"; ` +
        `Set-Content -Path $f -Value '${escaped}' -Encoding ascii; ` +
        `icacls $f /inheritance:r /grant 'Administrators:F' /grant 'SYSTEM:F'`,
    ]);
    actions.push("authorise public key");
    return { status: "applied", actions };
  },
  check(_ctx, exec) {
    return /RUNNING/.test(exec(["sc.exe", "query", "sshd"])) ? "applied" : "pending";
  },
};

/**
 * Steam Big Picture shell — launch Steam straight into Big Picture on login, so
 * the device boots into a controller-friendly UI instead of the desktop. Adds a
 * per-user Run entry invoking Steam with the documented steam://open/bigpicture
 * protocol. Assumes Steam's default install path (where the steam module puts
 * it); confirmed on hardware (Phase C) if a non-default path is ever used.
 */
const STEAM_DEFAULT_EXE = "C:\\Program Files (x86)\\Steam\\steam.exe";
const RUN_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";

const steamBigPicture: BootibleModule = {
  id: "steam-bigpicture",
  name: "Steam Big Picture shell",
  group: "system",
  description: "Boot straight into Steam Big Picture instead of the Windows desktop.",
  changes: "Run entry launching Steam Big Picture",
  apply(_ctx, exec) {
    exec([
      "reg",
      "add",
      RUN_KEY,
      "/v",
      "BootibleSteamBigPicture",
      "/t",
      "REG_SZ",
      "/d",
      `"${STEAM_DEFAULT_EXE}" -start steam://open/bigpicture`,
      "/f",
    ]);
    return { status: "applied", actions: ["set Steam Big Picture to launch on login"] };
  },
  check(_ctx, exec) {
    return exec(["reg", "query", RUN_KEY, "/v", "BootibleSteamBigPicture"]).includes("bigpicture")
      ? "applied"
      : "pending";
  },
};

/** The ROG Ally / Windows module catalog, in run order. */
export const allyCatalog: BootibleModule[] = [
  power,
  appInstall(
    "controller",
    "Controller & input",
    "Install Handheld Companion + HidHide so you can remap buttons (HidHide is a driver — needs a reboot). Map them in Handheld Companion after.",
    ["BenjaminLSR.HandheldCompanion", "Nefarius.HidHide"],
    "system",
  ),
  display,
  windowsDefaults,
  backgroundTrim,
  appInstall(
    "utilities",
    "Desktop utilities",
    "Install PowerToys, 7-Zip, Everything and Windows Terminal.",
    ["Microsoft.PowerToys", "7zip.7zip", "voidtools.Everything", "Microsoft.WindowsTerminal"],
  ),
  appInstall(
    "emudeck",
    "EmuDeck",
    "Install Git + Python so EmuDeck's setup is quick — run the EmuDeck app after to pick emulators.",
    ["Git.Git", "Python.Python.3.12"],
  ),
  appInstall("steam", "Steam", "Install Steam and boot it straight into Big Picture.", [
    "Valve.Steam",
  ]),
  appInstall(
    "streaming",
    "Game streaming",
    "Install Moonlight + Chiaki-ng to stream from your gaming PC or PlayStation.",
    ["MoonlightGameStreamingProject.Moonlight", "Streetpea.Chiaki-ng"],
  ),
  appInstall(
    "armoury-crate",
    "Armoury Crate",
    "Install ASUS Armoury Crate — the factory control surface (operating modes, fan curves, button remap). ASUS's install tool detects the handheld and pulls the SE/Command Center build; it fetches components on first run and may want a reboot.",
    ["Asus.ArmouryCrate"],
    "system",
  ),
  sshKey,
  steamBigPicture,
  xboxFullscreen,
  health,
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
