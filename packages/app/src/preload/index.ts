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
  GroupedProfiles,
  GroupSummary,
  HostSshKey,
  IsoOption,
  LanguageOption,
  ModuleStateReport,
  PasswordManager,
  PlatformOption,
  Profile,
  ProfileSummary,
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
import { CHANNELS } from "@bootible/core";

import { contextBridge, ipcRenderer } from "electron";

// The renderer surface. Each call forwards to a main-process IPC handler that
// drives @bootible/core. Provisioning streams step events back over the
// provision:step / provision:done channels.
const api = {
  version: "v2 (dev)",
  getDevice: (): Promise<DeviceSummary | null> => ipcRenderer.invoke(CHANNELS.deviceGet),
  getPlatforms: (): Promise<PlatformOption[]> => ipcRenderer.invoke(CHANNELS.platformsGet),
  getDevices: (platformId: string): Promise<DeviceOption[]> =>
    ipcRenderer.invoke(CHANNELS.devicesList, platformId),
  selectDevice: (id: string): Promise<DeviceSummary | null> =>
    ipcRenderer.invoke(CHANNELS.deviceSelect, id),
  getCatalog: (): Promise<GroupSummary[]> => ipcRenderer.invoke(CHANNELS.catalogGet),
  getBundles: (): Promise<Bundle[]> => ipcRenderer.invoke(CHANNELS.bundlesGet),
  getBases: (): Promise<BaseOption[]> => ipcRenderer.invoke(CHANNELS.basesGet),
  getBasePlan: (baseId: string): Promise<BasePlan> => ipcRenderer.invoke(CHANNELS.basePlan, baseId),
  getAppGroups: (): Promise<AppGroup[]> => ipcRenderer.invoke(CHANNELS.appsGroups),
  getRemovals: (): Promise<RemovalEntry[]> => ipcRenderer.invoke(CHANNELS.removalsGet),
  getHostSshKeys: (): Promise<HostSshKey[]> => ipcRenderer.invoke(CHANNELS.sshHostKeys),
  generateHostSshKey: (comment: string): Promise<HostSshKey | null> =>
    ipcRenderer.invoke(CHANNELS.sshGenerateKey, comment),
  githubKeys: (user: string): Promise<string[]> => ipcRenderer.invoke(CHANNELS.sshGithubKeys, user),
  startDiscovery: (): Promise<void> => ipcRenderer.invoke(CHANNELS.discoveryStart),
  stopDiscovery: (): Promise<void> => ipcRenderer.invoke(CHANNELS.discoveryStop),
  verifyDevice: (
    ip: string,
    username?: string,
  ): Promise<{ reachable: boolean; output: string; alias?: string }> =>
    ipcRenderer.invoke(CHANNELS.deviceVerify, ip, username),
  suggestNetwork: (): Promise<{ prefix: number; gateway: string; subnet: string } | null> =>
    ipcRenderer.invoke(CHANNELS.networkSuggest),
  installHostStreaming: (which: {
    sunshine?: boolean;
    moonlight?: boolean;
  }): Promise<{ ok: boolean; output: string }> =>
    ipcRenderer.invoke(CHANNELS.hostInstallStreaming, which),
  browseImage: (): Promise<string | null> => ipcRenderer.invoke(CHANNELS.imageBrowse),
  onBeaconDevice: (cb: (device: DiscoveredDevice) => void): void => {
    ipcRenderer.on(CHANNELS.beaconDevice, (_e, device: DiscoveredDevice) => cb(device));
  },
  getState: (): Promise<ModuleStateReport[]> => ipcRenderer.invoke(CHANNELS.deviceState),
  getMethods: (): Promise<ProvisioningMethod[]> => ipcRenderer.invoke(CHANNELS.methodsGet),
  provision: (): Promise<ProvisionResult> => ipcRenderer.invoke(CHANNELS.provisionRun),
  exportConfig: (
    req: Pick<UsbBuildRequest, "modules" | "baseId" | "sshPublicKeys">,
  ): Promise<{ path: string } | null> => ipcRenderer.invoke(CHANNELS.configExport, req),
  buildUsb: (req: UsbBuildRequest): Promise<{ stagingPath: string; command: string } | null> =>
    ipcRenderer.invoke(CHANNELS.usbBuild, req),
  getUsbDisks: (): Promise<UsbDisk[]> => ipcRenderer.invoke(CHANNELS.usbDisks),
  getDeckApps: (): Promise<FlatpakApp[]> => ipcRenderer.invoke(CHANNELS.deckApps),
  getDeckPasswordManagers: (): Promise<PasswordManager[]> =>
    ipcRenderer.invoke(CHANNELS.deckPasswordManagers),
  getDeckyPlugins: (): Promise<DeckyStorePlugin[]> => ipcRenderer.invoke(CHANNELS.deckPlugins),
  resolveDeckImage: (): Promise<DeckImage | null> => ipcRenderer.invoke(CHANNELS.deckResolveImage),
  writeDeckProvisionUsb: (req: DeckProvisionUsbRequest): Promise<{ started: boolean }> =>
    ipcRenderer.invoke(CHANNELS.deckWriteProvisionUsb, req),
  writeDeckReimageUsb: (req: DeckReimageUsbRequest): Promise<{ started: boolean }> =>
    ipcRenderer.invoke(CHANNELS.deckWriteReimageUsb, req),
  getIsoCatalog: (): Promise<IsoOption[]> => ipcRenderer.invoke(CHANNELS.isoCatalog),
  getLanguages: (): Promise<LanguageOption[]> => ipcRenderer.invoke(CHANNELS.languagesGet),
  getRegions: (): Promise<RegionOption[]> => ipcRenderer.invoke(CHANNELS.regionsGet),
  browseIso: (): Promise<string | null> => ipcRenderer.invoke(CHANNELS.isoBrowse),
  writeUsb: (req: UsbWriteRequest): Promise<{ started: boolean }> =>
    ipcRenderer.invoke(CHANNELS.usbWrite, req),
  saveStripKitDisk: (req: UsbBuildRequest): Promise<{ path: string } | null> =>
    ipcRenderer.invoke(CHANNELS.stripkitDisk, req),
  saveStripKitUsb: (req: UsbBuildRequest, drive: string): Promise<{ path: string }> =>
    ipcRenderer.invoke(CHANNELS.stripkitUsb, { req, drive }),
  ejectUsb: (drive: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(CHANNELS.usbEject, drive),
  listProfiles: (): Promise<ProfileSummary[]> => ipcRenderer.invoke(CHANNELS.profilesList),
  groupProfiles: (deviceModel: string): Promise<GroupedProfiles<ProfileSummary>> =>
    ipcRenderer.invoke(CHANNELS.profilesGrouped, deviceModel),
  saveProfile: (p: Profile): Promise<{ ok: boolean; name: string }> =>
    ipcRenderer.invoke(CHANNELS.profilesSave, p),
  loadProfile: (name: string): Promise<Profile | null> =>
    ipcRenderer.invoke(CHANNELS.profilesLoad, name),
  deleteProfile: (name: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(CHANNELS.profilesDelete, name),
  formatUsb: (drive: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(CHANNELS.usbFormat, drive),
  onUsbProgress: (cb: (event: UsbProgress) => void): void => {
    ipcRenderer.on(CHANNELS.usbProgress, (_e, event: UsbProgress) => cb(event));
  },
  openPath: (path: string): Promise<string> => ipcRenderer.invoke(CHANNELS.shellOpen, path),
  applyDevice: (req: UsbBuildRequest): Promise<{ status: "blocked" | "cancelled" | "launched" }> =>
    ipcRenderer.invoke(CHANNELS.deviceApply, req),
  onProvisionStep: (cb: (event: StepEvent) => void): void => {
    ipcRenderer.on(CHANNELS.provisionStep, (_e, event: StepEvent) => cb(event));
  },
  onProvisionDone: (cb: (result: ProvisionResult) => void): void => {
    ipcRenderer.on(CHANNELS.provisionDone, (_e, result: ProvisionResult) => cb(result));
  },
  cloud: {
    status: (): Promise<{
      signedIn: boolean;
      accountId?: string;
      email?: string;
      twoFactorEnabled?: boolean;
    }> => ipcRenderer.invoke(CHANNELS.cloudStatus),
    signUpEmail: (b: {
      email: string;
      password: string;
      name?: string;
    }): Promise<{ ok: boolean; error?: string; needsVerification?: boolean }> =>
      ipcRenderer.invoke(CHANNELS.cloudSignUpEmail, b),
    signInEmail: (b: {
      email: string;
      password: string;
    }): Promise<{
      ok: boolean;
      error?: string;
      twoFactor?: boolean;
      needsVerification?: boolean;
    }> => ipcRenderer.invoke(CHANNELS.cloudSignInEmail, b),
    resendVerification: (email: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(CHANNELS.cloudResendVerification, email),
    requestPasswordReset: (email: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(CHANNELS.cloudRequestPasswordReset, email),
    signInSocial: (provider: string): Promise<{ ok: boolean; error?: string; opened?: boolean }> =>
      ipcRenderer.invoke(CHANNELS.cloudSignInSocial, provider),
    signOut: (): Promise<{ ok: boolean }> => ipcRenderer.invoke(CHANNELS.cloudSignOut),
    keyStatus: (): Promise<{ signedIn: boolean; hasServerKey: boolean; unlocked: boolean }> =>
      ipcRenderer.invoke(CHANNELS.cloudKeyStatus),
    setupKey: (
      passphrase: string,
    ): Promise<{ ok: boolean; error?: string; recoveryCode?: string }> =>
      ipcRenderer.invoke(CHANNELS.cloudSetupKey, passphrase),
    unlock: (passphrase: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(CHANNELS.cloudUnlock, passphrase),
    unlockRecovery: (code: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(CHANNELS.cloudUnlockRecovery, code),
    resetPassphrase: (passphrase: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(CHANNELS.cloudResetPassphrase, passphrase),
    verifyTotp: (code: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(CHANNELS.cloudVerifyTotp, code),
    enable2FA: (
      password: string,
    ): Promise<{ ok: boolean; error?: string; totpURI?: string; backupCodes?: string[] }> =>
      ipcRenderer.invoke(CHANNELS.cloudEnable2FA, password),
    verify2FASetup: (code: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(CHANNELS.cloudVerify2FASetup, code),
    disable2FA: (password: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(CHANNELS.cloudDisable2FA, password),
    syncNow: (): Promise<{
      pulled: string[];
      pushed: string[];
      conflicted: string[];
      failed: { id: string; error: string }[];
    } | null> => ipcRenderer.invoke(CHANNELS.cloudSyncNow),
  },
};

export type BootibleApi = typeof api;

contextBridge.exposeInMainWorld("bootible", api);
