import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type DeviceSummary, deviceSummary, loadRegistry, selectDevice } from "@bootible/core";
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

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  ipcMain.handle("device:get", () => getDevice());
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
