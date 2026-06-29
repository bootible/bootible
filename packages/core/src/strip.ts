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
import { getSelectedAppCommands, getSelectedGithubReleases } from "./apps";
import { UNIVERSAL_FLOOR } from "./bases";
import { BEACON_PORT } from "./beacon";
import type { BootibleConfig } from "./config";
import { generateGithubReleaseInstall } from "./github-install";
import type { ApplyContext } from "./orchestrator";
import type { Exec } from "./secrets";
import { generateAppInstallerUpdate, generateTwoPassInstall } from "./winget";

/** One removable app/bundle the user can opt into stripping. `appx` patterns
 *  match Get-AppxPackage -AllUsers names; `win32` patterns match Uninstall
 *  DisplayNames. `recommended` is the default-suggested set (still opt-in in the
 *  UI, and the default the standalone striprog.ps1 strips when nothing's chosen). */
export interface RemovalEntry {
  id: string;
  name: string;
  appx?: string[];
  win32?: string[];
  recommended?: boolean;
  note?: string;
}

/** The opt-in removal catalog, built from the real Xbox Ally factory inventory. */
export const REMOVAL_CATALOG: RemovalEntry[] = [
  {
    id: "mcafee",
    name: "McAfee (trialware)",
    appx: ["*McAfee*"],
    win32: ["McAfee"],
    recommended: true,
  },
  {
    id: "norton",
    name: "Norton (trialware)",
    appx: ["*Norton*"],
    win32: ["Norton"],
    recommended: true,
  },
  {
    id: "glidex",
    name: "ASUS GlideX",
    appx: ["*Glidex*"],
    win32: ["GlideX"],
    recommended: true,
    note: "Multi-device screen share — useless on a handheld.",
  },
  {
    id: "copilot",
    name: "Copilot (Win32 leftover)",
    win32: ["Copilot"],
    recommended: true,
    note: "The Copilot app is removed by the floor; this clears the Win32 stub too.",
  },
  {
    id: "office-hub",
    name: "Office hub, Lens + stubs",
    appx: [
      "Microsoft.MicrosoftOfficeHub",
      "Microsoft.OfficeLens",
      "Microsoft.Office.ActionsServer",
      "Microsoft.OfficePushNotificationUtility",
    ],
    recommended: true,
  },
  {
    id: "microsoft-365",
    name: "Microsoft 365 (Office)",
    win32: ["Microsoft 365"],
    recommended: true,
  },
  {
    id: "solitaire",
    name: "Solitaire Collection",
    appx: ["Microsoft.MicrosoftSolitaireCollection"],
    recommended: true,
  },
  { id: "clipchamp", name: "Clipchamp", appx: ["Clipchamp.Clipchamp"], recommended: true },
  { id: "todos", name: "Microsoft To Do", appx: ["Microsoft.Todos"], recommended: true },
  { id: "bing-news", name: "Bing News", appx: ["Microsoft.BingNews"], recommended: true },
  { id: "bing-weather", name: "Bing Weather", appx: ["Microsoft.BingWeather"], recommended: true },
  { id: "groove", name: "Groove Music", appx: ["Microsoft.ZuneMusic"], recommended: true },
  { id: "whiteboard", name: "Whiteboard", appx: ["Microsoft.Whiteboard"], recommended: true },
  { id: "get-help", name: "Get Help", appx: ["Microsoft.GetHelp"], recommended: true },
  {
    id: "feedback-hub",
    name: "Feedback Hub",
    appx: ["Microsoft.WindowsFeedbackHub"],
    recommended: true,
  },
  {
    id: "mixed-reality",
    name: "Mixed Reality Link",
    appx: ["Microsoft.MixedRealityLink"],
    recommended: true,
  },
  { id: "dev-home", name: "Dev Home", appx: ["Microsoft.Windows.DevHome"], recommended: true },
  { id: "outlook", name: "New Outlook", appx: ["Microsoft.OutlookForWindows"], recommended: true },
  { id: "teams", name: "Teams (personal)", appx: ["MSTeams"], recommended: true },
  {
    id: "power-automate",
    name: "Power Automate",
    appx: ["Microsoft.PowerAutomateDesktop"],
    recommended: true,
  },
  {
    id: "onedrive",
    name: "OneDrive",
    appx: ["Microsoft.OneDriveSync"],
    win32: ["OneDrive"],
    recommended: true,
  },
  { id: "linkedin", name: "LinkedIn", appx: ["*LinkedInforWindows*"], recommended: true },
  {
    id: "phone-link",
    name: "Phone Link",
    appx: ["Microsoft.YourPhone"],
    recommended: false,
    note: "Handy for calls/notifications — kept unless you tick it.",
  },
];

/** Resolve a removal selection (ids) to {appx, win32} pattern arrays. With no
 *  selection (standalone striprog.ps1) it defaults to every recommended entry. */
export function resolveRemovals(ids?: string[]): { appx: string[]; win32: string[] } {
  const chosen = ids?.length
    ? REMOVAL_CATALOG.filter((e) => ids.includes(e.id))
    : REMOVAL_CATALOG.filter((e) => e.recommended);
  const appx: string[] = [];
  const win32: string[] = [];
  for (const e of chosen) {
    if (e.appx) appx.push(...e.appx);
    if (e.win32) win32.push(...e.win32);
  }
  return { appx, win32 };
}

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

/** Build the module command set the same way the install bootstrap does, so the
 *  strip stays in sync with the app. Runs the config's selected modules (floor +
 *  the user's app-picker apps, SSH, EmuDeck, …) in CATALOG order so dependencies
 *  hold (e.g. sunshine before sunshine-creds). With no modules in the config it
 *  defaults to the universal floor — the standalone manual-strip behaviour. */
function moduleLines(config: BootibleConfig): string {
  const ids = new Set(config.modules?.length ? config.modules : UNIVERSAL_FLOOR);
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
  // "apps" runs through the two-pass installer; wallpaper/lockscreen bake a
  // build-time path — the strip stages images into ~/Pictures at runtime instead.
  const handledSeparately = new Set(["apps", "wallpaper", "lockscreen"]);
  for (const mod of allyCatalog) {
    if (ids.has(mod.id) && !handledSeparately.has(mod.id)) mod.apply({ device, config }, rec);
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
    "REM (1) the strip runs ELEVATED (one UAC prompt). (2) any user-scope app",
    "REM installs (Spotify, GeForce NOW, ...) then finish in THIS non-elevated",
    "REM session -- no staging, no reboot. Tip: double-tap it; don't launch it",
    "REM from an already-elevated prompt, or the user-scope step would be admin too.",
    'del "%SystemDrive%\\bootible\\user-installs.ps1" 2>nul',
    'set "PS=%~dp0bootible.ps1"',
    `if not exist "%PS%" for /f "delims=" %%f in ('dir /b /a-d "%~dp0bootible*.ps1" 2^>nul ^| findstr /v /b /c:"._"') do set "PS=%~dp0%%f"`,
    "echo Running the strip in an elevated window -- watch that window. This one closes itself when done.",
    `powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',\\"%PS%\\",'-FromLauncher'"`,
    'if exist "%SystemDrive%\\bootible\\user-installs.ps1" (',
    "  echo.",
    "  echo Finishing user-scope app installs in this session ^(no reboot needed^)...",
    '  powershell -NoProfile -ExecutionPolicy Bypass -File "%SystemDrive%\\bootible\\user-installs.ps1"',
    ")",
    "echo.",
    "echo bootible prep complete -- closing...",
    "timeout /t 6 >nul",
    "",
  ].join("\r\n");
}

/** The restore-and-run guide that ships beside the strip kit. */
export function generateStripReadme(): string {
  return [
    "bootible -- Full ROG strip kit",
    "==============================",
    "",
    'Turns a factory-restored ROG / Xbox Ally into "OG, but debloated + your apps".',
    "Two steps:",
    "",
    "1) RESTORE the factory image (ASUS Cloud Recovery)",
    "   - Power on, tap F12 at the ROG logo (or Settings -> Recovery -> Advanced",
    "     startup -> UEFI firmware settings) to enter the BIOS.",
    "   - Make sure the BIOS clock is correct -- a wrong time blocks Cloud Recovery.",
    "   - Press the Y button (or F7 -> Advanced) -> ASUS Cloud Recovery.",
    "   - Connect Wi-Fi, agree, and when it asks to back up your files -> Cancel",
    "     (you want a fresh machine), then OK to reset. ~1-3 hours, unattended.",
    "",
    "2) STRIP + SET UP (this kit)",
    "   - Copy this whole folder onto the restored Ally (or run it from the USB).",
    "   - Double-tap bootible.bat -> tap Yes on the UAC prompt.",
    "   - It debloats, applies bootible's tuning, installs your chosen apps, sets",
    "     up SSH, and applies your wallpaper/lock screen. Done.",
    "",
    "Files:",
    "  bootible.bat   -- double-tap this (touch-friendly launcher)",
    "  bootible.ps1   -- the actual strip + setup script",
    "  wallpapers/    -- your background / lock screen images (if you picked any)",
    "",
  ].join("\r\n");
}

/** The standalone strip/tune script for a factory-restored ROG. */
export function generateStripScript(config: BootibleConfig): string {
  const removals = resolveRemovals(config.settings?.strip_removals as string[] | undefined);
  const buildId = String(config.settings?.build_id ?? "bootible-strip").replace(/'/g, "''");
  // If the app already baked SSH keys (ssh-key module), the runtime GitHub-keys
  // prompt is redundant — skip it. Only the standalone manual strip prompts.
  const bakedSsh =
    ((config.settings?.ssh_public_keys as string[] | undefined)?.length ?? 0) > 0 ||
    !!config.modules?.includes("ssh-key");
  const selectedAppSlugs = config.modules?.includes("apps")
    ? ((config.settings?.selected_apps as string[] | undefined) ?? [])
    : [];
  const appInstalls = getSelectedAppCommands(selectedAppSlugs);
  const needsStoreUpdate = appInstalls.some((c) => c.includes("msstore"));
  const appBlock = [
    needsStoreUpdate ? generateAppInstallerUpdate("Write-Strip") : "",
    generateTwoPassInstall(appInstalls, "$Root", "Write-Strip", "launcher"),
    generateGithubReleaseInstall(
      getSelectedGithubReleases(selectedAppSlugs),
      "$Root",
      "Write-Strip",
    ),
  ]
    .filter(Boolean)
    .join("\n\n");
  return `# bootible strip-rog — run ONCE on a factory-restored ROG Ally.
# Applies bootible's floor + a conservative debloat, keeping the ROG essentials.
# Generated, self-contained PowerShell — no runtime/CLI needed. Run elevated.
param([switch]$FromLauncher)
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

# Remember the desktop shortcuts that exist BEFORE installs, so we only sweep the
# icons the app installers dump (keeps any you already had).
@(@("$env:PUBLIC\\Desktop", "$env:USERPROFILE\\Desktop") | ForEach-Object {
  Get-ChildItem "$_\\*.lnk" -ErrorAction SilentlyContinue
} | Select-Object -ExpandProperty FullName) | Set-Content "$Root\\desktop-keep.txt"
function Clear-NewDesktopShortcuts {
  $keep = @(Get-Content "$env:SystemDrive\\bootible\\desktop-keep.txt" -ErrorAction SilentlyContinue)
  foreach ($d in @("$env:PUBLIC\\Desktop", "$env:USERPROFILE\\Desktop")) {
    Get-ChildItem "$d\\*.lnk" -ErrorAction SilentlyContinue |
      Where-Object { $keep -notcontains $_.FullName } | Remove-Item -Force -ErrorAction SilentlyContinue
  }
}

${
  bakedSsh
    ? "# SSH keys are baked in by bootible (the ssh-key module sets up OpenSSH below).\n$ghUser = ''"
    : `# Optional headless SSH: type a GitHub username to pull your public keys from
# github.com/<user>.keys and set up OpenSSH so you can ssh in afterwards.
$ghUser = Read-Host 'GitHub username for SSH access (or press Enter to skip)'`
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

# ── FLOOR + selected modules (tuning, debloat, and any apps you picked) ──
# winget's WindowsApps alias may not be on PATH for app installs — add it.
$env:PATH = "$env:LOCALAPPDATA\\Microsoft\\WindowsApps;$env:PATH"
${moduleLines(config)}

# ── Wallpaper / lock screen: copy any images staged next to this script into the
#    user's Pictures and point Windows at them there (not C:\\bootible) ──
$pics = "$env:USERPROFILE\\Pictures"
foreach ($img in @(@('background','Desktop'), @('lockscreen','LockScreen'))) {
  $src = Get-ChildItem (Join-Path $PSScriptRoot "wallpapers\\$($img[0]).*") -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($src) {
    New-Item -ItemType Directory -Force -Path $pics | Out-Null
    $dest = Join-Path $pics $src.Name
    Copy-Item $src.FullName $dest -Force
    $k = 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\PersonalizationCSP'
    & reg add $k /v "$($img[1])ImagePath" /t REG_SZ /d $dest /f | Out-Null
    & reg add $k /v "$($img[1])ImageUrl" /t REG_SZ /d $dest /f | Out-Null
    & reg add $k /v "$($img[1])ImageStatus" /t REG_DWORD /d 1 /f | Out-Null
    if ($img[0] -eq 'background') {
      # The CSP lock screen applies, but the desktop wallpaper usually needs a
      # logon — also set it per-user and push it to the live session now.
      Set-ItemProperty 'HKCU:\\Control Panel\\Desktop' -Name WallPaper -Value $dest -Force
      Set-ItemProperty 'HKCU:\\Control Panel\\Desktop' -Name WallpaperStyle -Value '10' -Force
      try {
        if (-not ('W.BootWP' -as [type])) {
          Add-Type -Name BootWP -Namespace W -MemberDefinition '[DllImport("user32.dll", SetLastError=true)] public static extern bool SystemParametersInfo(int a, int u, string p, int w);'
        }
        [void][W.BootWP]::SystemParametersInfo(20, 0, $dest, 3)
      } catch {}
    }
    Write-Strip "$($img[0]) -> $dest"
  }
}

${appBlock}

# Sweep desktop icons the installers just dumped (the elevated pass).
Clear-NewDesktopShortcuts

# ── STRIP Appx (the removals you opted into) ──
$stripAppx = ${psArray(removals.appx)}
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
$stripWin32 = ${psArray(removals.win32)}
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
'done' | Set-Content "$Root\\status.txt"

# ── Beacon: announce this device on the LAN for ~10 min so bootible can discover
#    it with no IP/Tailscale to type — just open "Find my device" on the desktop.
#    Runs detached in the background; bounded, so it isn't a permanent agent. ──
$beaconBody = @'
$ErrorActionPreference = 'SilentlyContinue'
$buildId = '${buildId}'
$port = ${BEACON_PORT}
for ($i = 0; $i -lt 120; $i++) {
  try {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1).IPAddress
    $mac = (Get-NetAdapter -Physical | Where-Object { $_.Status -eq 'Up' } | Select-Object -First 1).MacAddress
    $payload = @{ bootible = 1; buildId = $buildId; mac = $mac; ip = $ip; hostname = $env:COMPUTERNAME; username = $env:USERNAME; status = 'done' } | ConvertTo-Json -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
    $udp = New-Object System.Net.Sockets.UdpClient; $udp.EnableBroadcast = $true
    $endpoint = New-Object System.Net.IPEndPoint ([System.Net.IPAddress]::Broadcast), $port
    [void]$udp.Send($bytes, $bytes.Length, $endpoint); $udp.Close()
  } catch {}
  Start-Sleep -Seconds 5
}
'@
Set-Content "$Root\\beacon.ps1" -Value $beaconBody -Encoding ascii
try {
  Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',"$Root\\beacon.ps1"
  Write-Strip 'beacon broadcasting (~10 min) — open bootible "Find my device" on your PC'
} catch { Write-Strip "  beacon failed: $_" }

Write-Strip 'Review C:\\bootible\\inventory-*.txt and send them back so we can tighten the strip list.'
# When run via bootible.bat the launcher owns the final pause (and the user-scope
# installs run after this). Only pause here for a standalone right-click run.
if (-not $FromLauncher) { Read-Host 'Done. Press Enter to close this window' }
`;
}
