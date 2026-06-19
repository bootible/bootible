import type { DeviceSummary, GroupSummary, StepEvent } from "@bootible/core";
import { contextBridge, ipcRenderer } from "electron";

export interface ProvisionResult {
  applied: number;
  skipped: number;
}

// The renderer surface. Each call forwards to a main-process IPC handler that
// drives @bootible/core. Provisioning streams step events back over the
// provision:step / provision:done channels.
const api = {
  version: "v2 (dev)",
  getDevice: (): Promise<DeviceSummary | null> => ipcRenderer.invoke("device:get"),
  getCatalog: (): Promise<GroupSummary[]> => ipcRenderer.invoke("catalog:get"),
  provision: (): Promise<ProvisionResult> => ipcRenderer.invoke("provision:run"),
  onProvisionStep: (cb: (event: StepEvent) => void): void => {
    ipcRenderer.on("provision:step", (_e, event: StepEvent) => cb(event));
  },
  onProvisionDone: (cb: (result: ProvisionResult) => void): void => {
    ipcRenderer.on("provision:done", (_e, result: ProvisionResult) => cb(result));
  },
};

export type BootibleApi = typeof api;

contextBridge.exposeInMainWorld("bootible", api);
