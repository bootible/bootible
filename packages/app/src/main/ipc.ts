import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  APP_GROUPS,
  type AppGroup,
  type BuildChoice,
  buildDeckBundle,
  CHANNELS,
  type DeckConfig,
  type DeckProvisionUsbRequest,
  DISPLAY_LANGUAGES,
  FLATPAK_APPS,
  fetchDeckyPlugins,
  groupProfilesForDevice,
  KEYBOARD_REGIONS,
  PASSWORD_MANAGERS,
  REMOVAL_CATALOG,
  type UsbBuildRequest,
  type UsbWriteRequest,
} from "@bootible/core";
import { BrowserWindow, dialog, ipcMain, shell } from "electron";
import { applyDevice, exportConfig, getDeviceState, provision } from "./apply";
import { resolveDeckImageUrl, writeDeckProvisionUsb, writeDeckReimageUsb } from "./deck-usb";
import { startDiscovery, stopDiscovery } from "./discovery";
import { installHostStreaming } from "./host";
import { browseIso, getIsoCatalog } from "./iso";
// Config profiles (save/load the whole setup, DPAPI-encrypted secrets) + the
// cloud-sync LocalStore now live in ./profiles-store.
import {
  deleteProfile,
  listProfiles,
  loadProfile,
  type Profile,
  saveProfile,
} from "./profiles-store";
import {
  getBasePlan,
  getBases,
  getBundles,
  getCatalog,
  getDevice,
  getDevices,
  getMethods,
  getPlatforms,
  selectDeviceById,
} from "./registry";
import { fetchGithubKeys, generateHostSshKey, getHostSshKeys, verifyDevice } from "./ssh";
import { writeStripKit } from "./strip-kit";
import { suggestNetwork } from "./system";
import { buildUsb, ejectUsb, ejectUsbDisk, formatUsbDrive, listUsbDisks, writeUsb } from "./usb";

/** Register every renderer-facing IPC handler (the cloud channels live in
 *  ./cloud's registerCloudIpc). Called once from app.whenReady. */
export function registerIpc(): void {
  ipcMain.handle(CHANNELS.deviceGet, () => getDevice());
  ipcMain.handle(CHANNELS.deviceState, () => getDeviceState());
  ipcMain.handle(CHANNELS.platformsGet, () => getPlatforms());
  ipcMain.handle(CHANNELS.devicesList, (_event, platformId: string) => getDevices(platformId));
  ipcMain.handle(CHANNELS.deviceSelect, (_event, id: string) => selectDeviceById(id));
  ipcMain.handle(CHANNELS.catalogGet, () => getCatalog());
  ipcMain.handle(CHANNELS.bundlesGet, () => getBundles());
  ipcMain.handle(CHANNELS.basesGet, () => getBases());
  ipcMain.handle(CHANNELS.sshHostKeys, () => getHostSshKeys());
  ipcMain.handle(CHANNELS.sshGenerateKey, (_event, comment: string) => generateHostSshKey(comment));
  ipcMain.handle(CHANNELS.sshGithubKeys, (_event, user: string) => fetchGithubKeys(user));
  ipcMain.handle(CHANNELS.discoveryStart, (event) => startDiscovery(event.sender));
  ipcMain.handle(CHANNELS.discoveryStop, () => stopDiscovery());
  ipcMain.handle(
    CHANNELS.deviceVerify,
    (_event, ip: string, username?: string, os?: "windows" | "linux") =>
      verifyDevice(ip, username, os),
  );
  ipcMain.handle(CHANNELS.networkSuggest, () => suggestNetwork());
  ipcMain.handle(CHANNELS.basePlan, (_event, baseId: string) => getBasePlan(baseId));
  ipcMain.handle(CHANNELS.appsGroups, (): AppGroup[] => APP_GROUPS);
  ipcMain.handle(CHANNELS.removalsGet, () => REMOVAL_CATALOG);
  ipcMain.handle(CHANNELS.imageBrowse, async () => {
    const r = await dialog.showOpenDialog({
      title: "Choose an image",
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "bmp"] }],
    });
    return r.canceled || !r.filePaths[0] ? null : r.filePaths[0];
  });
  ipcMain.handle(
    CHANNELS.hostInstallStreaming,
    (_event, which: { sunshine?: boolean; moonlight?: boolean }) =>
      installHostStreaming(which ?? {}),
  );
  ipcMain.handle(CHANNELS.methodsGet, () => getMethods());
  ipcMain.handle(CHANNELS.provisionRun, (event) => provision(event.sender));
  ipcMain.handle(CHANNELS.configExport, (event, req: BuildChoice) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win ? exportConfig(win, req ?? { modules: [] }) : null;
  });
  ipcMain.handle(CHANNELS.usbBuild, (_event, req: UsbBuildRequest) => buildUsb(req));
  ipcMain.handle(CHANNELS.usbWrite, (event, req: UsbWriteRequest) => writeUsb(event.sender, req));
  // Full ROG strip kit: save the 3 files to a folder, or to a USB drive root.
  ipcMain.handle(CHANNELS.stripkitDisk, async (event, req: UsbBuildRequest) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;
    const r = await dialog.showOpenDialog(win, {
      title: "Choose where to save the bootible-prep folder",
      properties: ["openDirectory", "createDirectory"],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    const dest = join(r.filePaths[0], "bootible-prep");
    writeStripKit(dest, req);
    return { path: dest };
  });
  ipcMain.handle(
    CHANNELS.stripkitUsb,
    (_event, { req, drive }: { req: UsbBuildRequest; drive: string }) => {
      // A bootible-prep folder on the stick (not the root) — keeps the USB tidy.
      const dest = join(`${drive.replace(/[:\\]/g, "")}:\\`, "bootible-prep");
      writeStripKit(dest, req);
      return { path: dest };
    },
  );
  // Export the Deck setup (buildDeckBundle: provision.sh + config + README) to a
  // folder — the ROG "Export config" equivalent for the SteamOS carrier flow.
  ipcMain.handle(CHANNELS.deckExport, async (event, config: Partial<DeckConfig>) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;
    const r = await dialog.showOpenDialog(win, {
      title: "Choose where to save the bootible Deck setup",
      properties: ["openDirectory", "createDirectory"],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    const dest = join(r.filePaths[0], "bootible-deck");
    rmSync(dest, { recursive: true, force: true });
    for (const file of buildDeckBundle(config)) {
      const target = join(dest, file.path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, file.content, "utf8"); // LF, bash-safe
    }
    return { path: dest };
  });
  ipcMain.handle(CHANNELS.profilesList, () => listProfiles());
  // Grouping runs here (main can value-import core's deviceFamilyOf), so the
  // renderer needn't re-implement the family mapping — it just gets {model, family}.
  ipcMain.handle(CHANNELS.profilesGrouped, (_event, deviceModel: string | undefined) =>
    groupProfilesForDevice(listProfiles(), deviceModel),
  );
  ipcMain.handle(CHANNELS.profilesSave, (_event, p: Profile) => saveProfile(p));
  ipcMain.handle(CHANNELS.profilesLoad, (_event, name: string) => loadProfile(name));
  ipcMain.handle(CHANNELS.profilesDelete, (_event, name: string) => deleteProfile(name));
  ipcMain.handle(CHANNELS.usbEject, (_event, drive: string) => ejectUsb(drive));
  ipcMain.handle(CHANNELS.usbEjectDisk, (_event, diskNumber: number) => ejectUsbDisk(diskNumber));
  ipcMain.handle(CHANNELS.usbFormat, (_event, drive: string) => formatUsbDrive(drive));
  ipcMain.handle(CHANNELS.usbDisks, () => listUsbDisks());
  ipcMain.handle(CHANNELS.deckApps, () => FLATPAK_APPS);
  ipcMain.handle(CHANNELS.deckPasswordManagers, () => PASSWORD_MANAGERS);
  ipcMain.handle(CHANNELS.deckPlugins, () => fetchDeckyPlugins());
  ipcMain.handle(CHANNELS.deckResolveImage, () => resolveDeckImageUrl());
  ipcMain.handle(CHANNELS.deckWriteProvisionUsb, (event, req: DeckProvisionUsbRequest) =>
    writeDeckProvisionUsb(event.sender, req),
  );
  ipcMain.handle(
    CHANNELS.deckWriteReimageUsb,
    (event, req: { diskNumber: number; config: Partial<DeckConfig> }) =>
      writeDeckReimageUsb(event.sender, req),
  );
  ipcMain.handle(CHANNELS.isoCatalog, () => getIsoCatalog());
  ipcMain.handle(CHANNELS.languagesGet, () =>
    DISPLAY_LANGUAGES.map((l) => ({ id: l.id, label: l.label, isoId: `win11-latest-${l.id}` })),
  );
  ipcMain.handle(CHANNELS.regionsGet, () =>
    KEYBOARD_REGIONS.map((r) => ({ id: r.id, label: r.label })),
  );
  ipcMain.handle(CHANNELS.isoBrowse, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win ? browseIso(win) : null;
  });
  ipcMain.handle(CHANNELS.shellOpen, (_event, path: string) =>
    // A URL opens in the system browser; a filesystem path in the file manager.
    /^https?:\/\//.test(path) ? shell.openExternal(path).then(() => "") : shell.openPath(path),
  );
  ipcMain.handle(CHANNELS.deviceApply, (event, req: UsbBuildRequest) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win ? applyDevice(win, req) : { status: "blocked" };
  });
}
