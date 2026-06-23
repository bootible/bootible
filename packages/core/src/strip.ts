// The "Full ROG, stripped" payload. NOT a clean-install path: the user restores
// the genuine factory image (ASUS Cloud Recovery), then runs this once. It
// applies bootible's floor (power, display, windows-defaults incl. Copilot
// removal + Recall off, service trim) and a CONSERVATIVE debloat of the factory
// bloat, while explicitly keeping the ROG essentials.
//
// First run also writes a full inventory of every installed app, so the real
// restored device tells us its exact package names and we tighten the list from
// fact (same approach that nailed Copilot/Recall over SSH).

import { allyCatalog } from "./ally-modules";
import { UNIVERSAL_FLOOR } from "./bases";
import type { BootibleConfig } from "./config";
import type { ApplyContext } from "./orchestrator";
import type { Exec } from "./secrets";

/** Appx packages safe to remove (Microsoft inbox bloat + security trialware).
 *  Wildcards match Get-AppxPackage -AllUsers names. */
const STRIP_APPX = [
  "*McAfee*",
  "*Norton*",
  "Microsoft.MicrosoftOfficeHub",
  "Microsoft.OfficeLens",
  "Microsoft.MicrosoftSolitaireCollection",
  "Clipchamp.Clipchamp",
  "Microsoft.Todos",
  "Microsoft.BingNews",
  "Microsoft.BingWeather",
  "*LinkedInforWindows*",
];

/** Win32 apps to silently uninstall, matched on DisplayName (factory trialware +
 *  ASUS extras that don't apply to a handheld). */
const STRIP_WIN32 = ["McAfee", "Norton", "GlideX", "Live Update", "Microsoft 365"];

/** Never uninstall these, even if a strip pattern would match — the ROG/Full-ROG
 *  essentials and Armoury Crate's own dependencies. */
const KEEP_GUARD = [
  "Armoury Crate",
  "ASUS System Control",
  "MyASUS",
  "Dolby",
  "Aura",
  "GameSDK",
  "ASUS Framework",
  "Aac",
  "ASUSACCI",
];

function psQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function toPowerShellLine(cmd: string[]): string {
  if (cmd[0] === "powershell" && cmd[1] === "-Command" && cmd[2]) return cmd[2];
  const [exe, ...args] = cmd;
  const quoted = args.map(psQuote).join(" ");
  return `& ${psQuote(exe ?? "")}${quoted ? ` ${quoted}` : ""}`;
}

function psArray(items: string[]): string {
  return `@(${items.map(psQuote).join(", ")})`;
}

/** Build the floor command set (power/display/windows-defaults/optimization) the
 *  same way the install bootstrap does, so the strip stays in sync with the app. */
function floorLines(config: BootibleConfig): string {
  const commands: string[][] = [];
  const rec: Exec = (cmd) => {
    commands.push(cmd);
    return "";
  };
  const device: ApplyContext["device"] = {
    id: "rog-ally",
    name: "ROG Ally",
    provisioning_models: ["on-device"],
  };
  for (const id of UNIVERSAL_FLOOR) {
    allyCatalog.find((m) => m.id === id)?.apply({ device, config }, rec);
  }
  return commands
    .map((cmd) => {
      const line = toPowerShellLine(cmd);
      return `Write-Strip ${psQuote(line)}\ntry { ${line} } catch { Write-Strip "  failed: $_" }`;
    })
    .join("\n");
}

/** The standalone strip/tune script for a factory-restored ROG. */
export function generateStripScript(config: BootibleConfig): string {
  return `# bootible strip-rog — run ONCE on a factory-restored ROG Ally.
# Applies bootible's floor + a conservative debloat, keeping the ROG essentials.
# Generated, self-contained PowerShell — no runtime/CLI needed. Run elevated.
$ErrorActionPreference = 'Continue'
$Root = "$env:SystemDrive\\bootible"
$Log = "$Root\\strip.log"
New-Item -ItemType Directory -Force -Path $Root | Out-Null
function Write-Strip($m) { "[$(Get-Date -Format o)] $m" | Tee-Object -FilePath $Log -Append }

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
  Write-Strip 'NOT elevated — re-run this script as Administrator.'; return
}

Write-Strip 'bootible strip starting'
try {
  Enable-ComputerRestore -Drive "$env:SystemDrive\\" -ErrorAction SilentlyContinue
  Checkpoint-Computer -Description 'Factory ROG (pre-bootible strip)' -RestorePointType 'MODIFY_SETTINGS' -ErrorAction SilentlyContinue
  Write-Strip 'restore point taken'
} catch { Write-Strip "  restore point failed: $_" }

# ── INVENTORY: capture the real factory image so we can refine the strip list ──
Get-AppxPackage -AllUsers | Select-Object -ExpandProperty Name | Sort-Object |
  Set-Content "$Root\\inventory-appx.txt"
$uninstallKeys = @(
  'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
)
Get-ItemProperty $uninstallKeys -ErrorAction SilentlyContinue |
  Where-Object { $_.DisplayName } |
  Select-Object DisplayName, Publisher | Sort-Object DisplayName -Unique |
  Format-Table -AutoSize | Out-String | Set-Content "$Root\\inventory-win32.txt"
Write-Strip 'inventory written (inventory-appx.txt / inventory-win32.txt)'

# ── FLOOR: power, display, windows-defaults (Copilot/Recall), service trim ──
${floorLines(config)}

# ── STRIP Appx (Microsoft inbox bloat + security trialware) ──
$stripAppx = ${psArray(STRIP_APPX)}
$keepGuard = ${psArray(KEEP_GUARD)}
foreach ($pat in $stripAppx) {
  Get-AppxPackage -AllUsers $pat -ErrorAction SilentlyContinue | ForEach-Object {
    $pkg = $_
    $keep = $false; foreach ($k in $keepGuard) { if ($pkg.Name -like "*$k*") { $keep = $true } }
    if ($keep) { return }
    Write-Strip "remove appx $($pkg.Name)"
    Remove-AppxPackage -AllUsers -Package $pkg.PackageFullName -ErrorAction SilentlyContinue
  }
  Get-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -like $pat } |
    ForEach-Object { Remove-AppxProvisionedPackage -Online -PackageName $_.PackageName -ErrorAction SilentlyContinue }
}

# ── STRIP Win32 (factory trialware + handheld-irrelevant ASUS extras), with a
#    keep-guard so Armoury Crate / System Control / MyASUS / Dolby are untouched ──
$stripWin32 = ${psArray(STRIP_WIN32)}
Get-ItemProperty $uninstallKeys -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName } | ForEach-Object {
  $name = $_.DisplayName
  $keep = $false; foreach ($k in $keepGuard) { if ($name -like "*$k*") { $keep = $true } }
  if ($keep) { return }
  $hit = $false; foreach ($s in $stripWin32) { if ($name -like "*$s*") { $hit = $true } }
  if (-not $hit) { return }
  $cmd = $_.QuietUninstallString
  if (-not $cmd) {
    $u = $_.UninstallString
    if ($u -and $u -match 'msiexec') { $cmd = "$u /quiet /norestart" } else { $cmd = $u }
  }
  if (-not $cmd) { return }
  Write-Strip "uninstall $name"
  try { Start-Process cmd.exe -ArgumentList '/c', $cmd -Wait -WindowStyle Hidden } catch { Write-Strip "  failed: $_" }
}

Write-Strip 'bootible strip complete'
"bootible stripped $(Get-Date -Format o)" | Set-Content "$Root\\receipt.txt"
Write-Strip 'Review C:\\bootible\\inventory-*.txt and send them back so we can tighten the strip list.'
`;
}
