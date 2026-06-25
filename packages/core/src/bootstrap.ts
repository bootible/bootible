import { getSelectedAppCommands } from "./apps";
import type { BootibleConfig } from "./config";
import { onboard } from "./onboard";
import type { Executor } from "./orchestrator";
import type { DeviceEntry } from "./registry";
import type { Exec } from "./secrets";
import { generateTwoPassInstall } from "./winget";

export interface BootstrapOptions {
  device: DeviceEntry;
  config: BootibleConfig;
  /** Builds the platform executor around a runner — e.g. allyExecutor. */
  executorFactory: (exec: Exec) => Executor;
}

/** Single-quote a value for PowerShell (literal; doubles embedded quotes). */
function psQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** Render one command array as a PowerShell statement. */
function toPowerShellLine(cmd: string[]): string {
  // A `powershell -Command "<stmt>"` array is already a PowerShell statement
  // (e.g. Checkpoint-Computer) — emit it inline rather than nesting powershell.
  if (cmd[0] === "powershell" && cmd[1] === "-Command" && cmd[2]) {
    return cmd[2];
  }
  const [exe, ...args] = cmd;
  const quoted = args.map(psQuote).join(" ");
  return `& ${psQuote(exe ?? "")}${quoted ? ` ${quoted}` : ""}`;
}

/**
 * Bake the full onboard run into a self-contained PowerShell script. Every
 * module emits command arrays, so we collect them at build time (on the
 * desktop) and emit them as plain PowerShell — the Ally runs this at first
 * logon with no Node/CLI dependency. This is the payload the autounattend's
 * FirstLogonCommand invokes.
 */
export function generateBootstrapScript(opts: BootstrapOptions): string {
  const commands: string[][] = [];
  const recordingExec: Exec = (cmd) => {
    commands.push(cmd);
    return "";
  };

  // The user-picked apps run through the de-elevating two-pass installer (user
  // -scope installers reject an admin context), so drop "apps" from the inline
  // onboard run and install them separately at the end.
  const hasApps = !!opts.config.modules?.includes("apps");
  const onboardConfig = hasApps
    ? { ...opts.config, modules: opts.config.modules?.filter((m) => m !== "apps") }
    : opts.config;

  onboard({
    device: opts.device,
    config: onboardConfig,
    executor: opts.executorFactory(recordingExec),
    exec: recordingExec,
  });

  const steps = commands
    .map((cmd) => {
      const line = toPowerShellLine(cmd);
      return `Write-Bootible ${psQuote(line)}\ntry { ${line} } catch { Write-Bootible "  failed: $_" }`;
    })
    .join("\n");

  const appInstalls = hasApps
    ? getSelectedAppCommands((opts.config.settings?.selected_apps as string[] | undefined) ?? [])
    : [];
  const appBlock = generateTwoPassInstall(appInstalls, "$BootibleRoot", "Write-Bootible");

  return `# bootible bootstrap — generated, self-contained plain PowerShell.
# No separate runtime or CLI required. Runs once at first logon via the
# autounattend FirstLogonCommand.
$ErrorActionPreference = 'Continue'
$BootibleRoot = "$env:SystemDrive\\bootible"
$BootibleLog = "$BootibleRoot\\bootstrap.log"
New-Item -ItemType Directory -Force -Path $BootibleRoot | Out-Null
function Write-Bootible($m) { "[$(Get-Date -Format o)] $m" | Tee-Object -FilePath $BootibleLog -Append }

# winget's WindowsApps PATH alias isn't ready at first logon and the App
# Installer package can take a minute to register, so add its folder to PATH and
# wait for it before the module commands run. Without this every install fails
# with "'winget' is not recognized".
$env:PATH = "$env:LOCALAPPDATA\\Microsoft\\WindowsApps;$env:PATH"
$wingetExe = $null
foreach ($i in 1..24) {
  $c = Get-Command winget.exe -ErrorAction SilentlyContinue
  if ($c) { $wingetExe = $c.Source; break }
  Start-Sleep -Seconds 5
}
if ($wingetExe) { Set-Alias -Name winget -Value $wingetExe -Scope Global; Write-Bootible "winget ready: $wingetExe" }
else { Write-Bootible 'winget did not become available; app installs may fail' }

# Discovery: mark status and start the LAN beacon (if staged) so the desktop can
# find this device while it configures. The beacon reads $BootibleRoot\\status.txt.
'configuring' | Set-Content "$BootibleRoot\\status.txt"
if (Test-Path "$BootibleRoot\\beacon.ps1") {
  try {
    $beaconArgs = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \`"$BootibleRoot\\beacon.ps1\`""
    $beaconAction = New-ScheduledTaskAction -Execute 'powershell' -Argument $beaconArgs
    $beaconTrigger = New-ScheduledTaskTrigger -AtLogOn
    Register-ScheduledTask -TaskName 'BootibleBeacon' -Force -RunLevel Highest -Action $beaconAction -Trigger $beaconTrigger | Out-Null
    Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',"$BootibleRoot\\beacon.ps1"
    Write-Bootible 'beacon started'
  } catch { Write-Bootible "  beacon failed: $_" }
}

Write-Bootible 'bootible onboard starting'

${steps}

${appBlock}

Write-Bootible 'bootible onboard complete'
'done' | Set-Content "$BootibleRoot\\status.txt"
"bootible configured $(Get-Date -Format o)" | Set-Content "$BootibleRoot\\receipt.txt"
`;
}
