import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  allyCatalog,
  type DeviceSummary,
  deviceSummary,
  type GroupSummary,
  groupCatalog,
  loadRegistry,
  selectDevice,
} from "@bootible/core";
import { app, BrowserWindow, ipcMain } from "electron";

// NOTE (dev): schemas + registry are resolved relative to the repo root. The
// packaged app will embed them instead — a follow-on slice. From the built
// main at packages/app/out/main/, the repo root is four levels up.
const repoRoot = join(__dirname, "../../../../");

/** Load the registry and project the device matching this platform, or null. */
function getDevice(): DeviceSummary | null {
  try {
    const deviceSchema = JSON.parse(
      readFileSync(join(repoRoot, "schemas/device.schema.json"), "utf8"),
    );
    const registry = loadRegistry(join(repoRoot, "registry/devices"), deviceSchema);
    const entry = selectDevice(registry, process.platform);
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
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
