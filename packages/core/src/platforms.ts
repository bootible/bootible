// Handheld platform families — the top of the device picker (page 1). A device's
// platform is derived from its registry `os`, so adding a device is still pure
// data. Availability (ready vs coming-soon) is composed by the host from whether
// a DeviceProfile exists; this module is the static catalog + roadmap.

export type PlatformId = "windows" | "linux" | "android";

export interface DevicePlatform {
  id: PlatformId;
  label: string;
  /** Registry `os` values that belong to this platform (lower-cased match). */
  osValues: string[];
  /** One-line description for the platform card. */
  blurb: string;
}

/** The platform families, in display order. */
export const PLATFORMS: DevicePlatform[] = [
  {
    id: "windows",
    label: "Windows handheld",
    osValues: ["windows"],
    blurb: "ROG Ally, Ally X, Legion Go and other Windows 11 handhelds.",
  },
  {
    id: "linux",
    label: "Linux handheld",
    osValues: ["steamos", "linux"],
    blurb: "Steam Deck and other SteamOS / Linux devices.",
  },
  {
    id: "android",
    label: "Android handheld",
    osValues: ["android"],
    blurb: "Retroid, AYN Odin and Android-based handhelds.",
  },
];

/** Map a registry `os` to its platform family, or undefined if unrecognised. */
export function platformForOs(os: string | undefined): PlatformId | undefined {
  if (!os) return undefined;
  const lower = os.toLowerCase();
  return PLATFORMS.find((p) => p.osValues.includes(lower))?.id;
}

export function platformById(id: string | undefined): DevicePlatform | undefined {
  return PLATFORMS.find((p) => p.id === id);
}

/** A device on the public roadmap but not yet in the registry — shown dimmed as
 *  "coming soon" in the device picker so the list tells the whole story. */
export interface RoadmapDevice {
  id: string;
  name: string;
  platform: PlatformId;
}

export const ROADMAP_DEVICES: RoadmapDevice[] = [
  { id: "legion-go", name: "Legion Go", platform: "windows" },
  { id: "msi-claw", name: "MSI Claw", platform: "windows" },
  { id: "retroid-pocket", name: "Retroid Pocket", platform: "android" },
  { id: "ayn-odin", name: "AYN Odin", platform: "android" },
];
