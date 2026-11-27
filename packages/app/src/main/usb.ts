import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  type AccountMode,
  buildConfig,
  buildSettings,
  buildUsbBundle,
  CHANNELS,
  chosenKeys,
  defaultKeyboardRegion,
  keyboardRegionById,
  resolveModules,
  type UsbBuildRequest,
  type UsbBuildSpec,
  type UsbDisk,
  type UsbWriteRequest,
} from "@bootible/core";
import { app, type WebContents } from "electron";
import { lastBuild, sanitizeHostname } from "./build-state";
import { ISO_CATALOG } from "./iso";
import { prepareUsbScript } from "./paths";
import { profileFor, targetDevice } from "./registry";
import { identityForKeys } from "./ssh";

/** Quick-format a removable drive to exFAT (elevated — one UAC prompt). */
export function formatUsbDrive(driveLetter: string): { ok: boolean } {
  // Reduce to a single A–Z letter — stripping only ':'/'\' would let "C; <cmd>"
  // through, and ';' starts a second statement in the elevated inner -Command.
  const d = (driveLetter.replace(/[^A-Za-z]/g, "")[0] ?? "").toUpperCase();
  if (!d) return { ok: false };
  const inner = `Format-Volume -DriveLetter ${d} -FileSystem exFAT -NewFileSystemLabel BOOTIBLE -Confirm:$false`;
  const innerQuoted = `'${inner.replace(/'/g, "''")}'`;
  try {
    execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList @('-NoProfile','-Command',${innerQuoted})`,
      ],
      { timeout: 180000 },
    );
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Safely eject a removable drive by letter. Shell.Application COM needs a
 *  single-threaded apartment, which an Electron-spawned PowerShell lacks by
 *  default (-STA fixes it); the verb name is localised, so match it case-insens. */
export function ejectUsb(driveLetter: string): { ok: boolean } {
  const L = (driveLetter.replace(/[:\\]/g, "")[0] ?? "").toUpperCase();
  if (!/^[A-Z]$/.test(L)) return { ok: false };
  // Reliable eject: open the volume and issue the Win32 lock/dismount/eject IOCTLs
  // (Shell.Application's Eject silently no-ops when a handle is open and always
  // reports success). Fall back to the shell verb, then VERIFY the drive is gone
  // so we report the truth instead of a false success.
  const script = `$ErrorActionPreference = 'SilentlyContinue'
$L = '${L}'
$dev = '\\\\.\\' + $L + ':'
$root = $L + ':\\'
Add-Type -Name Ej -Namespace Bt -MemberDefinition @'
[DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
public static extern IntPtr CreateFileW(string n, uint a, uint s, IntPtr sec, uint c, uint f, IntPtr t);
[DllImport("kernel32.dll", SetLastError=true)]
public static extern bool DeviceIoControl(IntPtr h, uint code, IntPtr i, uint isz, IntPtr o, uint osz, out uint r, IntPtr ov);
[DllImport("kernel32.dll", SetLastError=true)]
public static extern bool CloseHandle(IntPtr h);
'@
$h = [Bt.Ej]::CreateFileW($dev, 0xC0000000, 3, [IntPtr]::Zero, 3, 0, [IntPtr]::Zero)
if ($h.ToInt64() -ne -1) {
  $r = 0
  [void][Bt.Ej]::DeviceIoControl($h, 0x90018, [IntPtr]::Zero, 0, [IntPtr]::Zero, 0, [ref]$r, [IntPtr]::Zero)
  [void][Bt.Ej]::DeviceIoControl($h, 0x90020, [IntPtr]::Zero, 0, [IntPtr]::Zero, 0, [ref]$r, [IntPtr]::Zero)
  [void][Bt.Ej]::DeviceIoControl($h, 0x2D4808, [IntPtr]::Zero, 0, [IntPtr]::Zero, 0, [ref]$r, [IntPtr]::Zero)
  [void][Bt.Ej]::CloseHandle($h)
}
Start-Sleep -Milliseconds 700
if (Test-Path $root) {
  try { $s = New-Object -ComObject Shell.Application; $s.Namespace(17).ParseName($L + ':').InvokeVerb('Eject') } catch {}
  Start-Sleep -Milliseconds 1300
}
if (Test-Path $root) { 'FAILED' } else { 'EJECTED' }`;
  try {
    const tmp = join(app.getPath("temp"), `bootible-eject-${L}.ps1`);
    writeFileSync(tmp, script, "utf8");
    const out = execFileSync(
      "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-STA", "-File", tmp],
      { timeout: 20000, encoding: "utf8" },
    );
    return { ok: /EJECTED/.test(out) };
  } catch {
    return { ok: false };
  }
}

/** Eject a USB by DISK NUMBER (the boot-USB writers — clean-install + reimage —
 *  pick by number, and the flashed payload/installer partition only gets a drive
 *  letter after the write). Resolve the disk's first lettered volume, then eject
 *  via that letter (the physical device goes with it). */
export function ejectUsbDisk(diskNumber: number): { ok: boolean } {
  if (validDiskNumber(diskNumber) === null) return { ok: false };
  try {
    const letter = execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `(Get-Partition -DiskNumber ${diskNumber} -ErrorAction SilentlyContinue | Get-Volume -ErrorAction SilentlyContinue | Where-Object DriveLetter | Select-Object -First 1 -ExpandProperty DriveLetter)`,
      ],
      { timeout: 15000, encoding: "utf8" },
    ).trim();
    if (!/^[A-Za-z]$/.test(letter)) return { ok: false };
    return ejectUsb(letter);
  } catch {
    return { ok: false };
  }
}

/** Assemble the USB bundle (autounattend + bootstrap + config + wifi) into a
 *  staging folder. Returns the path, or null if there's no device profile. */
function stageUsbBundle(req: UsbBuildRequest): string | null {
  const device = targetDevice();
  const profile = profileFor(device);
  if (!device || !profile) return null;

  const modules = resolveModules(req);
  const config = buildConfig({
    device: device.id,
    modules: modules.length ? modules : undefined,
    settings: buildSettings(req),
  });
  const account: AccountMode =
    req.account.mode === "local"
      ? { mode: "local", username: req.account.username || "ally", password: req.account.password }
      : { mode: "microsoft" };
  // The answer file's UI language is taken from the SAME catalog entry as the
  // ISO download, so the image and the autounattend always agree (no Setup
  // language prompt). Region/keyboard is an independent choice (default NZ).
  const isoOption = ISO_CATALOG.find((o) => o.id === req.isoId);
  const region = keyboardRegionById(req.regionId) ?? defaultKeyboardRegion();
  // A fresh build token, baked into the beacon, so the desktop recognises the
  // exact device it built when it announces itself on the LAN.
  lastBuild.id = randomBytes(6).toString("hex");
  // Remember how to SSH in for Verify (local account name + matching private key)
  // and the hostname for the `ssh <hostname>` alias.
  lastBuild.username = account.mode === "local" ? account.username || "ally" : "";
  lastBuild.identity = identityForKeys(chosenKeys(req));
  lastBuild.hostname = sanitizeHostname(req.hostname);
  const spec: UsbBuildSpec = {
    device,
    config,
    account,
    wifi: req.wifi,
    uiLanguage: isoOption?.uiLanguage,
    locale: region.locale,
    buildId: lastBuild.id,
    computerName: lastBuild.hostname || undefined,
    edition: req.edition === "pro" ? "Windows 11 Pro" : "Windows 11 Home",
    wallpaperPath: req.wallpaperPath,
    lockscreenPath: req.lockscreenPath,
  };

  const stagingPath = join(app.getPath("temp"), "bootible-usb-bundle");
  rmSync(stagingPath, { recursive: true, force: true });
  for (const file of buildUsbBundle(spec, profile.executor)) {
    const dest = join(stagingPath, file.path);
    mkdirSync(dirname(dest), { recursive: true });
    if (file.copyFrom) {
      // Binary asset (wallpaper / lock screen) \u2014 copy the host file verbatim.
      copyFileSync(file.copyFrom, dest);
      continue;
    }
    // .ps1 files get a UTF-8 BOM so the Ally's Windows PowerShell 5.1 reads any
    // non-ASCII (em-dashes in copy) correctly instead of as ANSI mojibake.
    const content = dest.endsWith(".ps1") ? `\uFEFF${file.content}` : file.content;
    writeFileSync(dest, content, "utf8");
  }
  return stagingPath;
}

/**
 * Method A (manual fallback) — stage the bundle + drop prepare-usb.ps1 beside it
 * so the user can run it themselves. The in-app writer below is the main path.
 */
export function buildUsb(req: UsbBuildRequest): { stagingPath: string; command: string } | null {
  const stagingPath = stageUsbBundle(req);
  if (!stagingPath) return null;
  copyFileSync(prepareUsbScript, join(stagingPath, "prepare-usb.ps1"));
  return {
    stagingPath,
    command: "Right-click prepare-usb.ps1 in this folder → Run as administrator.",
  };
}

/** Tail the writer's NDJSON progress file and stream each line to the renderer. */
export function tailUsbProgress(sender: WebContents, file: string): void {
  let offset = 0;
  const timer = setInterval(() => {
    let content: string;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      return;
    }
    if (content.length <= offset) return;
    const fresh = content.slice(offset);
    offset = content.length;
    for (const line of fresh.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const event = JSON.parse(trimmed) as { pct: number; message: string; status: string };
        if (!sender.isDestroyed()) sender.send(CHANNELS.usbProgress, event);
        if (event.status === "done" || event.status === "error") clearInterval(timer);
      } catch {
        // partial / non-JSON line; ignore
      }
    }
  }, 500);
  setTimeout(() => clearInterval(timer), 30 * 60 * 1000); // safety stop
}

/** Single-quote a value for embedding in a PowerShell script literal. */
export function psQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** A real disk index, or null. `diskNumber` is interpolated RAW (unquoted) into
 *  the elevated writer, and IPC payloads aren't runtime-typed — so a non-integer
 *  must be rejected at the boundary, not trusted from the TS signature. */
export function validDiskNumber(n: unknown): number | null {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 99 ? n : null;
}

/**
 * The in-app USB write: stage the bundle, then launch prepare-usb.ps1 elevated
 * (one UAC) and hidden, feeding a progress file the app tails. The disk + ISO
 * are chosen in-app and passed as args, so the writer never prompts.
 */
export function writeUsb(sender: WebContents, req: UsbWriteRequest): { started: boolean } {
  if (validDiskNumber(req.diskNumber) === null) {
    sender.send(CHANNELS.usbProgress, {
      pct: 0,
      status: "error",
      message: "Invalid disk selection.",
    });
    return { started: false };
  }
  const stagingPath = stageUsbBundle(req);
  if (!stagingPath) {
    sender.send(CHANNELS.usbProgress, {
      pct: 0,
      status: "error",
      message: "No device to build for.",
    });
    return { started: false };
  }

  const progressFile = join(app.getPath("temp"), "bootible-usb-progress.ndjson");
  writeFileSync(progressFile, "");

  // Build the writer call with values BAKED IN (PowerShell-quoted). Passing args
  // through `Start-Process -Verb RunAs -ArgumentList @(...)` flattens the array
  // with spaces and drops quoting — so a path or value with a space (e.g.
  // "English International") silently breaks parameter binding. A generated
  // runner script sidesteps that entirely: the only arg to the elevated shell is
  // a -File path (no spaces), and a try/catch writes any failure to the progress
  // file so a write never hangs silently.
  const callParts = [
    psQuote(prepareUsbScript),
    `-BundleDir ${psQuote(stagingPath)}`,
    `-DiskNumber ${req.diskNumber}`,
    "-Force",
    // The UI already took an explicit erase confirmation; skip the script's
    // ShouldProcess prompt (ConfirmImpact=High) so the hidden process doesn't
    // hang waiting for a "yes" it can never receive.
    "-Confirm:$false",
    `-ProgressFile ${psQuote(progressFile)}`,
  ];
  if (req.isoPath) {
    callParts.push(`-IsoPath ${psQuote(req.isoPath)}`);
  } else if (req.isoId) {
    const option = ISO_CATALOG.find((c) => c.id === req.isoId);
    if (option) {
      callParts.push(
        `-IsoRel ${psQuote(option.rel)} -IsoEd ${psQuote(option.ed)} -IsoLang ${psQuote(option.lang)} -IsoArch ${psQuote(option.arch)}`,
      );
    }
  }

  const runner = [
    "$ErrorActionPreference = 'Stop'",
    "try {",
    `  & ${callParts.join(" ")}`,
    "} catch {",
    "  $msg = @{ pct = 0; message = $_.Exception.Message; status = 'error' } | ConvertTo-Json -Compress",
    `  [System.IO.File]::AppendAllText(${psQuote(progressFile)}, $msg + [Environment]::NewLine)`,
    "}",
  ].join("\r\n");
  const runnerPath = join(app.getPath("temp"), "bootible-usb-run.ps1");
  writeFileSync(runnerPath, `\uFEFF${runner}`, "utf8");

  // Launch the runner elevated (one UAC) + hidden. Only one arg crosses the
  // RunAs boundary — a -File path in %TEMP% (no spaces).
  const launcher = `Start-Process -FilePath 'powershell' -Verb RunAs -WindowStyle Hidden -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File "${runnerPath}"'`;
  spawn("powershell", ["-NoProfile", "-NonInteractive", "-Command", launcher], {
    windowsHide: true,
  });

  tailUsbProgress(sender, progressFile);
  return { started: true };
}

// ── in-app USB writer: disks + ISO source ───────────────────────────────────

/** Run a PowerShell snippet and return stdout (non-elevated, no window). */
function runPwsh(script: string): string {
  return execFileSync(
    "powershell",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
    { encoding: "utf8", windowsHide: true },
  );
}

/** Removable USB disks with their drive letters + volume label, so the picker
 *  matches what the user sees in Explorer (listing needs no admin). */
export function listUsbDisks(): UsbDisk[] {
  try {
    const script = `Get-Disk | Where-Object BusType -eq 'USB' | ForEach-Object { $d = $_; $vols = Get-Partition -DiskNumber $d.Number -ErrorAction SilentlyContinue | Get-Volume -ErrorAction SilentlyContinue | Where-Object { $_.DriveLetter }; [pscustomobject]@{ Number = $d.Number; Model = $d.FriendlyName; Size = $d.Size; Letters = (($vols | ForEach-Object { "$($_.DriveLetter):" }) -join ' '); Label = (($vols | Where-Object { $_.FileSystemLabel } | Select-Object -First 1).FileSystemLabel) } } | ConvertTo-Json -Compress`;
    const out = runPwsh(script).trim();
    if (!out) return [];
    const parsed = JSON.parse(out);
    const rows: Array<{
      Number: number;
      Model?: string;
      Size: number;
      Letters?: string;
      Label?: string;
    }> = Array.isArray(parsed) ? parsed : [parsed];
    return rows.map((r) => ({
      number: r.Number,
      name: (r.Model ?? "USB disk").trim(),
      sizeGb: Math.round((r.Size / 1024 ** 3) * 10) / 10,
      letters: r.Letters ?? "",
      label: r.Label ?? "",
    }));
  } catch {
    return [];
  }
}
