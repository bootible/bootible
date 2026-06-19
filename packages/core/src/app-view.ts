import type { DeviceEntry } from "./registry";

/** A registry device projected into the shape the desktop renderer needs. */
export interface DeviceSummary {
  id: string;
  name: string;
  /** Human display of the device's OS, e.g. "Windows". */
  system: string;
  /** The device's primary provisioning model. */
  provisioning: string;
  /** How many systems this device emulates well (capabilities.great). */
  emulationCount: number;
}

const OS_NAMES: Record<string, string> = {
  windows: "Windows",
  linux: "Linux",
  steamos: "SteamOS",
  macos: "macOS",
};

/** Map a Node `process.platform` value to a registry `os` id. */
const PLATFORM_OS: Record<string, string> = {
  win32: "windows",
  linux: "linux",
  darwin: "macos",
};

/** Display name for an `os` registry id, title-casing anything unknown. */
export function prettyOs(os: string): string {
  return OS_NAMES[os] ?? os.charAt(0).toUpperCase() + os.slice(1);
}

/** Project a registry entry into the renderer's device view-model. */
export function deviceSummary(entry: DeviceEntry): DeviceSummary {
  const os = typeof entry.os === "string" ? entry.os : "unknown";
  return {
    id: entry.id,
    name: entry.name,
    system: prettyOs(os),
    provisioning: entry.provisioning_models[0] ?? "guided",
    emulationCount: entry.capabilities?.great?.length ?? 0,
  };
}

/**
 * Pick the registry entry whose `os` matches the running platform. Returns
 * null when nothing matches — the renderer then shows its no-device state.
 */
export function selectDevice(
  registry: DeviceEntry[],
  platform: NodeJS.Platform,
): DeviceEntry | null {
  const os = PLATFORM_OS[platform] ?? platform;
  return registry.find((entry) => typeof entry.os === "string" && entry.os === os) ?? null;
}
