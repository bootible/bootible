import { join } from "node:path";
import { app } from "electron";

// Resource roots. In dev, schemas/registry live at the repo root and the USB
// script under packages/app/resources. In a packaged app they're shipped as
// extraResources under process.resourcesPath (see electron-builder config).
export const repoRoot = join(__dirname, "../../../../");
export const dataRoot = app.isPackaged ? process.resourcesPath : repoRoot;
export const prepareUsbScript = app.isPackaged
  ? join(process.resourcesPath, "prepare-usb.ps1")
  : join(repoRoot, "packages/app/resources/prepare-usb.ps1");
export const prepareDeckUsbScript = app.isPackaged
  ? join(process.resourcesPath, "prepare-deck-usb.ps1")
  : join(repoRoot, "packages/app/resources/prepare-deck-usb.ps1");
