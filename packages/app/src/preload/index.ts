import type {
  Bundle,
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
  modules: string[];
  account: { mode: "local" | "microsoft"; username?: string; password?: string };
  wifi?: { ssid: string; password: string };
}

export interface UsbDisk {
  number: number;
  name: string;
  sizeGb: number;
}

export interface IsoOption {
  id: string;
  label: string;
}

export interface UsbWriteRequest extends UsbBuildRequest {
  diskNumber: number;
  isoPath?: string;
  isoId?: string;
}

export interface UsbProgress {
  pct: number;
  message: string;
  status: "running" | "done" | "error";
}

// The renderer surface. Each call forwards to a main-process IPC handler that
// drives @bootible/core. Provisioning streams step events back over the
// provision:step / provision:done channels.
const api = {
  version: "v2 (dev)",
  getDevice: (): Promise<DeviceSummary | null> => ipcRenderer.invoke("device:get"),
  getCatalog: (): Promise<GroupSummary[]> => ipcRenderer.invoke("catalog:get"),
  getBundles: (): Promise<Bundle[]> => ipcRenderer.invoke("bundles:get"),
  getState: (): Promise<ModuleStateReport[]> => ipcRenderer.invoke("device:state"),
  getMethods: (): Promise<ProvisioningMethod[]> => ipcRenderer.invoke("methods:get"),
  provision: (): Promise<ProvisionResult> => ipcRenderer.invoke("provision:run"),
  exportConfig: (modules: string[]): Promise<{ path: string } | null> =>
    ipcRenderer.invoke("config:export", modules),
  buildUsb: (req: UsbBuildRequest): Promise<{ stagingPath: string; command: string } | null> =>
    ipcRenderer.invoke("usb:build", req),
  getUsbDisks: (): Promise<UsbDisk[]> => ipcRenderer.invoke("usb:disks"),
  getIsoCatalog: (): Promise<IsoOption[]> => ipcRenderer.invoke("iso:catalog"),
  browseIso: (): Promise<string | null> => ipcRenderer.invoke("iso:browse"),
  writeUsb: (req: UsbWriteRequest): Promise<{ started: boolean }> =>
    ipcRenderer.invoke("usb:write", req),
  onUsbProgress: (cb: (event: UsbProgress) => void): void => {
    ipcRenderer.on("usb:progress", (_e, event: UsbProgress) => cb(event));
  },
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
