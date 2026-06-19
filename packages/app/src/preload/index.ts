import type { DeviceSummary } from "@bootible/core";
import { contextBridge, ipcRenderer } from "electron";

// The renderer surface. Each call forwards to a main-process IPC handler that
// drives @bootible/core. More verbs (provision, restore, listBackups) land as
// the app grows.
const api = {
  version: "v2 (dev)",
  getDevice: (): Promise<DeviceSummary | null> => ipcRenderer.invoke("device:get"),
};

export type BootibleApi = typeof api;

contextBridge.exposeInMainWorld("bootible", api);
