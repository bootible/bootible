import type {
  AppGroup,
  Bundle,
  DeviceSummary,
  GroupSummary,
  ModuleStateReport,
  ProvisioningMethod,
  RemovalEntry,
  StepEvent,
} from "@bootible/core";

import { contextBridge, ipcRenderer } from "electron";

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
  modules: string[];
  /** Chosen base id (raw / steam-bp / xbox / full-rog). */
  baseId?: string;
  /** The user's chosen SSH public keys (enables the ssh-key module). */
  sshPublicKeys?: string[];
  /** Device hostname — computer name, .local name, and SSH alias. */
  hostname?: string;
  /** Optional fixed IP for the device. */
  staticIp?: { ip: string; prefix?: number; gateway?: string; dns?: string };
  /** Windows edition (Pro unlocks RDP host). */
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

export interface BaseOption {
  id: string;
  label: string;
  description: string;
  tag?: string;
  recommended?: boolean;
}

export interface HostSshKey {
  id: string;
  label: string;
  type: string;
  publicKey: string;
}

export interface ProfileSummary {
  name: string;
  deviceId?: string;
  baseId?: string;
  savedAt?: string;
}

export interface Profile extends ProfileSummary {
  ui: Record<string, unknown>;
  secrets?: Record<string, string>;
}

export interface DiscoveredDevice {
  buildId: string;
  mac: string;
  ip: string;
  hostname: string;
  username: string;
  status: string;
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

export interface UsbWriteRequest extends UsbBuildRequest {
  diskNumber: number;
  isoPath?: string;
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
  getPlatforms: (): Promise<PlatformOption[]> => ipcRenderer.invoke("platforms:get"),
  getDevices: (platformId: string): Promise<DeviceOption[]> =>
    ipcRenderer.invoke("devices:list", platformId),
  selectDevice: (id: string): Promise<DeviceSummary | null> =>
    ipcRenderer.invoke("device:select", id),
  getCatalog: (): Promise<GroupSummary[]> => ipcRenderer.invoke("catalog:get"),
  getBundles: (): Promise<Bundle[]> => ipcRenderer.invoke("bundles:get"),
  getBases: (): Promise<BaseOption[]> => ipcRenderer.invoke("bases:get"),
  getBasePlan: (baseId: string): Promise<BasePlan> => ipcRenderer.invoke("base:plan", baseId),
  getAppGroups: (): Promise<AppGroup[]> => ipcRenderer.invoke("apps:groups"),
  getRemovals: (): Promise<RemovalEntry[]> => ipcRenderer.invoke("removals:get"),
  getHostSshKeys: (): Promise<HostSshKey[]> => ipcRenderer.invoke("ssh:host-keys"),
  generateHostSshKey: (comment: string): Promise<HostSshKey | null> =>
    ipcRenderer.invoke("ssh:generate-key", comment),
  githubKeys: (user: string): Promise<string[]> => ipcRenderer.invoke("ssh:github-keys", user),
  startDiscovery: (): Promise<void> => ipcRenderer.invoke("discovery:start"),
  stopDiscovery: (): Promise<void> => ipcRenderer.invoke("discovery:stop"),
  verifyDevice: (
    ip: string,
    username?: string,
  ): Promise<{ reachable: boolean; output: string; alias?: string }> =>
    ipcRenderer.invoke("device:verify", ip, username),
  suggestNetwork: (): Promise<{ prefix: number; gateway: string; subnet: string } | null> =>
    ipcRenderer.invoke("network:suggest"),
  installHostStreaming: (which: {
    sunshine?: boolean;
    moonlight?: boolean;
  }): Promise<{ ok: boolean; output: string }> =>
    ipcRenderer.invoke("host:install-streaming", which),
  browseImage: (): Promise<string | null> => ipcRenderer.invoke("image:browse"),
  onBeaconDevice: (cb: (device: DiscoveredDevice) => void): void => {
    ipcRenderer.on("beacon:device", (_e, device: DiscoveredDevice) => cb(device));
  },
  getState: (): Promise<ModuleStateReport[]> => ipcRenderer.invoke("device:state"),
  getMethods: (): Promise<ProvisioningMethod[]> => ipcRenderer.invoke("methods:get"),
  provision: (): Promise<ProvisionResult> => ipcRenderer.invoke("provision:run"),
  exportConfig: (
    req: Pick<UsbBuildRequest, "modules" | "baseId" | "sshPublicKeys">,
  ): Promise<{ path: string } | null> => ipcRenderer.invoke("config:export", req),
  buildUsb: (req: UsbBuildRequest): Promise<{ stagingPath: string; command: string } | null> =>
    ipcRenderer.invoke("usb:build", req),
  getUsbDisks: (): Promise<UsbDisk[]> => ipcRenderer.invoke("usb:disks"),
  getIsoCatalog: (): Promise<IsoOption[]> => ipcRenderer.invoke("iso:catalog"),
  getLanguages: (): Promise<LanguageOption[]> => ipcRenderer.invoke("languages:get"),
  getRegions: (): Promise<RegionOption[]> => ipcRenderer.invoke("regions:get"),
  browseIso: (): Promise<string | null> => ipcRenderer.invoke("iso:browse"),
  writeUsb: (req: UsbWriteRequest): Promise<{ started: boolean }> =>
    ipcRenderer.invoke("usb:write", req),
  saveStripKitDisk: (req: UsbBuildRequest): Promise<{ path: string } | null> =>
    ipcRenderer.invoke("stripkit:disk", req),
  saveStripKitUsb: (req: UsbBuildRequest, drive: string): Promise<{ path: string }> =>
    ipcRenderer.invoke("stripkit:usb", { req, drive }),
  ejectUsb: (drive: string): Promise<{ ok: boolean }> => ipcRenderer.invoke("usb:eject", drive),
  listProfiles: (): Promise<ProfileSummary[]> => ipcRenderer.invoke("profiles:list"),
  saveProfile: (p: Profile): Promise<{ ok: boolean; name: string }> =>
    ipcRenderer.invoke("profiles:save", p),
  loadProfile: (name: string): Promise<Profile | null> => ipcRenderer.invoke("profiles:load", name),
  deleteProfile: (name: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("profiles:delete", name),
  formatUsb: (drive: string): Promise<{ ok: boolean }> => ipcRenderer.invoke("usb:format", drive),
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
  cloud: {
    status: (): Promise<{
      signedIn: boolean;
      accountId?: string;
      email?: string;
      twoFactorEnabled?: boolean;
    }> => ipcRenderer.invoke("cloud:status"),
    signUpEmail: (b: {
      email: string;
      password: string;
      name?: string;
    }): Promise<{ ok: boolean; error?: string; needsVerification?: boolean }> =>
      ipcRenderer.invoke("cloud:signUpEmail", b),
    signInEmail: (b: {
      email: string;
      password: string;
    }): Promise<{
      ok: boolean;
      error?: string;
      twoFactor?: boolean;
      needsVerification?: boolean;
    }> => ipcRenderer.invoke("cloud:signInEmail", b),
    resendVerification: (email: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke("cloud:resendVerification", email),
    signInSocial: (provider: string): Promise<{ ok: boolean; error?: string; opened?: boolean }> =>
      ipcRenderer.invoke("cloud:signInSocial", provider),
    signOut: (): Promise<{ ok: boolean }> => ipcRenderer.invoke("cloud:signOut"),
    keyStatus: (): Promise<{ signedIn: boolean; hasServerKey: boolean; unlocked: boolean }> =>
      ipcRenderer.invoke("cloud:keyStatus"),
    setupKey: (
      passphrase: string,
    ): Promise<{ ok: boolean; error?: string; recoveryCode?: string }> =>
      ipcRenderer.invoke("cloud:setupKey", passphrase),
    unlock: (passphrase: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke("cloud:unlock", passphrase),
    unlockRecovery: (code: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke("cloud:unlockRecovery", code),
    resetPassphrase: (passphrase: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke("cloud:resetPassphrase", passphrase),
    verifyTotp: (code: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke("cloud:verifyTotp", code),
    enable2FA: (
      password: string,
    ): Promise<{ ok: boolean; error?: string; totpURI?: string; backupCodes?: string[] }> =>
      ipcRenderer.invoke("cloud:enable2FA", password),
    verify2FASetup: (code: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke("cloud:verify2FASetup", code),
    disable2FA: (password: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke("cloud:disable2FA", password),
    syncNow: (): Promise<{
      pulled: string[];
      pushed: string[];
      conflicted: string[];
      failed: { id: string; error: string }[];
    } | null> => ipcRenderer.invoke("cloud:syncNow"),
  },
};

export type BootibleApi = typeof api;

contextBridge.exposeInMainWorld("bootible", api);
