/**
 * The IPC contract between the Electron layers (renderer ⇄ preload ⇄ main) — the
 * shapes of the messages they pass. Declared ONCE here so the three layers can't
 * drift apart silently: previously each request/result interface was hand-copied
 * into both main and preload, and TypeScript checked each against its own copy.
 *
 * These are pure data types (no Electron/Node imports), so they live in core and
 * everyone imports them. Profiles (Profile/ProfileSummary) are deliberately not
 * here — they belong with the profile/cloud modules.
 */
import type { DeckConfig } from "./deck-config";
import type { StaticIp } from "./static-ip";

export interface PlanModule {
  id: string;
  name: string;
  description: string;
  changes?: string;
}

export interface BasePlan {
  floor: PlanModule[];
  base: PlanModule[];
  extras: PlanModule[];
}

export interface ProvisionResult {
  applied: number;
  skipped: number;
}

export interface UsbBuildRequest {
  /** Modifier module ids the user added on top of the base. */
  modules: string[];
  /** Chosen base id (raw / steam-bp / xbox / full-rog). */
  baseId?: string;
  /** The user's chosen SSH public keys (enables the ssh-key module). */
  sshPublicKeys?: string[];
  /** Device hostname — computer name, the .local name, and the SSH alias. */
  hostname?: string;
  /** Optional fixed IP for the device. */
  staticIp?: StaticIp;
  /** Windows edition (Pro unlocks RDP host). Default home. */
  edition?: "home" | "pro";
  /** Remote-access tools to install/enable on the device. */
  remoteAccess?: { sunshine?: boolean; moonlight?: boolean; rdp?: boolean };
  /** Streaming apps to also install on this desktop (the host). */
  remoteAccessHost?: { sunshine?: boolean; moonlight?: boolean };
  /** Sunshine web-UI login to pre-set. */
  sunshineUser?: string;
  sunshinePass?: string;
  /** Host image paths for the device wallpaper / lock screen. */
  wallpaperPath?: string;
  lockscreenPath?: string;
  /** Floor/base modules unticked on the review/customise screen. */
  disabledModules?: string[];
  /** App slugs picked in the app-picker. */
  selectedApps?: string[];
  /** Removal-catalog ids the user opted into stripping (Full ROG). */
  selectedRemovals?: string[];
  account: { mode: "local" | "microsoft"; username?: string; password?: string };
  wifi?: { ssid: string; password: string };
  /** Catalog id of the ISO/display language (sets download + answer-file UI language). */
  isoId?: string;
  /** Region/keyboard id from getRegions(). Omitted → default (New Zealand). */
  regionId?: string;
}

export interface UsbWriteRequest extends UsbBuildRequest {
  diskNumber: number;
  /** A local ISO path (browse) instead of downloading the catalog isoId via Fido. */
  isoPath?: string;
}

export interface BaseOption {
  id: string;
  label: string;
  description: string;
  tag?: string;
  recommended?: boolean;
}

export interface HostSshKey {
  /** The .pub filename, used as a stable id in the picker. */
  id: string;
  /** Human label — the key's comment, or the filename. */
  label: string;
  /** Key type (ssh-ed25519, ssh-rsa, …). */
  type: string;
  /** The full public-key line — exactly what gets authorised on the device. */
  publicKey: string;
}

export interface DiscoveredDevice {
  buildId: string;
  mac: string;
  ip: string;
  hostname: string;
  /** The device's account name, reported by the beacon — used as the SSH user. */
  username: string;
  status: string;
  /** True when this is the device built by the most recent USB. */
  mine: boolean;
}

export interface LanguageOption {
  id: string;
  label: string;
  /** The ISO catalog id to select when this language is chosen. */
  isoId: string;
}

export interface RegionOption {
  id: string;
  label: string;
}

export interface PlatformOption {
  id: string;
  label: string;
  blurb: string;
  status: "ready" | "coming-soon";
}

export interface DeviceOption {
  id: string;
  name: string;
  status: "ready" | "coming-soon";
}

export interface UsbDisk {
  number: number;
  name: string;
  sizeGb: number;
  letters: string;
  label: string;
}

export interface IsoOption {
  id: string;
  label: string;
}

export interface UsbProgress {
  pct: number;
  message: string;
  status: "running" | "done" | "error";
}

/** Path A — build a provision-only Deck USB: format + carry the payload. */
export interface DeckProvisionUsbRequest {
  /** Drive letter of the USB to format + carry the payload, e.g. "E" or "E:". */
  driveLetter: string;
  /** The user's Deck choices → DeckConfig (buildDeckBundle normalizes it). */
  config: Partial<DeckConfig>;
}

/** Path B — full reimage: flash SteamOS to a disk + append the payload. */
export interface DeckReimageUsbRequest {
  diskNumber: number;
  config: Partial<DeckConfig>;
}
