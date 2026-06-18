import { contextBridge } from "electron";

// The renderer surface. Kept tiny for now; provisioning IPC lands as the app grows.
contextBridge.exposeInMainWorld("bootible", {
  version: "v2 (dev)",
});
