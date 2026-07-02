import { baseById, baseModuleIds } from "./bases";
import { imageDevicePath } from "./bundle";
import type { StaticIp } from "./static-ip";

/**
 * The user's provisioning choices — a base plus the modifiers the wizard collects.
 * A subset of UsbBuildRequest: the fields that decide *what gets provisioned*
 * (modules + settings), independent of *how* it's delivered (USB / on-device).
 */
export type BuildChoice = {
  modules: string[];
  baseId?: string;
  sshPublicKeys?: string[];
  staticIp?: StaticIp;
  edition?: "home" | "pro";
  remoteAccess?: { sunshine?: boolean; moonlight?: boolean; rdp?: boolean };
  sunshineUser?: string;
  sunshinePass?: string;
  wallpaperPath?: string;
  lockscreenPath?: string;
  /** Floor/base modules the user unticked on the review/customise screen. */
  disabledModules?: string[];
  /** App slugs picked in the app-picker (settings.selected_apps). */
  selectedApps?: string[];
  /** Removal-catalog ids the user opted into stripping (settings.strip_removals). */
  selectedRemovals?: string[];
  /** Catalog id of the browser to set as default (settings.default_browser). */
  defaultBrowser?: string;
};

/** The universal power/display floor every build starts from. */
export const RECOMMENDED_SETTINGS = {
  sleep_mode: "hibernate",
  hibernate_after_minutes: 30,
  power_button_action: "sleep",
  disable_cpu_boost_on_battery: true,
} as const;

/** The non-empty, trimmed SSH public keys from a build choice. */
export function chosenKeys(req: BuildChoice): string[] {
  return (req.sshPublicKeys ?? []).map((k) => k.trim()).filter((k) => k.length > 0);
}

/** The final module-id set for a build: the base's resolved floor (shell +
 *  software + universal tuning) unioned with the user's modifier picks, plus the
 *  ssh-key module when at least one key is supplied. */
export function resolveModules(req: BuildChoice): string[] {
  const base = baseById(req.baseId);
  const ids = new Set<string>(base ? baseModuleIds(base) : []);
  for (const id of req.modules) ids.add(id);
  // The review/customise screen can untick floor + base modules.
  for (const id of req.disabledModules ?? []) ids.delete(id);
  if (chosenKeys(req).length > 0) ids.add("ssh-key");
  if (req.staticIp?.ip) ids.add("static-ip");
  if (req.remoteAccess?.sunshine) ids.add("sunshine");
  if (req.remoteAccess?.moonlight) ids.add("moonlight");
  // RDP host only works on Pro, so only enable it when both are chosen.
  if (req.edition === "pro" && req.remoteAccess?.rdp) ids.add("remote-desktop");
  // Sunshine login only makes sense once Sunshine is installed.
  if (req.remoteAccess?.sunshine && req.sunshineUser && req.sunshinePass) {
    ids.add("sunshine-creds");
  }
  if (req.wallpaperPath) ids.add("wallpaper");
  if (req.lockscreenPath) ids.add("lockscreen");
  // Apps + emulators picked in the pickers install via the `apps` module.
  if (req.selectedApps?.length) ids.add("apps");
  return [...ids];
}

/** The settings bag, with the SSH keys and static IP folded in when provided. */
export function buildSettings(req: BuildChoice): Record<string, unknown> {
  const settings: Record<string, unknown> = { ...RECOMMENDED_SETTINGS };
  const keys = chosenKeys(req);
  if (keys.length > 0) settings.ssh_public_keys = keys;
  if (req.selectedApps?.length) settings.selected_apps = req.selectedApps;
  if (req.selectedRemovals?.length) settings.strip_removals = req.selectedRemovals;
  // Only meaningful if the browser was also selected for install.
  if (req.defaultBrowser && req.selectedApps?.includes(req.defaultBrowser)) {
    settings.default_browser = req.defaultBrowser;
  }
  if (req.staticIp?.ip) settings.static_ip = req.staticIp;
  if (req.remoteAccess?.sunshine && req.sunshineUser && req.sunshinePass) {
    settings.sunshine_user = req.sunshineUser;
    settings.sunshine_pass = req.sunshinePass;
  }
  // The modules read the ON-DEVICE path; the image itself is staged by bundle.ts.
  if (req.wallpaperPath) settings.wallpaper_path = imageDevicePath("wallpaper", req.wallpaperPath);
  if (req.lockscreenPath) {
    settings.lockscreen_path = imageDevicePath("lockscreen", req.lockscreenPath);
  }
  return settings;
}

/** The full provisioning plan for a build choice — the module set to run plus the
 *  settings bag they read. The single place the renderer's typed choices become a
 *  provisioning plan; main then does the I/O (stage bundle / write / apply). */
export function buildProvisioningPlan(req: BuildChoice): {
  modules: string[];
  settings: Record<string, unknown>;
} {
  return { modules: resolveModules(req), settings: buildSettings(req) };
}
