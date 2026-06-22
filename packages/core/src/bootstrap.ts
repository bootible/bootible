import type { BootibleConfig } from "./config";
import { onboard } from "./onboard";
import type { Executor } from "./orchestrator";
import type { DeviceEntry } from "./registry";
import type { Exec } from "./secrets";

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

  onboard({
    device: opts.device,
    config: opts.config,
    executor: opts.executorFactory(recordingExec),
    exec: recordingExec,
  });

  const steps = commands
    .map((cmd) => {
      const line = toPowerShellLine(cmd);
      return `Write-Bootible ${psQuote(line)}\ntry { ${line} } catch { Write-Bootible "  failed: $_" }`;
    })
    .join("\n");

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

Write-Bootible 'bootible onboard starting'

${steps}

Write-Bootible 'bootible onboard complete'
"bootible configured $(Get-Date -Format o)" | Set-Content "$BootibleRoot\\receipt.txt"
`;
}
