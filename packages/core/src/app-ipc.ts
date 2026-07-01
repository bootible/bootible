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

/**
 * The IPC channel names, declared once so preload (ipcRenderer.invoke/on) and main
 * (ipcMain.handle / webContents.send) reference the SAME string — a typo or drift
 * in a hand-copied literal silently breaks a call with no compile error. Values are
 * the exact wire strings; keys are readable aliases. (Electron app/webContents
 * lifecycle events — activate, window-all-closed, … — are not IPC and stay inline.)
 */
export const CHANNELS = {
  appsGroups: "apps:groups",
  basePlan: "base:plan",
  basesGet: "bases:get",
  beaconDevice: "beacon:device",
  bundlesGet: "bundles:get",
  catalogGet: "catalog:get",
  cloudDisable2FA: "cloud:disable2FA",
  cloudEnable2FA: "cloud:enable2FA",
  cloudKeyStatus: "cloud:keyStatus",
  cloudRequestPasswordReset: "cloud:requestPasswordReset",
  cloudResendVerification: "cloud:resendVerification",
  cloudResetPassphrase: "cloud:resetPassphrase",
  cloudSetupKey: "cloud:setupKey",
  cloudSignInEmail: "cloud:signInEmail",
  cloudSignInSocial: "cloud:signInSocial",
  cloudSignOut: "cloud:signOut",
  cloudSignUpEmail: "cloud:signUpEmail",
  cloudStatus: "cloud:status",
  cloudSyncNow: "cloud:syncNow",
  cloudUnlock: "cloud:unlock",
  cloudUnlockRecovery: "cloud:unlockRecovery",
  cloudVerify2FASetup: "cloud:verify2FASetup",
  cloudVerifyTotp: "cloud:verifyTotp",
  configExport: "config:export",
  deckApps: "deck:apps",
  deckExport: "deck:export",
  deckPasswordManagers: "deck:passwordManagers",
  deckPlugins: "deck:plugins",
  deckResolveImage: "deck:resolveImage",
  deckWriteProvisionUsb: "deck:writeProvisionUsb",
  deckWriteReimageUsb: "deck:writeReimageUsb",
  deviceApply: "device:apply",
  deviceGet: "device:get",
  deviceSelect: "device:select",
  deviceState: "device:state",
  deviceVerify: "device:verify",
  devicesList: "devices:list",
  discoveryStart: "discovery:start",
  discoveryStop: "discovery:stop",
  hostInstallStreaming: "host:install-streaming",
  imageBrowse: "image:browse",
  isoBrowse: "iso:browse",
  isoCatalog: "iso:catalog",
  languagesGet: "languages:get",
  methodsGet: "methods:get",
  networkSuggest: "network:suggest",
  platformsGet: "platforms:get",
  profilesDelete: "profiles:delete",
  profilesGrouped: "profiles:grouped",
  profilesList: "profiles:list",
  profilesLoad: "profiles:load",
  profilesSave: "profiles:save",
  provisionDone: "provision:done",
  provisionRun: "provision:run",
  provisionStep: "provision:step",
  regionsGet: "regions:get",
  removalsGet: "removals:get",
  shellOpen: "shell:open",
  sshGenerateKey: "ssh:generate-key",
  sshGithubKeys: "ssh:github-keys",
  sshHostKeys: "ssh:host-keys",
  stripkitDisk: "stripkit:disk",
  stripkitUsb: "stripkit:usb",
  usbBuild: "usb:build",
  usbDisks: "usb:disks",
  usbEject: "usb:eject",
  usbFormat: "usb:format",
  usbProgress: "usb:progress",
  usbWrite: "usb:write",
} as const;

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
