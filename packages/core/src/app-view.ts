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
  windows: "Windows 11",
  linux: "Linux",
  steamos: "SteamOS",
  macos: "macOS",
};

/** What the running machine reports about itself, for hardware detection. */
export interface SystemInfo {
  platform: NodeJS.Platform;
  manufacturer?: string;
  model?: string;
}

/** Display name for an `os` registry id, title-casing anything unknown. */
export function prettyOs(os: string): string {
  return OS_NAMES[os] ?? os.charAt(0).toUpperCase() + os.slice(1);
}

/** True when the machine matches a device's hardware whitelist (case-insensitive). */
function matchesHardware(entry: DeviceEntry, system: SystemInfo): boolean {
  const detect = entry.detect;
  if (!detect) return false; // no whitelist → never auto-detected
  if (detect.manufacturer) {
    const want = detect.manufacturer.toLowerCase();
    if (!(system.manufacturer ?? "").toLowerCase().includes(want)) return false;
  }
  if (detect.models?.length) {
    const model = (system.model ?? "").toLowerCase();
    if (!detect.models.some((m) => model.includes(m.toLowerCase()))) return false;
  }
  return true;
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
 * Pick the registry entry whose hardware whitelist matches this machine. It's
 * a whitelist, not a greylist: only an explicit hardware match counts, so a
 * non-handheld (or any device without a `detect` block) returns null and the
 * renderer shows its no-device state. This is what hard-blocks "Run on device"
 * from touching the wrong machine.
 */
export function selectDevice(registry: DeviceEntry[], system: SystemInfo): DeviceEntry | null {
  return registry.find((entry) => matchesHardware(entry, system)) ?? null;
}
