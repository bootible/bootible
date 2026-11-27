import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  type BundleFile,
  buildDeckBundle,
  CHANNELS,
  DECK_IMAGE_INDEX,
  type DeckConfig,
  type DeckImage,
  type DeckProvisionUsbRequest,
  resolveDeckImage,
} from "@bootible/core";
import { app, type WebContents } from "electron";
import { lastBuild, sanitizeHostname } from "./build-state";
import { prepareDeckUsbScript } from "./paths";
import { formatUsbDrive, psQuote, tailUsbProgress, validDiskNumber } from "./usb";

// ── Steam Deck / SteamOS carrier (Path A: provision-only USB) ────────────────

/**
 * Path A — provision-only USB. Format the chosen stick to exFAT (label BOOTIBLE)
 * and copy the generated payload (provision.sh + config.json + README) onto it.
 * The user installs/keeps SteamOS themselves (Valve recovery, or an existing
 * install), then runs provision.sh from the stick. No image flash — far simpler
 * and lower risk than the full reimage path, and it works on an already-set-up
 * Deck too. Progress streams on the same `usb:progress` channel the writer uses.
 */
export function writeDeckProvisionUsb(
  sender: WebContents,
  req: DeckProvisionUsbRequest,
): { started: boolean } {
  const letter = (req.driveLetter.replace(/[:\\]/g, "")[0] ?? "").toUpperCase();
  const emit = (pct: number, message: string, status = "running"): void => {
    if (!sender.isDestroyed()) sender.send(CHANNELS.usbProgress, { pct, message, status });
  };
  if (!/^[A-Z]$/.test(letter)) {
    emit(0, "Pick a USB drive first.", "error");
    return { started: false };
  }

  // Generate the payload up front so a config error never touches the stick.
  let files: BundleFile[];
  try {
    emit(5, "Building the bootible payload");
    // A build token so the Deck's end-of-provision beacon is recognised as "mine"
    // on the desktop's Watch screen (the device reports back when provision.sh ends).
    lastBuild.id = randomBytes(6).toString("hex");
    lastBuild.username = "deck"; // SteamOS' default account — for Verify-over-SSH
    lastBuild.hostname = sanitizeHostname(req.config.hostname);
    lastBuild.identity = "";
    files = buildDeckBundle({ ...req.config, buildId: lastBuild.id });
  } catch (error) {
    emit(0, `Couldn't build the payload: ${(error as Error).message}`, "error");
    return { started: false };
  }

  emit(20, "Formatting the USB as exFAT (BOOTIBLE) — one admin prompt");
  if (!formatUsbDrive(letter).ok) {
    emit(0, "Formatting the USB failed (was the admin prompt declined?).", "error");
    return { started: false };
  }

  try {
    emit(70, "Copying the payload onto the USB");
    const root = `${letter}:\\`;
    for (const file of files) {
      const dest = join(root, file.path);
      mkdirSync(dirname(dest), { recursive: true });
      // Plain UTF-8, no BOM: provision.sh is a bash script run on SteamOS, so a
      // BOM would break the shebang. buildDeckBundle emits LF line endings.
      writeFileSync(dest, file.content, "utf8");
    }
  } catch (error) {
    emit(0, `Copying the payload failed: ${(error as Error).message}`, "error");
    return { started: false };
  }

  emit(
    100,
    "Done. Plug it into the Deck while it's awake, then in Desktop Mode open the BOOTIBLE drive and run bootible/provision.sh — then follow README.txt.",
    "done",
  );
  return { started: true };
}

/** Stage the Deck payload (buildDeckBundle) into a temp dir for the reimage
 *  writer to copy from. Plain UTF-8/LF so provision.sh stays bash-safe. */
function stageDeckBundle(config: Partial<DeckConfig>): string {
  const staging = join(app.getPath("temp"), "bootible-deck-bundle");
  rmSync(staging, { recursive: true, force: true });
  for (const file of buildDeckBundle(config)) {
    const dest = join(staging, file.path);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, file.content, "utf8");
  }
  return staging;
}

/** Resolve the newest SteamOS recovery .img.zip from the open CDN index. */
export async function resolveDeckImageUrl(): Promise<DeckImage | null> {
  try {
    const res = await fetch(DECK_IMAGE_INDEX);
    if (!res.ok) return null;
    return resolveDeckImage(await res.text());
  } catch {
    return null;
  }
}

/**
 * Path B — full reimage. Resolve the newest recovery image, then run
 * prepare-deck-usb.ps1 elevated (one UAC, hidden): it downloads the .img.zip,
 * unzips it natively, raw-flashes the disk, appends the exFAT BOOTIBLE payload
 * partition and copies the staged bundle. Progress streams on usb:progress.
 */
export async function writeDeckReimageUsb(
  sender: WebContents,
  req: { diskNumber: number; config: Partial<DeckConfig> },
): Promise<{ started: boolean }> {
  const progressFile = join(app.getPath("temp"), "bootible-deck-progress.ndjson");
  writeFileSync(progressFile, "");
  const emit = (pct: number, message: string, status = "running"): void => {
    if (!sender.isDestroyed()) sender.send(CHANNELS.usbProgress, { pct, message, status });
  };

  if (validDiskNumber(req.diskNumber) === null) {
    emit(0, "Invalid disk selection.", "error");
    return { started: false };
  }

  emit(0, "Finding the latest SteamOS image…");
  const img = await resolveDeckImageUrl();
  if (!img) {
    emit(0, "Couldn't resolve the SteamOS image from the CDN. Check your connection.", "error");
    return { started: false };
  }

  let staging: string;
  try {
    // Same build token as Path A — the reimaged Deck's beacon is matched as "mine".
    lastBuild.id = randomBytes(6).toString("hex");
    lastBuild.username = "deck";
    lastBuild.hostname = sanitizeHostname(req.config.hostname);
    lastBuild.identity = "";
    staging = stageDeckBundle({ ...req.config, buildId: lastBuild.id });
  } catch (error) {
    emit(0, `Couldn't build the payload: ${(error as Error).message}`, "error");
    return { started: false };
  }

  // Bake values in (PowerShell-quoted) + run a generated runner elevated, exactly
  // like the Windows writer — the only arg across the RunAs boundary is a -File
  // path with no spaces, and a try/catch reports failures to the progress file.
  const callParts = [
    psQuote(prepareDeckUsbScript),
    `-ImageUrl ${psQuote(img.url)}`,
    `-DiskNumber ${req.diskNumber}`,
    `-BundleDir ${psQuote(staging)}`,
    "-Force",
    "-Confirm:$false",
    `-ProgressFile ${psQuote(progressFile)}`,
  ];
  const runner = [
    "$ErrorActionPreference = 'Stop'",
    "try {",
    `  & ${callParts.join(" ")}`,
    "} catch {",
    "  $msg = @{ pct = 0; message = $_.Exception.Message; status = 'error' } | ConvertTo-Json -Compress",
    `  [System.IO.File]::AppendAllText(${psQuote(progressFile)}, $msg + [Environment]::NewLine)`,
    "}",
  ].join("\r\n");
  const runnerPath = join(app.getPath("temp"), "bootible-deck-run.ps1");
  writeFileSync(runnerPath, `﻿${runner}`, "utf8");

  emit(1, `Image: ${img.name}`);
  const launcher = `Start-Process -FilePath 'powershell' -Verb RunAs -WindowStyle Hidden -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File "${runnerPath}"'`;
  spawn("powershell", ["-NoProfile", "-NonInteractive", "-Command", launcher], {
    windowsHide: true,
  });
  tailUsbProgress(sender, progressFile);
  return { started: true };
}
