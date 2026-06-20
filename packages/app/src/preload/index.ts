import type {
  DeviceSummary,
  GroupSummary,
  ModuleStateReport,
  ProvisioningMethod,
  StepEvent,
} from "@bootible/core";
import { contextBridge, ipcRenderer } from "electron";

export interface ProvisionResult {
  applied: number;
  skipped: number;
}

export interface UsbBuildRequest {
  groups: string[];
  account: { mode: "local" | "microsoft"; username?: string; password?: string };
  wifi?: { ssid: string; password: string };
}

// The renderer surface. Each call forwards to a main-process IPC handler that
// drives @bootible/core. Provisioning streams step events back over the
// provision:step / provision:done channels.
const api = {
  version: "v2 (dev)",
  getDevice: (): Promise<DeviceSummary | null> => ipcRenderer.invoke("device:get"),
  getCatalog: (): Promise<GroupSummary[]> => ipcRenderer.invoke("catalog:get"),
  getState: (): Promise<ModuleStateReport[]> => ipcRenderer.invoke("device:state"),
  getMethods: (): Promise<ProvisioningMethod[]> => ipcRenderer.invoke("methods:get"),
  provision: (): Promise<ProvisionResult> => ipcRenderer.invoke("provision:run"),
  exportConfig: (groups: string[]): Promise<{ path: string } | null> =>
    ipcRenderer.invoke("config:export", groups),
  buildUsb: (req: UsbBuildRequest): Promise<{ stagingPath: string; command: string } | null> =>
    ipcRenderer.invoke("usb:build", req),
  openPath: (path: string): Promise<string> => ipcRenderer.invoke("shell:open", path),
  applyDevice: (req: UsbBuildRequest): Promise<{ status: "blocked" | "cancelled" | "launched" }> =>
    ipcRenderer.invoke("device:apply", req),
  onProvisionStep: (cb: (event: StepEvent) => void): void => {
    ipcRenderer.on("provision:step", (_e, event: StepEvent) => cb(event));
  },
  onProvisionDone: (cb: (result: ProvisionResult) => void): void => {
    ipcRenderer.on("provision:done", (_e, result: ProvisionResult) => cb(result));
  },
};

export type BootibleApi = typeof api;

contextBridge.exposeInMainWorld("bootible", api);
