import type {
  AppGroup,
  BaseOption,
  BasePlan,
  Bundle,
  DeckImage,
  DeckProvisionUsbRequest as DeckProvisionUsbReq,
  DeckReimageUsbRequest as DeckReimageUsbReq,
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
  UsbWriteRequest as UsbWriteReq,
} from "@bootible/core";

/**
 * The contextBridge IPC surface the preload exposes as `window.bootible`. This is
 * the single typed contract between the renderer screens and the Electron main
 * process; every feature module reaches the host through it. Ambient so a bare
 * `window.bootible?.…` is typed everywhere without an import.
 */
export interface BootibleApi {
  version: string;
  getDevice(): Promise<DeviceSummary | null>;
  getPlatforms(): Promise<PlatformOption[]>;
  getDevices(platformId: string): Promise<DeviceOption[]>;
  selectDevice(id: string): Promise<DeviceSummary | null>;
  getBases(): Promise<BaseOption[]>;
  getBasePlan(baseId: string): Promise<BasePlan>;
  getAppGroups(): Promise<AppGroup[]>;
  getHostSshKeys(): Promise<HostSshKey[]>;
  generateHostSshKey(comment: string): Promise<HostSshKey | null>;
  githubKeys(user: string): Promise<string[]>;
  startDiscovery(): Promise<void>;
  stopDiscovery(): Promise<void>;
  onBeaconDevice(cb: (device: DiscoveredDevice) => void): void;
  verifyDevice(
    ip: string,
    username?: string,
    os?: "windows" | "linux",
  ): Promise<{ reachable: boolean; output: string; alias?: string }>;
  suggestNetwork(): Promise<{ prefix: number; gateway: string; subnet: string } | null>;
  installHostStreaming(which: {
    sunshine?: boolean;
    moonlight?: boolean;
  }): Promise<{ ok: boolean; output: string }>;
  browseImage(): Promise<string | null>;
  getLanguages(): Promise<LanguageOption[]>;
  getRegions(): Promise<RegionOption[]>;
  getCatalog(): Promise<GroupSummary[]>;
  getBundles(): Promise<Bundle[]>;
  getState(): Promise<ModuleStateReport[]>;
  getMethods(): Promise<ProvisioningMethod[]>;
  provision(): Promise<ProvisionResult>;
  onProvisionStep(cb: (event: StepEvent) => void): void;
  onProvisionDone(cb: (result: ProvisionResult) => void): void;
  exportConfig(req: {
    modules: string[];
    baseId?: string;
    sshPublicKeys?: string[];
  }): Promise<{ path: string } | null>;
  buildUsb(req: UsbBuildRequest): Promise<{ stagingPath: string; command: string } | null>;
  openPath(path: string): Promise<string>;
  applyDevice(req: UsbBuildRequest): Promise<{ status: "blocked" | "cancelled" | "launched" }>;
  getUsbDisks(): Promise<UsbDisk[]>;
  getDeckApps(): Promise<FlatpakApp[]>;
  getDeckPasswordManagers(): Promise<PasswordManager[]>;
  getDeckyPlugins(): Promise<DeckyStorePlugin[]>;
  resolveDeckImage(): Promise<DeckImage | null>;
  exportDeck(config: DeckConfig): Promise<{ path: string } | null>;
  writeDeckProvisionUsb(req: DeckProvisionUsbReq): Promise<{ started: boolean }>;
  writeDeckReimageUsb(req: DeckReimageUsbReq): Promise<{ started: boolean }>;
  getIsoCatalog(): Promise<IsoOption[]>;
  browseIso(): Promise<string | null>;
  writeUsb(req: UsbWriteReq): Promise<{ started: boolean }>;
  onUsbProgress(cb: (event: UsbProgress) => void): void;
  getRemovals(): Promise<RemovalEntry[]>;
  saveStripKitDisk(req: UsbBuildRequest): Promise<{ path: string } | null>;
  saveStripKitUsb(req: UsbBuildRequest, drive: string): Promise<{ path: string }>;
  ejectUsb(drive: string): Promise<{ ok: boolean }>;
  ejectUsbDisk(diskNumber: number): Promise<{ ok: boolean }>;
  formatUsb(drive: string): Promise<{ ok: boolean }>;
  listProfiles(): Promise<ProfileSummary[]>;
  groupProfiles(deviceModel: string): Promise<GroupedProfiles<ProfileSummary>>;
  saveProfile(p: Profile): Promise<{ ok: boolean; name: string }>;
  loadProfile(name: string): Promise<Profile | null>;
  deleteProfile(name: string): Promise<{ ok: boolean }>;
  cloud: {
    status(): Promise<{
      signedIn: boolean;
      accountId?: string;
      email?: string;
      twoFactorEnabled?: boolean;
    }>;
    signUpEmail(b: {
      email: string;
      password: string;
      name?: string;
    }): Promise<{ ok: boolean; error?: string; needsVerification?: boolean }>;
    signInEmail(b: {
      email: string;
      password: string;
    }): Promise<{ ok: boolean; error?: string; twoFactor?: boolean; needsVerification?: boolean }>;
    signInSocial(provider: string): Promise<{ ok: boolean; error?: string; opened?: boolean }>;
    resendVerification(email: string): Promise<{ ok: boolean; error?: string }>;
    requestPasswordReset(email: string): Promise<{ ok: boolean; error?: string }>;
    signOut(): Promise<{ ok: boolean }>;
    keyStatus(): Promise<{ signedIn: boolean; hasServerKey: boolean; unlocked: boolean }>;
    setupKey(passphrase: string): Promise<{ ok: boolean; error?: string; recoveryCode?: string }>;
    unlock(passphrase: string): Promise<{ ok: boolean; error?: string }>;
    unlockRecovery(code: string): Promise<{ ok: boolean; error?: string }>;
    resetPassphrase(passphrase: string): Promise<{ ok: boolean; error?: string }>;
    verifyTotp(code: string): Promise<{ ok: boolean; error?: string }>;
    enable2FA(
      password: string,
    ): Promise<{ ok: boolean; error?: string; totpURI?: string; backupCodes?: string[] }>;
    verify2FASetup(code: string): Promise<{ ok: boolean; error?: string }>;
    disable2FA(password: string): Promise<{ ok: boolean; error?: string }>;
    syncNow(): Promise<{
      pulled: string[];
      pushed: string[];
      conflicted: string[];
      failed: { id: string; error: string }[];
    } | null>;
  };
}

declare global {
  interface Window {
    bootible?: BootibleApi;
  }
}
