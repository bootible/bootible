import { psq, type WindowsBuildManifest } from "./build-manifest";
import { catalogApp } from "./catalog";
import type { BootibleConfig } from "./config";
import { deviceProfile } from "./profiles";
import type { DeviceEntry } from "./registry";
import type { Exec } from "./secrets";
import { KEEP_GUARD, REMOVAL_CATALOG, stripModuleIds } from "./strip";
import { CHECK_MARKER, type CheckSpec } from "./verify";

/**
 * Deep verify for a Windows handheld (ROG Ally).
 *
 * The checks are derived from the SAME commands the provisioner ran: each module's
 * apply() is replayed through a recording exec, and every `reg add`, `sc.exe
 * config`, `winget install` and `powercfg` it emits becomes a check of the real
 * end state. So the verifier can't drift from what was applied. The few opaque
 * PowerShell blocks (SSH, RDP firewall, Copilot removal, static IP, restore
 * points) get explicit checks, and the build manifest adds what the bootstrap
 * never sees (hostname, account, locale, edition).
 *
 * Check bodies are PowerShell. A body returns $true to pass, a string starting
 * "SKIP:" to skip, and any other string as the failure reason.
 */

const PRELUDE = `$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
function Emit($s, $id, $label, $d) {
  $d = "$d" -replace '[\\t\\r\\n]+', ' '
  [Console]::Out.WriteLine("${CHECK_MARKER}\`t$s\`t$id\`t$label\`t$d")
  [Console]::Out.Flush()
}
function Run($id, $label, [scriptblock]$b) {
  try { $r = @(& $b)[-1] } catch { $r = "error: $($_.Exception.Message)" }
  if ($r -eq $true) { Emit 'pass' $id $label '' }
  elseif ($r -is [string] -and $r.StartsWith('SKIP:')) { Emit 'skip' $id $label $r.Substring(5).Trim() }
  elseif ($r -is [string] -and $r) { Emit 'fail' $id $label $r }
  else { Emit 'fail' $id $label 'check failed' }
}
$Elevated = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
# Every user's packages need elevation; without it, the signed-in user's still tell us a lot.
function Appx($pattern) {
  if ($Elevated) { Get-AppxPackage -AllUsers $pattern -ErrorAction SilentlyContinue }
  else { Get-AppxPackage $pattern -ErrorAction SilentlyContinue }
}
function RegIs($path, $name, $want, [switch]$Number) {
  $p = Get-ItemProperty -LiteralPath $path -Name $name -ErrorAction SilentlyContinue
  if (-not $p) { return "$name is missing" }
  $v = $p.$name
  if ($Number) { if ([int64]$v -eq [int64]$want) { return $true } }
  elseif ("$v" -eq "$want") { return $true }
  return "$name is $v"
}
function SvcStart($name, $want) {
  $s = Get-Service -Name $name -ErrorAction SilentlyContinue
  if (-not $s) { return "SKIP: $name isn't on this Windows" }
  if ("$($s.StartType)" -eq $want) { return $true }
  return "$name starts $($s.StartType)"
}
$script:WingetIds = $null
function WingetHas($id) {
  if ($null -eq $script:WingetIds) {
    $f = Join-Path $env:TEMP 'bootible-verify-winget.json'
    $wg = Get-Command winget -ErrorAction SilentlyContinue
    if (-not $wg) { $wg = "$env:LOCALAPPDATA\\Microsoft\\WindowsApps\\winget.exe" } else { $wg = $wg.Source }
    # Only the winget source (msstore can prompt), and bounded: winget's first
    # run on an account can sit initialising its sources for minutes.
    $p = Start-Process -FilePath $wg -ArgumentList 'export','-o',('"' + $f + '"'),'--source','winget','--accept-source-agreements','--disable-interactivity' -WindowStyle Hidden -PassThru
    if (-not $p.WaitForExit(90000)) {
      try { $p.Kill() } catch {}
      $script:WingetIds = 'timeout'
    }
  }
  if ($script:WingetIds -eq 'timeout') { return "couldn't list installed apps (winget didn't answer in 90s)" }
  if ($null -eq $script:WingetIds) {
    $script:WingetIds = @()
    if (Test-Path $f) {
      $j = Get-Content $f -Raw | ConvertFrom-Json
      $script:WingetIds = @($j.Sources | ForEach-Object { $_.Packages } | ForEach-Object { $_.PackageIdentifier })
      Remove-Item $f -ErrorAction SilentlyContinue
    }
  }
  if ($script:WingetIds -contains $id) { return $true }
  $pending = Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce' -Name BootibleUserInstall -ErrorAction SilentlyContinue
  if ($pending) { return "SKIP: queued to install at the next sign-in" }
  return "$id isn't installed"
}
# Firmware support for S4, from GetPwrCapabilities (SYSTEM_POWER_CAPABILITIES:
# SystemS4 is the 7th BOOLEAN byte). Not powercfg /a, whose text is localised.
function CanHibernate {
  if (-not ('Bootible.Pwr' -as [type])) {
    Add-Type -Name Pwr -Namespace Bootible -MemberDefinition '[DllImport("powrprof.dll")] public static extern bool GetPwrCapabilities(byte[] caps);'
  }
  $caps = New-Object byte[] 128
  if (-not [Bootible.Pwr]::GetPwrCapabilities($caps)) { return $true }
  return [bool]$caps[6]
}
function PowerIdx($sub, $setting, $ac, $want) {
  $hex = @((powercfg /qh SCHEME_CURRENT $sub $setting) | Select-String -Pattern '0x[0-9a-fA-F]{8}' -AllMatches | ForEach-Object { $_.Matches } | ForEach-Object { $_.Value })
  if ($hex.Count -lt 2) { return "couldn't read $sub/$setting" }
  $v = [Convert]::ToInt64($hex[$(if ($ac) { -2 } else { -1 })], 16)
  if ($v -eq $want) { return $true }
  return "$setting is $v (wanted $want)"
}
`;

const HIVES: Record<string, string> = { HKLM: "HKLM:", HKCU: "HKCU:" };

/** `powercfg /change <x>` aliases → the power subgroup + setting they set
 *  (the value is minutes; the setting stores seconds). */
const POWER_CHANGE: Record<string, [string, string, boolean]> = {
  "standby-timeout-ac": ["SUB_SLEEP", "STANDBYIDLE", true],
  "standby-timeout-dc": ["SUB_SLEEP", "STANDBYIDLE", false],
  "hibernate-timeout-ac": ["SUB_SLEEP", "HIBERNATEIDLE", true],
  "hibernate-timeout-dc": ["SUB_SLEEP", "HIBERNATEIDLE", false],
  "monitor-timeout-ac": ["SUB_VIDEO", "VIDEOIDLE", true],
  "monitor-timeout-dc": ["SUB_VIDEO", "VIDEOIDLE", false],
};

const SC_START: Record<string, string> = {
  demand: "Manual",
  auto: "Automatic",
  disabled: "Disabled",
};

/** Turn one recorded command into a check, or null when it isn't checkable on
 *  its own (the opaque blocks are covered by moduleChecks). */
export function checkForCommand(module: string, cmd: string[]): CheckSpec | null {
  const [exe, ...a] = cmd;
  if (exe === "reg" && a[0] === "add") {
    const key = a[1] ?? "";
    const name = a[a.indexOf("/v") + 1] ?? "";
    const type = a[a.indexOf("/t") + 1] ?? "REG_SZ";
    const data = a[a.indexOf("/d") + 1] ?? "";
    const hive = HIVES[key.split("\\")[0] ?? ""];
    if (!hive || !name) return null;
    const path = `${hive}${key.slice(key.indexOf("\\"))}`;
    if (/PersonalizationCSP/.test(key) && /(Path|Url)$/.test(name)) {
      // The strip kit copies images to Pictures, so check the file the value
      // points at exists rather than one fixed path.
      return {
        id: `${module}:${name}`,
        label: name,
        body: `$v = (Get-ItemProperty -LiteralPath ${psq(path)} -Name ${psq(name)} -ErrorAction SilentlyContinue).${name}
    if (-not $v) { return "${name} isn't set" }
    if (-not (Test-Path -LiteralPath $v)) { return "$v doesn't exist" }
    $true`,
      };
    }
    const number = type === "REG_DWORD" || type === "REG_QWORD";
    return {
      id: `${module}:${name}`,
      label: `${name} = ${data}`,
      body: `RegIs ${psq(path)} ${psq(name)} ${psq(data)}${number ? " -Number" : ""}`,
    };
  }
  if (exe === "sc.exe" && a[0] === "config") {
    const svc = a[1] ?? "";
    const want = SC_START[a[a.indexOf("start=") + 1] ?? ""];
    if (!svc || !want) return null;
    return {
      id: `${module}:svc:${svc}`,
      label: `${svc} starts ${want}`,
      body: `SvcStart ${psq(svc)} ${psq(want)}`,
    };
  }
  if (exe === "winget" && a[0] === "install") {
    const id = a[a.indexOf("--id") + 1] ?? "";
    if (!id) return null;
    return { id: `${module}:winget:${id}`, label: id, body: `WingetHas ${psq(id)}` };
  }
  if (exe === "powercfg") {
    if (a[0] === "/hibernate") {
      return {
        id: `${module}:hibernate`,
        label: a[1] === "off" ? "Hibernate off" : "Hibernate enabled",
        body:
          a[1] === "off"
            ? `RegIs 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power' 'HibernateEnabled' '0' -Number`
            : `if (-not (CanHibernate)) { return "SKIP: this device's firmware doesn't support hibernation" }
    RegIs 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power' 'HibernateEnabled' '1' -Number`,
      };
    }
    if (a[0] === "/change") {
      const m = POWER_CHANGE[a[1] ?? ""];
      if (!m) return null;
      const secs = Number(a[2] ?? 0) * 60;
      return {
        id: `${module}:${a[1]}`,
        label: `${a[1]} = ${a[2]} min`,
        body: `PowerIdx ${m[0]} ${m[1]} $${m[2]} ${secs}`,
      };
    }
    if (a[0] === "/setacvalueindex" || a[0] === "/setdcvalueindex") {
      const ac = a[0] === "/setacvalueindex";
      return {
        id: `${module}:${a[2]}-${a[3]}-${ac ? "ac" : "dc"}`,
        label: `${a[3]} (${ac ? "plugged in" : "battery"}) = ${a[4]}`,
        body: `PowerIdx ${a[2]} ${a[3]} $${ac} ${Number(a[4] ?? 0)}`,
      };
    }
  }
  return null;
}

/** Checks for modules whose work is an opaque PowerShell block. */
function moduleChecks(module: string, cfg: BootibleConfig): CheckSpec[] {
  const s = cfg.settings ?? {};
  switch (module) {
    case "windows-defaults":
      return [
        {
          id: "windows-defaults:copilot-app",
          label: "Copilot app removed",
          body: `if (Appx '*Copilot*') { return "the Copilot app is still installed" }; $true`,
        },
      ];
    case "ssh-key": {
      const keys = [
        ...((s.ssh_public_keys as string[] | undefined) ?? []),
        ...(typeof s.ssh_public_key === "string" ? [s.ssh_public_key] : []),
      ].filter(Boolean);
      const out: CheckSpec[] = [
        {
          id: "ssh-key:sshd",
          label: "SSH server running, starts automatically",
          body: `$v = Get-Service sshd -ErrorAction SilentlyContinue
    if (-not $v) { return "sshd isn't installed" }
    if ("$($v.Status)" -ne 'Running') { return "sshd is $($v.Status)" }
    if ("$($v.StartType)" -ne 'Automatic') { return "sshd starts $($v.StartType)" }
    $true`,
        },
        {
          id: "ssh-key:firewall",
          label: "Firewall allows SSH",
          body: `$v = Get-NetFirewallRule -Name bootible-sshd -ErrorAction SilentlyContinue
    if (-not $v) { return "no bootible-sshd firewall rule" }
    if ("$($v.Enabled)" -ne 'True') { return "the bootible-sshd rule is disabled" }
    $true`,
        },
      ];
      if (keys.length > 0) {
        out.push({
          id: "ssh-key:keys",
          label: `SSH keys (${keys.length})`,
          body: `$have = @(Get-Content "$env:ProgramData\\ssh\\administrators_authorized_keys" -ErrorAction SilentlyContinue | ForEach-Object { $_.Trim() })
    $missing = @(${keys.map((k) => psq(k.trim())).join(", ")} | Where-Object { $have -notcontains $_ }).Count
    if ($missing) { return "$missing key(s) missing from administrators_authorized_keys" }
    $true`,
        });
      }
      return out;
    }
    case "remote-desktop":
      return [
        {
          id: "remote-desktop:edition",
          label: "Windows edition supports Remote Desktop",
          body: `$c = (Get-CimInstance Win32_OperatingSystem).Caption
    if ($c -notmatch 'Pro|Enterprise|Education') { return "$c can't host Remote Desktop" }
    $true`,
        },
        {
          id: "remote-desktop:firewall",
          label: "Firewall allows Remote Desktop",
          body: `$n = @(Get-NetFirewallRule -Group '@FirewallAPI.dll,-28752' -ErrorAction SilentlyContinue | Where-Object { "$($_.Enabled)" -eq 'True' }).Count
    if (-not $n) { return "no Remote Desktop firewall rules are enabled" }
    $true`,
        },
      ];
    case "static-ip": {
      const ip = s.static_ip as { ip?: string; prefix?: number; gateway?: string } | undefined;
      if (!ip?.ip) return [];
      const want = `${ip.ip}/${ip.prefix ?? 24}`;
      return [
        {
          id: "static-ip:address",
          label: `Static IP ${want}`,
          body: `$a = Get-NetIPAddress -AddressFamily IPv4 -IPAddress ${psq(ip.ip)} -ErrorAction SilentlyContinue
    if (-not $a) { return "${ip.ip} isn't on any adapter" }
    if ($a.PrefixLength -ne ${ip.prefix ?? 24}) { return "prefix is /$($a.PrefixLength)" }
    if ("$($a.PrefixOrigin)" -ne 'Manual') { return "${ip.ip} came from $($a.PrefixOrigin), not a manual setting" }
    $true`,
        },
      ];
    }
    case "sunshine-creds":
      return [
        {
          id: "sunshine-creds:service",
          label: "Sunshine service running",
          body: `$v = Get-Service SunshineService -ErrorAction SilentlyContinue
    if (-not $v) { return "SunshineService isn't installed" }
    if ("$($v.Status)" -ne 'Running') { return "SunshineService is $($v.Status)" }
    $true`,
        },
      ];
    default:
      return [];
  }
}

const STUB_DEVICE = { id: "rog-ally", name: "ROG Ally" } as unknown as DeviceEntry;

/** Record each module's commands separately, so every check knows its module. */
function recordByModule(
  cfg: BootibleConfig,
  path: WindowsBuildManifest["path"],
): Array<{ module: string; cmds: string[][] }> {
  const profile = deviceProfile(cfg.device || "rog-ally") ?? deviceProfile("rog-ally");
  if (!profile) return [];
  // Same module set the provisioner ran: the strip kit falls back to the floor,
  // the bootstrap (USB / run-on-device) treats "no list" as every module.
  const modules =
    path === "strip" ? stripModuleIds(cfg) : (cfg.modules ?? profile.catalog.map((m) => m.id));
  return modules.map((module) => {
    const cmds: string[][] = [];
    const exec: Exec = (cmd) => {
      cmds.push(cmd);
      return "";
    };
    profile.executor(exec).apply({ device: STUB_DEVICE, config: { ...cfg, modules: [module] } });
    return { module, cmds };
  });
}

export function windowsVerifyChecks(m: WindowsBuildManifest): CheckSpec[] {
  const cfg = m.config;
  const checks: CheckSpec[] = [];
  const add = (id: string, label: string, body: string) => checks.push({ id, label, body });

  add(
    "status",
    "Setup finished",
    `$v = (Get-Content 'C:\\bootible\\status.txt' -ErrorAction SilentlyContinue | Select-Object -First 1)
    if (-not $v) { return "no C:\\bootible\\status.txt - setup never ran" }
    if ($v.Trim() -ne 'done') { return "status is $v" }
    $true`,
  );

  if (m.hostname) {
    add(
      "hostname",
      `Computer name ${m.hostname}`,
      `if ($env:COMPUTERNAME -ne ${psq(m.hostname)}) { return "computer name is $env:COMPUTERNAME" }; $true`,
    );
  }
  if (m.account?.mode === "local" && m.account.username) {
    add(
      "account",
      `Local admin account ${m.account.username}`,
      `$u = Get-LocalUser -Name ${psq(m.account.username)} -ErrorAction SilentlyContinue
    if (-not $u) { return "no local user ${m.account.username}" }
    $admins = @(Get-LocalGroupMember -SID S-1-5-32-544 -ErrorAction SilentlyContinue | ForEach-Object { ($_.Name -split '\\\\')[-1] })
    if ($admins -notcontains ${psq(m.account.username)}) { return "${m.account.username} isn't an administrator" }
    $true`,
    );
  }
  if (m.locale) {
    add(
      "locale",
      `Region ${m.locale}`,
      `$v = (Get-WinSystemLocale).Name; if ($v -ne ${psq(m.locale)}) { return "system locale is $v" }; $true`,
    );
  }
  if (m.timeZone) {
    add(
      "timezone",
      `Time zone ${m.timeZone}`,
      `$v = (Get-TimeZone).Id; if ($v -ne ${psq(m.timeZone)}) { return "time zone is $v" }; $true`,
    );
  }

  if (m.path === "strip") {
    add(
      "restore-point",
      "Restore point before the strip",
      `$d = @(Get-ComputerRestorePoint -ErrorAction SilentlyContinue | ForEach-Object { $_.Description })
    if ($d -notcontains 'Factory ROG (pre-bootible strip)') { return "SKIP: no pre-strip restore point (Windows limits them to one a day)" }
    $true`,
    );
  } else {
    add(
      "restore-point",
      "Restore points before and after",
      `$d = @(Get-ComputerRestorePoint -ErrorAction SilentlyContinue | ForEach-Object { $_.Description })
    $miss = @('Fresh Windows (pre-bootible)', 'bootible configured' | Where-Object { $d -notcontains $_ })
    if ($miss.Count) { return "missing: $($miss -join ', ')" }
    $true`,
    );
  }

  const seen = new Set<string>();
  for (const { module, cmds } of recordByModule(cfg, m.path)) {
    for (const cmd of cmds) {
      const c = checkForCommand(module, cmd);
      if (c && !seen.has(c.id)) {
        seen.add(c.id);
        checks.push(c);
      }
    }
    for (const c of moduleChecks(module, cfg)) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        checks.push(c);
      }
    }
  }

  if (m.path === "strip") {
    const chosen = cfg.settings?.strip_removals as string[] | undefined;
    const entries = chosen?.length
      ? REMOVAL_CATALOG.filter((e) => chosen.includes(e.id))
      : REMOVAL_CATALOG.filter((e) => e.recommended);
    const guard = KEEP_GUARD.map(psq).join(", ");
    for (const e of entries) {
      const appx = (e.appx ?? []).map(psq).join(", ");
      const win32 = (e.win32 ?? []).map(psq).join(", ");
      add(
        `removed:${e.id}`,
        `Removed: ${e.name}`,
        `$guard = @(${guard})
    $kept = { param($n) [bool]($guard | Where-Object { $n -like "*$_*" }) }
    foreach ($p in @(${appx})) {
      $left = @(Appx $p | Where-Object { -not (& $kept $_.Name) })
      if ($left.Count) { return "still installed: $($left[0].Name)" }
    }
    $keys = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*', 'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*', 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
    foreach ($w in @(${win32})) {
      $left = @(Get-ItemProperty $keys -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like "*$w*" -and -not (& $kept $_.DisplayName) })
      if ($left.Count) { return "still installed: $($left[0].DisplayName) (some uninstallers finish after a reboot)" }
    }
    $true`,
      );
    }
  }

  const browser = cfg.settings?.default_browser as string | undefined;
  if (browser && catalogApp(browser)) {
    add(
      "default-browser",
      `Default browser ${catalogApp(browser)?.name}`,
      `$p = (Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice' -ErrorAction SilentlyContinue).ProgId
    return "SKIP: Windows only lets you pick this yourself (current: $(if ($p) { $p } else { 'not set' }))"`,
    );
  }

  return checks;
}

/** Where the app copies the verify script on the device. It goes over as a file,
 *  not on stdin: Win32-OpenSSH's stdin pipe to a PowerShell child truncates or
 *  stalls on large input on some sshd versions (the OpenSSH Preview bootible's
 *  ssh-key module installs hung on a 30 KB script). */
export const WINDOWS_VERIFY_PATH = "C:\\bootible\\verify.ps1";

/** PowerShell arguments that run a verify script saved at `path`. */
export function windowsVerifyArgs(path: string): string[] {
  return ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", path];
}

/** The full PowerShell script: prelude then one Run per check. */
export function generateWindowsVerify(m: WindowsBuildManifest): string {
  const runs = windowsVerifyChecks(m)
    .map((c) => `Run ${psq(c.id)} ${psq(c.label)} {\n    ${c.body}\n}`)
    .join("\n");
  return `${PRELUDE}\n${runs}\n`;
}
