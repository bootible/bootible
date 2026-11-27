import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  type BuildChoice,
  buildConfig,
  buildSettings,
  CHANNELS,
  checkModules,
  type Exec,
  generateBootstrapScript,
  type ModuleStateReport,
  RECOMMENDED_SETTINGS,
  resolveModules,
  type StepEvent,
  serializeConfig,
  type UsbBuildRequest,
} from "@bootible/core";
import { app, type BrowserWindow, dialog, type WebContents } from "electron";
import { loadDeviceEntry, profileFor, targetDevice } from "./registry";

/** Probe current module state on the detected device (read-only). [] off-device. */
export function getDeviceState(): ModuleStateReport[] {
  const device = loadDeviceEntry();
  const profile = profileFor(device);
  if (!device || !profile) return [];
  const readExec: Exec = (cmd) => {
    const [file, ...args] = cmd;
    try {
      return execFileSync(file ?? "", args, { encoding: "utf8" });
    } catch (error) {
      return String((error as { stdout?: Buffer }).stdout ?? "");
    }
  };
  const config = buildConfig({ device: device.id, settings: RECOMMENDED_SETTINGS });
  return checkModules(profile.catalog, { device, config }, readExec);
}

/**
 * Method B — serialize the chosen config and let the user save it (a save
 * dialog). Builds the SAME config the USB and run-on-device paths build (same
 * modules + settings) so every approach ends with the device set identically.
 * Returns the written path, or null if cancelled.
 */
export async function exportConfig(
  win: BrowserWindow,
  req: BuildChoice,
): Promise<{ path: string } | null> {
  const modules = resolveModules(req);
  const config = buildConfig({
    device: targetDevice()?.id ?? "rog-ally",
    modules: modules.length ? modules : undefined,
    settings: buildSettings(req),
  });

  const result = await dialog.showSaveDialog(win, {
    title: "Export bootible config",
    defaultPath: "config.yml",
    filters: [{ name: "YAML", extensions: ["yml", "yaml"] }],
  });
  if (result.canceled || !result.filePath) return null;

  writeFileSync(result.filePath, serializeConfig(config), "utf8");
  return { path: result.filePath };
}

/**
 * Method C — apply the config live on THIS device. Hard-blocked unless the
 * machine matches a device whitelist, then confirmed, then run as an elevated
 * bootstrap (restore points + modules) in its own window. Never touches a
 * machine that isn't a recognised handheld.
 */
export async function applyDevice(
  win: BrowserWindow,
  req: UsbBuildRequest,
): Promise<{ status: "blocked" | "cancelled" | "launched" }> {
  const device = loadDeviceEntry();
  const profile = profileFor(device);
  if (!device || !profile) return { status: "blocked" };

  const confirm = await dialog.showMessageBox(win, {
    type: "warning",
    buttons: ["Cancel", "Apply now"],
    defaultId: 0,
    cancelId: 0,
    title: "Apply bootible config",
    message: `Reconfigure this ${device.name}?`,
    detail:
      "bootible will take a 'Fresh Windows' restore point, then apply the selected modules (power, registry tweaks, services, app installs), then a 'configured' restore point. An elevated PowerShell window opens to run it.",
  });
  if (confirm.response !== 1) return { status: "cancelled" };

  // Same base+modifier resolution as the USB path, so every approach ends with
  // the device set identically.
  const modules = resolveModules(req);
  const config = buildConfig({
    device: device.id,
    modules: modules.length ? modules : undefined,
    settings: buildSettings(req),
  });
  const script = generateBootstrapScript({ device, config, executorFactory: profile.executor });
  const dir = join(app.getPath("temp"), "bootible-apply");
  mkdirSync(dir, { recursive: true });
  const scriptPath = join(dir, "bootstrap.ps1");
  writeFileSync(scriptPath, script, "utf8");

  // Launch elevated (UAC) in its own window so the user sees the live work.
  spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `Start-Process powershell -Verb RunAs -ArgumentList '-NoExit','-ExecutionPolicy','Bypass','-File','${scriptPath}'`,
    ],
    { detached: true, stdio: "ignore" },
  ).unref();

  return { status: "launched" };
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run a DRY provision: the executor computes real commands but a no-op runner
 * records them instead of touching the machine. Step events are streamed to
 * the renderer (paced for a live feel) so the log reflects the real module
 * sequence and honest per-module status. Nothing is written to the device.
 */
export async function provision(
  sender: WebContents,
): Promise<{ applied: number; skipped: number }> {
  const device = loadDeviceEntry();
  const profile = profileFor(device);
  if (!device || !profile) {
    sender.send(CHANNELS.provisionDone, { applied: 0, skipped: 0 });
    return { applied: 0, skipped: 0 };
  }

  const config = { schema: 2 as const, device: device.id, settings: RECOMMENDED_SETTINGS };
  const dryRun: Exec = () => ""; // record nothing, execute nothing

  const queue: StepEvent[] = [];
  profile.executor(dryRun).apply({ device, config }, (event) => queue.push(event));

  let applied = 0;
  let skipped = 0;
  for (const event of queue) {
    if (sender.isDestroyed()) break;
    sender.send(CHANNELS.provisionStep, event);
    if (event.status === "running") {
      await delay(260);
    } else {
      if (event.status === "applied") applied += 1;
      if (event.status === "skipped") skipped += 1;
      await delay(110);
    }
  }

  if (!sender.isDestroyed()) sender.send(CHANNELS.provisionDone, { applied, skipped });
  return { applied, skipped };
}
