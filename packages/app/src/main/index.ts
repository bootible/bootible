import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  type AccountMode,
  type Bundle,
  buildConfig,
  buildUsbBundle,
  checkModules,
  type DeviceEntry,
  type DeviceProfile,
  type DeviceSummary,
  deviceProfile,
  deviceSummary,
  type Exec,
  type GroupSummary,
  generateBootstrapScript,
  groupCatalog,
  loadRegistry,
  type ModuleStateReport,
  type ProvisioningMethod,
  provisioningMethods,
  type StepEvent,
  type SystemInfo,
  selectDevice,
  serializeConfig,
  type UsbBuildSpec,
} from "@bootible/core";
import { app, BrowserWindow, dialog, ipcMain, shell, type WebContents } from "electron";

// Resource roots. In dev, schemas/registry live at the repo root and the USB
// script under packages/app/resources. In a packaged app they're shipped as
// extraResources under process.resourcesPath (see electron-builder config).
const repoRoot = join(__dirname, "../../../../");
const dataRoot = app.isPackaged ? process.resourcesPath : repoRoot;
const prepareUsbScript = app.isPackaged
  ? join(process.resourcesPath, "prepare-usb.ps1")
  : join(repoRoot, "packages/app/resources/prepare-usb.ps1");

/** Read a value from the BIOS hardware key (fast, no WMI), or undefined. */
function regBios(value: string): string | undefined {
  try {
    const out = execFileSync(
      "reg",
      ["query", "HKLM\\HARDWARE\\DESCRIPTION\\System\\BIOS", "/v", value],
      { encoding: "utf8" },
    );
    return out.match(new RegExp(`${value}\\s+REG_SZ\\s+(.+)`))?.[1]?.trim();
  } catch {
    return undefined;
  }
}

/** What this machine reports about itself, for hardware whitelist detection. */
function getSystemInfo(): SystemInfo {
  return {
    platform: process.platform,
    manufacturer: regBios("SystemManufacturer"),
    model: regBios("SystemProductName"),
  };
}

/** Load + validate the device registry. */
function loadRegistryEntries(): DeviceEntry[] {
  const deviceSchema = JSON.parse(
    readFileSync(join(dataRoot, "schemas/device.schema.json"), "utf8"),
  );
  return loadRegistry(join(dataRoot, "registry/devices"), deviceSchema);
}

/** The device THIS machine is (hardware whitelist match), or null — used by
 *  detection, on-device state, and the hard-blocked Run-on-device apply. */
function loadDeviceEntry(): DeviceEntry | null {
  return selectDevice(loadRegistryEntries(), getSystemInfo());
}

/** The device we build media / configs FOR (host-side). Defaults to the Ally;
 *  this works from any PC, since you build a handheld's USB from your desktop. */
function targetDevice(): DeviceEntry | null {
  const registry = loadRegistryEntries();
  return registry.find((d) => d.id === "rog-ally") ?? registry[0] ?? null;
}

/** The provisioning profile (catalog + bundles + executor) for a device. */
function profileFor(device: DeviceEntry | null): DeviceProfile | null {
  return device ? deviceProfile(device.id) : null;
}

/** Project the detected device for the renderer, or null if none matches. */
function getDevice(): DeviceSummary | null {
  try {
    const entry = loadDeviceEntry();
    return entry ? deviceSummary(entry) : null;
  } catch (error) {
    console.error("device:get failed", error);
    return null;
  }
}

/** The target device's module catalog, grouped for the setup screen. */
function getCatalog(): GroupSummary[] {
  const profile = profileFor(targetDevice());
  return profile ? groupCatalog(profile.catalog) : [];
}

/** The target device's recommended bundles (the "set it up for me" path). */
function getBundles(): Bundle[] {
  return profileFor(targetDevice())?.bundles ?? [];
}

/** Provisioning methods for the target device — derived from its registry
 *  provisioning_models, so the method screen supports any device type. */
function getMethods(): ProvisioningMethod[] {
  const device = targetDevice();
  return device ? provisioningMethods(device) : [];
}

/** Probe current module state on the detected device (read-only). [] off-device. */
function getDeviceState(): ModuleStateReport[] {
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
 * Method B — serialize the chosen config to a findable spot: a "Bootible"
 * folder on the Desktop, one file per device. Returns the written file and its
 * folder (the account sync is a later, separate path).
 */
function exportConfig(modules: string[]): { path: string; folder: string } {
  const device = targetDevice();
  const config = buildConfig({
    device: device?.id ?? "rog-ally",
    modules: modules.length ? modules : undefined,
  });

  const folder = join(app.getPath("desktop"), "Bootible");
  mkdirSync(folder, { recursive: true });
  const file = join(folder, `${device?.id ?? "config"}-config.yml`);
  writeFileSync(file, serializeConfig(config), "utf8");
  return { path: file, folder };
}

export interface UsbBuildRequest {
  modules: string[];
  account: { mode: "local" | "microsoft"; username?: string; password?: string };
  wifi?: { ssid: string; password: string };
}

/**
 * Method A — assemble the USB bundle and write it to a staging folder, then
 * return the path + the prepare-usb.ps1 command that turns it into a stick.
 * (The destructive, elevated, interactive USB write stays in the script.)
 */
function buildUsb(req: UsbBuildRequest): { stagingPath: string; command: string } | null {
  const device = targetDevice();
  const profile = profileFor(device);
  if (!device || !profile) return null;

  const config = buildConfig({
    device: device.id,
    modules: req.modules.length ? req.modules : undefined,
    settings: RECOMMENDED_SETTINGS,
  });
  const account: AccountMode =
    req.account.mode === "local"
      ? { mode: "local", username: req.account.username || "ally", password: req.account.password }
      : { mode: "microsoft" };
  const spec: UsbBuildSpec = { device, config, account, wifi: req.wifi };

  const stagingPath = join(app.getPath("temp"), "bootible-usb-bundle");
  rmSync(stagingPath, { recursive: true, force: true });
  for (const file of buildUsbBundle(spec, profile.executor)) {
    const dest = join(stagingPath, file.path);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, file.content, "utf8");
  }

  // Drop the builder script beside the bundle so it runs in place (its
  // -BundleDir defaults to its own folder).
  copyFileSync(prepareUsbScript, join(stagingPath, "prepare-usb.ps1"));

  const command = "Right-click prepare-usb.ps1 in this folder → Run as administrator.";
  return { stagingPath, command };
}

/**
 * Method C — apply the config live on THIS device. Hard-blocked unless the
 * machine matches a device whitelist, then confirmed, then run as an elevated
 * bootstrap (restore points + modules) in its own window. Never touches a
 * machine that isn't a recognised handheld.
 */
async function applyDevice(
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

  const config = buildConfig({
    device: device.id,
    modules: req.modules.length ? req.modules : undefined,
    settings: RECOMMENDED_SETTINGS,
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

// bootible's recommended Ally settings — what a default setup would apply.
const RECOMMENDED_SETTINGS = {
  sleep_mode: "hibernate",
  hibernate_after_minutes: 30,
  power_button_action: "sleep",
  disable_cpu_boost_on_battery: true,
};

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run a DRY provision: the executor computes real commands but a no-op runner
 * records them instead of touching the machine. Step events are streamed to
 * the renderer (paced for a live feel) so the log reflects the real module
 * sequence and honest per-module status. Nothing is written to the device.
 */
async function provision(sender: WebContents): Promise<{ applied: number; skipped: number }> {
  const device = loadDeviceEntry();
  const profile = profileFor(device);
  if (!device || !profile) {
    sender.send("provision:done", { applied: 0, skipped: 0 });
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
    sender.send("provision:step", event);
    if (event.status === "running") {
      await delay(260);
    } else {
      if (event.status === "applied") applied += 1;
      if (event.status === "skipped") skipped += 1;
      await delay(110);
    }
  }

  if (!sender.isDestroyed()) sender.send("provision:done", { applied, skipped });
  return { applied, skipped };
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1040,
    height: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#0b0d12",
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      sandbox: false,
    },
  });

  win.on("ready-to-show", () => win.show());

  // BOOTIBLE_VIEW deep-links a starting screen (used for dev screenshots).
  const hash = process.env.BOOTIBLE_VIEW;
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) {
    win.loadURL(hash ? `${devUrl}#${hash}` : devUrl);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"), hash ? { hash } : undefined);
  }
}

app.whenReady().then(() => {
  ipcMain.handle("device:get", () => getDevice());
  ipcMain.handle("device:state", () => getDeviceState());
  ipcMain.handle("catalog:get", () => getCatalog());
  ipcMain.handle("bundles:get", () => getBundles());
  ipcMain.handle("methods:get", () => getMethods());
  ipcMain.handle("provision:run", (event) => provision(event.sender));
  ipcMain.handle("config:export", (_event, modules: string[]) => exportConfig(modules ?? []));
  ipcMain.handle("usb:build", (_event, req: UsbBuildRequest) => buildUsb(req));
  ipcMain.handle("shell:open", (_event, path: string) => shell.openPath(path));
  ipcMain.handle("device:apply", (event, req: UsbBuildRequest) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win ? applyDevice(win, req) : { status: "blocked" };
  });
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
