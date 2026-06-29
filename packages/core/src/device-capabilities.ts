/**
 * What each device can do, as DATA — the single source for the "device is data /
 * UI is a capability registry" standard. The renderer assembles the configure
 * screen by walking these capabilities (a new device = an entry here, no new
 * frontend); script generators / main read the same facts instead of re-deriving
 * them per device. Additive: existing call paths are migrated onto this over time.
 */
import type { DeviceFamily } from "./profile-schema";

export type MediaMode = "provision" | "reimage" | "usb-install";

export interface NetworkCapability {
  /** Can pin a fixed IP at all. */
  staticIp: boolean;
  /** Interfaces the device can target. */
  interfaces: ("wifi" | "ethernet")[];
  /** Can the host infer prefix/gateway/dns (so the user types only the address)?
   *  True for ROG (USB built on this PC); false for the Deck (provisioned standalone). */
  inferFromHost: boolean;
}

export interface DeviceCapabilities {
  family: DeviceFamily;
  apps: boolean;
  emulators: boolean;
  network: NetworkCapability;
  ssh: boolean;
  streaming: boolean;
  /** Which bootable-media outcomes this device offers. */
  media: MediaMode[];
}

const CAPABILITIES: Record<string, DeviceCapabilities> = {
  "rog-ally": {
    family: "windows",
    apps: true,
    emulators: true,
    network: { staticIp: true, interfaces: ["wifi", "ethernet"], inferFromHost: true },
    ssh: true,
    streaming: true,
    media: ["usb-install"],
  },
  steamdeck: {
    family: "steamos",
    apps: true,
    emulators: true,
    network: { staticIp: true, interfaces: ["wifi", "ethernet"], inferFromHost: false },
    ssh: true,
    streaming: true,
    media: ["provision", "reimage"],
  },
};

/** Capabilities for a device id, or undefined if it isn't registered. */
export function capabilitiesFor(deviceId: string | undefined): DeviceCapabilities | undefined {
  if (!deviceId) return undefined;
  return CAPABILITIES[deviceId];
}

/** Every registered device id. */
export function devicesWithCapabilities(): string[] {
  return Object.keys(CAPABILITIES);
}
