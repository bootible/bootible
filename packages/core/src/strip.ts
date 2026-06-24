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
  "*Glidex*", // ASUS GlideX is an Appx (B9ECED6F.Glidex) — multi-device, useless on a handheld
  "Microsoft.MicrosoftOfficeHub",
  "Microsoft.OfficeLens",
  "Microsoft.Office.ActionsServer",
  "Microsoft.OfficePushNotificationUtility",
  "Microsoft.MicrosoftSolitaireCollection",
  "Clipchamp.Clipchamp",
  "Microsoft.Todos",
  "Microsoft.BingNews",
  "Microsoft.BingWeather",
  "Microsoft.ZuneMusic", // Groove (legacy)
  "Microsoft.Whiteboard",
  "Microsoft.GetHelp",
  "Microsoft.WindowsFeedbackHub",
  "Microsoft.MixedRealityLink",
  "Microsoft.Windows.DevHome",
  "Microsoft.OutlookForWindows", // new Outlook
  "MSTeams", // personal Teams
  "Microsoft.PowerAutomateDesktop",
  "Microsoft.OneDriveSync",
  "*LinkedInforWindows*",
  // Kept on purpose: Microsoft.YourPhone (Phone Link), Xbox/Gaming apps.
];

/** Win32 apps to silently uninstall, matched on DisplayName (factory trialware +
 *  ASUS extras that don't apply to a handheld). */
// Win32 (classic installer) names to strip. "Live Update" is intentionally a
// no-op on the Ally (its updater is ROG Live Service, kept). Copilot has a Win32
// entry the Appx removal misses, so we catch both.
const STRIP_WIN32 = [
  "McAfee",
  "Norton",
  "GlideX",
  "Live Update",
  "Microsoft 365",
  "OneDrive",
  "Copilot",
];

/** Never uninstall these, even if a strip pattern would match — the ROG/Full-ROG
 *  essentials and Armoury Crate's own dependencies. */
const KEEP_GUARD = [
  // ASUS essentials (Appx names are space-less, e.g. B9ECED6F.ArmouryCrateSE)
  "Armoury Crate",
  "ArmouryCrate",
  "ASUS System Control",
  "ASUSCommandCenter",
  "ASUSPCAssistant",
  "AmbientHAL",
  "MyASUS",
  "Dolby",
  "Aura",
  "GameSDK",
  "ASUS Framework",
  "Aac",
  "ASUSACCI",
  // Gaming substrate — it's a gaming handheld; never strip Xbox.
  "Xbox",
  "GamingApp",
  "GamingServices",
  // Hardware control
  "Radeon",
  "Realtek",
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

/** A double-tappable launcher for the strip script. `.bat` RUNS on double-click
 *  (touch-friendly) — unlike a `.ps1`, which Windows opens in an editor. It just
 *  invokes strip-rog.ps1 sitting next to it, which then self-elevates (one UAC
 *  prompt). Ship this beside strip-rog.ps1 on the USB. */
export function generateStripLauncher(): string {
  return [
    "@echo off",
    "REM bootible -- double-tap to strip a factory-restored ROG Ally.",
    "REM Self-elevates (one UAC prompt), then runs striprog.ps1 next to it.",
    "REM Hyphen-free names so macOS doesn't mangle them; a wildcard fallback finds",
    "REM the script even if the name still changed in transit (skips macOS ._ files).",
    "net session >nul 2>&1",
    "if %errorlevel% NEQ 0 (",
    `  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"`,
    "  exit /b",
    ")",
    'set "PS=%~dp0striprog.ps1"',
    `if not exist "%PS%" for /f "delims=" %%f in ('dir /b /a-d "%~dp0*strip*.ps1" 2^>nul ^| findstr /v /b /c:"._"') do set "PS=%~dp0%%f"`,
    'powershell -NoProfile -ExecutionPolicy Bypass -File "%PS%"',
    "pause",
    "",
  ].join("\r\n");
}

/** The standalone strip/tune script for a factory-restored ROG. */
export function generateStripScript(config: BootibleConfig): string {
  return `# bootible strip-rog — run ONCE on a factory-restored ROG Ally.
# Applies bootible's floor + a conservative debloat, keeping the ROG essentials.
# Generated, self-contained PowerShell — no runtime/CLI needed. Run elevated.
$ErrorActionPreference = 'Continue'

# Self-elevate: if not already Administrator, relaunch this same script elevated
# (one UAC prompt), so "Run with PowerShell" just works without a flash-and-close.
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
  try {
    Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $PSCommandPath + '"')
  } catch { Write-Host 'Could not elevate. Right-click -> Run with PowerShell, or run from an admin terminal.' -ForegroundColor Red; Read-Host 'Press Enter to close' }
  exit
}

$Root = "$env:SystemDrive\\bootible"
$Log = "$Root\\strip.log"
New-Item -ItemType Directory -Force -Path $Root | Out-Null
function Write-Strip($m) { "[$(Get-Date -Format o)] $m" | Tee-Object -FilePath $Log -Append }

# Optional headless SSH: type a GitHub username to pull your public keys from
# github.com/<user>.keys and set up OpenSSH so you can ssh in afterwards.
$ghUser = Read-Host 'GitHub username for SSH access (or press Enter to skip)'

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

# ── Optional headless SSH from GitHub keys ──
if ($ghUser) {
  Write-Strip "fetching SSH keys from github.com/$ghUser.keys"
  $keys = @()
  try {
    $resp = Invoke-WebRequest -Uri "https://github.com/$ghUser.keys" -UseBasicParsing -TimeoutSec 20
    $keys = ($resp.Content -split "\`n") | ForEach-Object { $_.Trim() } | Where-Object { $_ -match '^(ssh-|ecdsa-|sk-)' }
  } catch { Write-Strip "  github fetch failed: $_" }
  if ($keys.Count -gt 0) {
    & winget install --id Microsoft.OpenSSH.Preview --source winget --accept-source-agreements --accept-package-agreements --silent
    if (-not (Get-Service sshd -ErrorAction SilentlyContinue)) {
      $s = Get-ChildItem 'C:\\Program Files\\OpenSSH*' -Filter install-sshd.ps1 -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($s) { & $s.FullName }
    }
    Set-Service sshd -StartupType Automatic -ErrorAction SilentlyContinue
    Start-Service sshd -ErrorAction SilentlyContinue
    if (-not (Get-NetFirewallRule -Name bootible-sshd -ErrorAction SilentlyContinue)) {
      New-NetFirewallRule -Name bootible-sshd -DisplayName 'OpenSSH Server (bootible)' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22 | Out-Null
    }
    $akf = "$env:ProgramData\\ssh\\administrators_authorized_keys"
    Set-Content -Path $akf -Value $keys -Encoding ascii
    icacls $akf /inheritance:r /grant 'Administrators:F' /grant 'SYSTEM:F' | Out-Null
    Write-Strip "SSH ready — authorised $($keys.Count) key(s) from github.com/$ghUser.keys (ssh $env:USERNAME@<this-ip>)"
  } else { Write-Strip "  no public keys found at github.com/$ghUser.keys" }
}

Write-Strip 'bootible strip complete'
"bootible stripped $(Get-Date -Format o)" | Set-Content "$Root\\receipt.txt"
Write-Strip 'Review C:\\bootible\\inventory-*.txt and send them back so we can tighten the strip list.'
Read-Host 'Done. Press Enter to close this window'
`;
}
