import type {
  AppGroup,
  BaseOption,
  BasePlan,
  Bundle,
  DeckImage,
  DeckProvisionUsbRequest,
  DeckReimageUsbRequest,
  DeckyStorePlugin,
  DeviceOption,
  DeviceSummary,
  DiscoveredDevice,
  FlatpakApp,
  GroupSummary,
  HostSshKey,
  IsoOption,
  LanguageOption,
  ModuleStateReport,
  PasswordManager,
  PlatformOption,
  ProvisioningMethod,
  ProvisionResult,
  RegionOption,
  RemovalEntry,
  StepEvent,
  UsbBuildRequest,
  UsbDisk,
  UsbProgress,
  UsbWriteRequest,
} from "@bootible/core";

import { contextBridge, ipcRenderer } from "electron";

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
  getDeckApps: (): Promise<FlatpakApp[]> => ipcRenderer.invoke("deck:apps"),
  getDeckPasswordManagers: (): Promise<PasswordManager[]> =>
    ipcRenderer.invoke("deck:passwordManagers"),
  getDeckyPlugins: (): Promise<DeckyStorePlugin[]> => ipcRenderer.invoke("deck:plugins"),
  resolveDeckImage: (): Promise<DeckImage | null> => ipcRenderer.invoke("deck:resolveImage"),
  writeDeckProvisionUsb: (req: DeckProvisionUsbRequest): Promise<{ started: boolean }> =>
    ipcRenderer.invoke("deck:writeProvisionUsb", req),
  writeDeckReimageUsb: (req: DeckReimageUsbRequest): Promise<{ started: boolean }> =>
    ipcRenderer.invoke("deck:writeReimageUsb", req),
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
    requestPasswordReset: (email: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke("cloud:requestPasswordReset", email),
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
