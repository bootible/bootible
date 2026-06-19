import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  allyCatalog,
  allyExecutor,
  type DeviceEntry,
  type DeviceSummary,
  deviceSummary,
  type Exec,
  type GroupSummary,
  groupCatalog,
  loadRegistry,
  type StepEvent,
  selectDevice,
} from "@bootible/core";
import { app, BrowserWindow, ipcMain, type WebContents } from "electron";

// NOTE (dev): schemas + registry are resolved relative to the repo root. The
// packaged app will embed them instead — a follow-on slice. From the built
// main at packages/app/out/main/, the repo root is four levels up.
const repoRoot = join(__dirname, "../../../../");

/** Load the registry and the device entry matching this platform, or null. */
function loadDeviceEntry(): DeviceEntry | null {
  const deviceSchema = JSON.parse(
    readFileSync(join(repoRoot, "schemas/device.schema.json"), "utf8"),
  );
  const registry = loadRegistry(join(repoRoot, "registry/devices"), deviceSchema);
  return selectDevice(registry, process.platform);
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

/** The device's module catalog, grouped for the setup screen. */
function getCatalog(): GroupSummary[] {
  return groupCatalog(allyCatalog);
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
  if (!device) {
    sender.send("provision:done", { applied: 0, skipped: 0 });
    return { applied: 0, skipped: 0 };
  }

  const config = { schema: 2 as const, device: device.id, settings: RECOMMENDED_SETTINGS };
  const dryRun: Exec = () => ""; // record nothing, execute nothing

  const queue: StepEvent[] = [];
  allyExecutor(dryRun).apply({ device, config }, (event) => queue.push(event));

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
  ipcMain.handle("catalog:get", () => getCatalog());
  ipcMain.handle("provision:run", (event) => provision(event.sender));
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
