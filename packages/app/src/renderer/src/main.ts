import "./styles.css";
import QRCode from "qrcode";
import brandMark from "./assets/bootible-mark.png";
import wordlistRaw from "./wordlist.txt?raw";

// EFF diceware wordlist (7776 words) for generating real word-passphrases.
const WORDLIST = wordlistRaw
  .split("\n")
  .map((w) => w.trim())
  .filter(Boolean);

// Brand mark in the sysbar + window favicon (Vite resolves the hashed URL).
const markImg = document.querySelector<HTMLImageElement>("#brand-mark");
if (markImg) markImg.src = brandMark;
const favicon = document.querySelector<HTMLLinkElement>("#favicon");
if (favicon) favicon.href = brandMark;
const welcomeLogo = document.querySelector<HTMLImageElement>("#welcome-logo");
if (welcomeLogo) welcomeLogo.src = brandMark;

// ── Brand / OS / app logos — rendered as CSS masks so the source colour
//    (black, white, full-colour) is discarded and everything tints to palette. ──
function logoMap(mods: Record<string, unknown>): Record<string, string> {
  const m: Record<string, string> = {};
  for (const [path, url] of Object.entries(mods)) {
    const id =
      path
        .split("/")
        .pop()
        ?.replace(/\.svg$/, "") ?? "";
    m[id] = url as string;
  }
  return m;
}
const APP_LOGOS = logoMap(
  import.meta.glob("./assets/logos/apps/*.svg", { eager: true, query: "?url", import: "default" }),
);
const OS_LOGOS = logoMap(
  import.meta.glob("./assets/logos/os/*.svg", { eager: true, query: "?url", import: "default" }),
);
const DEVICE_LOGOS = logoMap(
  import.meta.glob("./assets/logos/devices/*.svg", {
    eager: true,
    query: "?url",
    import: "default",
  }),
);
// Sign-in provider brand icons (full colour, on dark circular buttons).
const AUTH_LOGOS = logoMap(
  import.meta.glob("./assets/logos/auth/*.svg", { eager: true, query: "?url", import: "default" }),
);
// device id (registry) → brand-logo filename under devices/
const DEVICE_BRAND: Record<string, string> = {
  "rog-ally": "rog",
  "msi-claw": "msi",
  steamdeck: "steam-deck",
  "retroid-pocket": "retroid",
  "ayn-odin": "ayn",
};
// Logos that are black/dark/low-contrast — render white so they read on the dark UI.
const FORCE_WHITE = new Set([
  "7zip",
  "ea",
  "ubisoft",
  "tailscale",
  "retroarch",
  "playnite",
  "obs",
  "epic",
  "gog",
]);
// Logos that read small (heavy internal padding) — scale up a touch.
const LOGO_SCALE = new Set(["handheldcompanion"]);
/** An <img> of the real brand logo (full colour), or a blank `.no-logo` span. */
function logoEl(url: string | undefined, cls: string): HTMLElement {
  if (!url) return el("span", `${cls} no-logo`);
  const img = el("img", cls) as HTMLImageElement;
  img.src = url;
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";
  return img;
}

interface DeviceSummary {
  id: string;
  name: string;
  /** Raw OS id ("steamos", "windows") — routes the Deck carrier vs Windows flow. */
  os: string;
  system: string;
  provisioning: string;
  emulationCount: number;
}

interface ModuleSummary {
  id: string;
  name: string;
  description: string;
  changes?: string;
  planned: boolean;
}

interface GroupSummary {
  group: string;
  label: string;
  description: string;
  moduleCount: number;
  modules: ModuleSummary[];
}

interface Bundle {
  id: string;
  name: string;
  description: string;
  tag: string;
  recommended?: boolean;
  moduleIds: string[];
}

interface StepEvent {
  moduleId: string;
  name: string;
  group: string;
  status: "running" | "applied" | "skipped" | "failed";
  detail?: string;
}

interface ProvisionResult {
  applied: number;
  skipped: number;
}

interface StaticIp {
  ip: string;
  prefix?: number;
  gateway?: string;
  dns?: string;
}

interface UsbBuildRequest {
  modules: string[];
  baseId?: string;
  sshPublicKeys?: string[];
  hostname?: string;
  staticIp?: StaticIp;
  edition?: "home" | "pro";
  remoteAccess?: { sunshine?: boolean; moonlight?: boolean; rdp?: boolean };
  remoteAccessHost?: { sunshine?: boolean; moonlight?: boolean };
  sunshineUser?: string;
  sunshinePass?: string;
  wallpaperPath?: string;
  lockscreenPath?: string;
  disabledModules?: string[];
  selectedApps?: string[];
  selectedRemovals?: string[];
  account: { mode: "local" | "microsoft"; username?: string; password?: string };
  wifi?: { ssid: string; password: string };
  isoId?: string;
  regionId?: string;
}

interface BaseOption {
  id: string;
  label: string;
  description: string;
  tag?: string;
  recommended?: boolean;
}

interface PlanModule {
  id: string;
  name: string;
  description: string;
  changes?: string;
}

interface BasePlan {
  floor: PlanModule[];
  base: PlanModule[];
  extras: PlanModule[];
}

interface AppEntry {
  id: string;
  name: string;
  wingetId?: string;
  module?: string;
  source?: "msstore";
  desc?: string;
  recommended?: boolean;
}

interface AppGroup {
  id: string;
  label: string;
  apps: AppEntry[];
  note?: string;
}

interface RemovalEntry {
  id: string;
  name: string;
  appx?: string[];
  win32?: string[];
  recommended?: boolean;
  note?: string;
}

interface HostSshKey {
  id: string;
  label: string;
  type: string;
  publicKey: string;
}

interface DiscoveredDevice {
  buildId: string;
  mac: string;
  ip: string;
  hostname: string;
  username: string;
  status: string;
  mine: boolean;
}

interface ProfileSummary {
  name: string;
  deviceId?: string;
  baseId?: string;
  savedAt?: string;
}

interface Profile extends ProfileSummary {
  ui: Record<string, unknown>;
  secrets?: Record<string, string>;
}

interface ModuleStateReport {
  id: string;
  name: string;
  group: string;
  state: "applied" | "pending" | "unknown";
}

interface ProvisioningMethod {
  id: string;
  label: string;
  description: string;
  tag: string;
}

interface UsbDisk {
  number: number;
  name: string;
  sizeGb: number;
  letters: string;
  label: string;
}

interface IsoOption {
  id: string;
  label: string;
}

interface UsbProgress {
  pct: number;
  message: string;
  status: "running" | "done" | "error";
}

// ── Steam Deck / SteamOS carrier types (Path A: provision-only USB) ──
interface FlatpakApp {
  id: string;
  name: string;
  category: string;
  ref: string;
  note?: string;
}

interface PasswordManager {
  id: string;
  name: string;
}

interface DeckyStorePlugin {
  name: string;
  author: string;
  description: string;
  tags: string[];
  downloads: number;
  version: string;
  imageUrl: string;
}

/** The renderer's view of DeckConfig (Partial — buildDeckBundle normalizes). */
interface DeckConfig {
  hostname?: string;
  createSnapshot: boolean;
  flatpakApps: string[];
  ssh: { enabled: boolean; port: number; authorizedKeys: string[]; githubUser?: string };
  decky: { enabled: boolean; plugins: string[] };
  proton: { ge: boolean; protonUpQt: boolean; protontricks: boolean };
  emudeck: boolean;
  emulationStorage: "auto" | "internal" | "sdcard";
  sunshine: { enabled: boolean; user?: string; pass?: string };
  vnc: boolean;
  tailscale: boolean;
  waydroid: boolean;
  stickdeck: boolean;
  passwordManagers: { managers: string[]; method: "flatpak" | "distrobox" };
  staticIp?: {
    iface: "wifi" | "ethernet";
    ip: string;
    prefix: number;
    gateway?: string;
    dns?: string;
  };
}

interface DeckProvisionUsbReq {
  driveLetter: string;
  config: Partial<DeckConfig>;
}

interface DeckImage {
  name: string;
  url: string;
}

interface DeckReimageUsbReq {
  diskNumber: number;
  config: Partial<DeckConfig>;
}

interface UsbWriteReq extends UsbBuildRequest {
  diskNumber: number;
  isoPath?: string;
  isoId?: string;
}

interface PlatformOption {
  id: string;
  label: string;
  blurb: string;
  status: "ready" | "coming-soon";
}
interface DeviceOption {
  id: string;
  name: string;
  status: "ready" | "coming-soon";
}
interface LanguageOption {
  id: string;
  label: string;
  isoId: string;
}
interface RegionOption {
  id: string;
  label: string;
}

interface BootibleApi {
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
  formatUsb(drive: string): Promise<{ ok: boolean }>;
  listProfiles(): Promise<ProfileSummary[]>;
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

const VIEWS = [
  "welcome",
  "synckey",
  "verifymail",
  "twofa",
  "twofasetup",
  "platform",
  "devices",
  "home",
  "base",
  "customise",
  "apps",
  "stripkit",
  "bundles",
  "method",
  "setup",
  "account",
  "wifi",
  "review",
  "usbwrite",
  "deck",
  "deckapps",
  "deckemu",
  "deckplugins",
  "deckpm",
  "deckmethod",
  "deckwrite",
  "deckreimage",
  "watch",
  "connect",
  "provision",
  "done",
  "restore",
  "empty",
  "failed",
] as const;
type View = (typeof VIEWS)[number];

function isView(value: string): value is View {
  return (VIEWS as readonly string[]).includes(value);
}

/** Show a view by name, falling back to home for anything unknown. */
function show(view: string): void {
  const next: View = isView(view) ? view : "home";
  document.body.dataset.view = next;
  // Always land at the top of the new screen (Continue used to drop you mid-page).
  requestAnimationFrame(() => {
    document.querySelector(".views")?.scrollTo({ top: 0 });
    document.querySelector<HTMLElement>(`.view[data-view="${next}"]`)?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  });
}

const APPLY_LABELS: Record<string, string> = {
  usb: "Build USB",
  export: "Export config",
  device: "Apply now",
};

/** Set the review screen's primary-button label to match the chosen method. */
function setApplyLabel(): void {
  const method = document.body.dataset.method ?? "device";
  fill("apply-label", APPLY_LABELS[method] ?? "Apply");
}

/** Drive the active view from the URL hash so screens are deep-linkable. */
function syncFromHash(): void {
  const view = location.hash.replace(/^#/, "") || "welcome";
  show(view);
  if (view === "platform") void hydratePlatforms();
  if (view === "base") void hydrateBases();
  if (view === "customise") void hydrateCustomise();
  if (view === "apps") void hydrateApps();
  if (view === "stripkit") void hydrateStripkit();
  if (view === "account") {
    void hydrateSshKeys();
    // Full ROG restores the factory image — it doesn't create an account, so
    // re-word the screen away from "pick how it signs in".
    const strip = selectedBaseId === "full-rog";
    const root = document.querySelector('[data-view="account"]');
    const e = root?.querySelector(".eyebrow");
    const t = root?.querySelector(".setup-title");
    const s = root?.querySelector(".setup-sub");
    if (e) e.textContent = strip ? "Access" : "Account & access";
    if (t) t.textContent = strip ? "Access & SSH" : "Account & access";
    if (s) {
      s.textContent = strip
        ? "Name the device and choose how you'll reach it."
        : "Pick how it signs in, then name it and choose how you'll reach it.";
    }
  }
  if (view === "review") {
    setApplyLabel();
    renderReviewPlan();
  }
  if (view === "usbwrite") void hydrateUsbWrite();
  if (view === "deck") void hydrateDeck();
  if (view === "deckapps") void hydrateDeckApps();
  if (view === "deckemu") void hydrateDeckEmulators();
  if (view === "deckplugins") void hydrateDeckPlugins();
  if (view === "deckpm") void hydrateDeckPm();
  if (view === "deckwrite") void hydrateDeckWrite();
  if (view === "deckreimage") void hydrateDeckReimage();
  if (view === "watch") {
    void window.bootible?.startDiscovery?.();
    renderDiscovered();
  }
  if (view === "provision") startProvision();
}

// Navigation: any [data-go] control sets the hash, which drives the view. A
// [data-method] control also records which provisioning method was chosen.
// A [data-back] control pops real history, so Back always returns to the screen
// you actually came from regardless of which flow led here.
document.addEventListener("click", (event) => {
  const back = (event.target as HTMLElement).closest<HTMLElement>("[data-back]");
  if (back) {
    history.back();
    return;
  }
  const trigger = (event.target as HTMLElement).closest<HTMLElement>("[data-go]");
  if (!trigger) return;
  const method = trigger.dataset.method;
  if (method === "usb" || method === "export" || method === "device") {
    document.body.dataset.method = method;
  }
  let target = trigger.dataset.go;
  // Full ROG isn't a clean-install: customise → account (for SSH/access, with the
  // clean-only fields hidden) → strip-kit builder, not the USB writer.
  if (selectedBaseId === "full-rog") {
    if (target === "method") target = "account";
    else if (target === "wifi") target = "stripkit";
  }
  if (target) location.hash = target;
});

// Setup selection: a module row toggles itself; a group head toggles all of
// its modules. Both refresh the summary + head states.
document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;

  const row = target.closest<HTMLElement>(".module-row");
  if (row) {
    const on = row.classList.toggle("is-on");
    row.setAttribute("aria-pressed", String(on));
    updateSetupSummary();
    return;
  }

  const head = target.closest<HTMLElement>(".group-head");
  if (head) {
    const rows = [
      ...(head.closest(".group-block")?.querySelectorAll<HTMLElement>(".module-row") ?? []),
    ];
    const allOn = rows.every((r) => r.classList.contains("is-on"));
    for (const r of rows) {
      r.classList.toggle("is-on", !allOn);
      r.setAttribute("aria-pressed", String(!allOn));
    }
    updateSetupSummary();
  }
});

// Snapshot / account / target cards are single-select (radio behaviour).
document.addEventListener("click", (event) => {
  const snap = (event.target as HTMLElement).closest<HTMLElement>(".snap");
  if (!snap) return;
  for (const sibling of snap.parentElement?.querySelectorAll(".snap") ?? []) {
    const selected = sibling === snap;
    sibling.classList.toggle("is-sel", selected);
    sibling.setAttribute("aria-pressed", String(selected));
  }
  // Account cards drive which install-time fields show (local vs Microsoft).
  if (snap.dataset.account) document.body.dataset.account = snap.dataset.account;
});

window.addEventListener("hashchange", syncFromHash);

/** Write a value into every [data-field="<field>"] element. */
function fill(field: string, value: string): void {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-field="${field}"]`)) {
    el.textContent = value;
  }
}

// Reflect the real core version in the system bar without clobbering the LED.
const statusText = document.querySelector<HTMLElement>(".sysstatus-text");
if (statusText && window.bootible?.version) {
  statusText.textContent = `${window.bootible.version} · local`;
}

// ── device picker (page 1 platform → page 2 device → summary) ───────────────
// A platform/device card, styled like the persona method-cards. Ready cards are
// clickable (data-pick); coming-soon cards are dimmed and inert.
function pickCard(
  kind: "platform" | "device",
  id: string,
  title: string,
  desc: string,
  status: string,
): HTMLElement {
  const ready = status === "ready";
  const card = el("button", `method-card${ready ? "" : " is-soon"}`) as HTMLButtonElement;
  card.type = "button";
  if (ready) {
    card.dataset.pick = kind;
    card.dataset.id = id;
  } else {
    card.disabled = true;
  }
  // Brand/OS logo (masked) when we have one, else a placeholder glyph.
  const logoUrl = kind === "platform" ? OS_LOGOS[id] : DEVICE_LOGOS[DEVICE_BRAND[id] ?? id];
  const icon = logoUrl
    ? logoEl(logoUrl, "method-icon method-icon-img")
    : el("span", "method-icon", kind === "platform" ? "❖" : "◈");
  icon.setAttribute("aria-hidden", "true");
  const main = el("span", "method-main");
  main.append(el("span", "method-name", title));
  if (desc) main.append(el("span", "method-desc", desc));
  const meta = el("span", "method-meta");
  meta.append(el("span", "group-tag", ready ? "ready" : "coming soon"));
  if (ready) meta.append(el("span", "arrow", "→"));
  card.append(icon, main, meta);
  return card;
}

/** Page 1 — render the platform families. */
async function hydratePlatforms(): Promise<void> {
  const api = window.bootible;
  const list = document.querySelector<HTMLElement>(".platform-list");
  if (!api?.getPlatforms || !list) return;
  let platforms: PlatformOption[] = [];
  try {
    platforms = await api.getPlatforms();
  } catch {
    return;
  }
  list.replaceChildren(
    ...platforms.map((p) => pickCard("platform", p.id, p.label, p.blurb, p.status)),
  );
}

/** Page 2 — render the devices for the chosen platform. */
async function hydrateDevices(platformId: string): Promise<void> {
  const api = window.bootible;
  const list = document.querySelector<HTMLElement>(".device-list");
  if (!api?.getDevices || !list) return;
  let devices: DeviceOption[] = [];
  try {
    devices = await api.getDevices(platformId);
  } catch {
    return;
  }
  list.replaceChildren(...devices.map((d) => pickCard("device", d.id, d.name, "", d.status)));
}

/** Record the picked device and fill the summary screen from its summary. */
async function selectDeviceAndGo(id: string): Promise<void> {
  const api = window.bootible;
  if (!api?.selectDevice) return;
  const device = await api.selectDevice(id);
  if (!device) return;
  selectedDeviceId = id;
  deviceName = device.name;
  void refreshProfileList();
  fill("name", device.name);
  fill("system", device.system);
  fill("device-sub", `${device.system} handheld — selected.`);
  fill("base-eyebrow", `Your ${device.name}`);
  // The Deck (SteamOS) uses the host-carrier flow, not the Windows base/customise
  // wizard — point the home "Set up" button at the Deck config screen.
  const isDeck = usesDeckCarrierOs(device.os);
  const setupBtn = document.querySelector<HTMLElement>(
    '.view[data-view="home"] .actions [data-go]',
  );
  if (setupBtn) setupBtn.dataset.go = isDeck ? "deck" : "base";
  const flowLine = document.querySelector<HTMLElement>(
    '.view[data-view="home"] .readout .rline:nth-child(3) .rval',
  );
  if (flowLine) {
    flowLine.textContent = isDeck
      ? "configure (you install SteamOS)"
      : "wipe → install → configure";
  }
  location.hash = "home";
}

/** A base card — the experience picker (charcoal/amber method-card style). */
// Base → representative logo: Raw Windows, Steam Big Picture, Full ROG.
const BASE_LOGO: Record<string, string | undefined> = {
  raw: OS_LOGOS.windows,
  "steam-bp": APP_LOGOS.steam,
  "full-rog": DEVICE_LOGOS.rog,
};
function baseCard(base: BaseOption): HTMLElement {
  const card = el("button", "method-card") as HTMLButtonElement;
  card.type = "button";
  card.dataset.pick = "base";
  card.dataset.id = base.id;
  const url = BASE_LOGO[base.id];
  const icon = url
    ? logoEl(url, "method-icon method-icon-img")
    : el("span", "method-icon", base.recommended ? "★" : "◆");
  icon.setAttribute("aria-hidden", "true");
  const main = el("span", "method-main");
  main.append(el("span", "method-name", base.label), el("span", "method-desc", base.description));
  const meta = el("span", "method-meta");
  if (base.tag) meta.append(el("span", "group-tag", base.tag));
  meta.append(el("span", "arrow", "→"));
  card.append(icon, main, meta);
  return card;
}

/** Render the base selector (the page after the device summary). */
async function hydrateBases(): Promise<void> {
  const api = window.bootible;
  const list = document.querySelector<HTMLElement>(".base-list");
  if (!api?.getBases || !list) return;
  let bases: BaseOption[] = [];
  try {
    bases = await api.getBases();
  } catch {
    return;
  }
  list.replaceChildren(...bases.map(baseCard));
}

// ── review & customise screen ───────────────────────────────────────────────
const FLOOR_WARNING = "Not recommended — every bootible device is meant to be tuned & debloated.";

/** One toggle row on the customise screen. Floor/base are checked by default
 *  (untick → disabledModules); extras are unchecked (tick → enabledExtras). */
function customiseRow(m: PlanModule, kind: "floor" | "base" | "extra"): HTMLElement {
  const isApps = m.id === "apps";
  const checked = kind === "extra" ? enabledExtras.has(m.id) : !disabledModules.has(m.id);
  const row = el("div", `cz-row${checked ? "" : " is-off"}`);
  const cb = el("input", "cz-check") as HTMLInputElement;
  cb.type = "checkbox";
  cb.checked = checked;
  cb.dataset.moduleId = m.id;
  cb.dataset.kind = kind;
  const text = el("div", "cz-text");
  text.append(el("div", "cz-name", m.name));
  if (m.description) text.append(el("div", "cz-desc", m.description));
  if (m.changes) text.append(el("div", "cz-chg", m.changes));
  if (kind === "floor" && !checked) text.append(el("div", "cz-warn", `⚠ ${FLOOR_WARNING}`));
  if (isApps && checked) {
    const pick = el(
      "button",
      "cz-applink",
      `Choose apps (${selectedApps.size}) →`,
    ) as HTMLButtonElement;
    pick.type = "button";
    pick.dataset.go = "apps";
    text.append(pick);
  }
  row.append(cb, text);
  return row;
}

function section(title: string, count: number, rows: HTMLElement[]): HTMLElement {
  const sec = el("div", "cz-sec");
  const head = el("div", "cz-sec-h", title);
  head.append(el("span", "cz-sec-count", ` · ${count}`));
  sec.append(head, ...rows);
  return sec;
}

function renderCustomise(): void {
  const host = document.querySelector<HTMLElement>("#customise-body");
  if (!host || !basePlan) return;
  const secs: HTMLElement[] = [];
  secs.push(
    section(
      "Always — the floor",
      basePlan.floor.length,
      basePlan.floor.map((m) => customiseRow(m, "floor")),
    ),
  );
  if (basePlan.base.length) {
    secs.push(
      section(
        "From your base",
        basePlan.base.length,
        basePlan.base.map((m) => customiseRow(m, "base")),
      ),
    );
  }
  const extraRows = basePlan.extras.map((m) => customiseRow(m, "extra"));
  const counts = pickCounts();
  extraRows.push(
    pickerRow("Apps", "Browsers, comms, launchers, dev tools, VPNs & more.", counts.apps, "apps"),
    pickerRow(
      "Emulators",
      "EmuDeck, RetroArch and per-system emulators.",
      counts.emulators,
      "emulators",
    ),
  );
  secs.push(section("Add extras", basePlan.extras.length + 2, extraRows));
  // Full ROG: opt-in "Remove apps" checklist (drives the strip list).
  if (selectedBaseId === "full-rog" && removalsCatalog.length) {
    secs.push(removalsSection());
  }
  host.replaceChildren(...secs);
  // Running summary.
  const floorOn = basePlan.floor.filter((m) => !disabledModules.has(m.id)).length;
  const baseOn = basePlan.base.filter((m) => !disabledModules.has(m.id)).length;
  const extrasOn = enabledExtras.size + selectedApps.size;
  const sum = document.querySelector("#customise-summary");
  if (sum) {
    sum.textContent = `${floorOn + baseOn + extrasOn} things will run · ${floorOn} core · ${baseOn} base · ${extrasOn} extras`;
  }
}

/** The Full ROG opt-in removals checklist — a collapsible block of checkboxes,
 *  off by default (nothing removed unless ticked), with a "Select recommended"
 *  shortcut. Drives config.settings.strip_removals. */
function removalsSection(): HTMLElement {
  const details = el("details", "app-group cz-removals") as HTMLDetailsElement;
  if (selectedRemovals.size > 0) details.open = true;
  const summary = el("summary", "app-group-sum");
  summary.append(
    el("span", "app-group-name", "Remove apps (optional)"),
    el(
      "span",
      `app-group-count${selectedRemovals.size > 0 ? " on" : ""}`,
      `${selectedRemovals.size} / ${removalsCatalog.length}`,
    ),
  );
  const body = el("div", "app-items");
  const note = el(
    "p",
    "app-note",
    "Nothing is removed unless you tick it. Phone Link is kept by default.",
  );
  const rec = el("button", "cz-applink", "Select recommended") as HTMLButtonElement;
  rec.type = "button";
  rec.dataset.removalsRec = "1";
  body.append(note, rec);
  for (const r of removalsCatalog) {
    const row = el("label", "app-row");
    const cb = el("input", "app-check") as HTMLInputElement;
    cb.type = "checkbox";
    cb.dataset.removal = r.id;
    cb.checked = selectedRemovals.has(r.id);
    const meta = el("span", "app-meta");
    const name = el("span", "app-name", r.name);
    if (r.recommended) name.append(el("span", "cz-rec-tag", "Recommended"));
    meta.append(name);
    if (r.note) meta.append(el("span", "app-id", r.note));
    row.append(cb, meta);
    body.append(row);
  }
  details.append(summary, body);
  return details;
}

/** A Review row that opens a picker (Apps / Emulators), showing the live count. */
function pickerRow(
  label: string,
  desc: string,
  count: number,
  mode: "apps" | "emulators",
): HTMLElement {
  const row = el("div", "cz-row cz-picker");
  const text = el("div", "cz-text");
  text.append(el("div", "cz-name", label), el("div", "cz-desc", desc));
  const pick = el(
    "button",
    "cz-applink",
    `Choose ${label.toLowerCase()} (${count}) →`,
  ) as HTMLButtonElement;
  pick.type = "button";
  pick.dataset.picker = mode;
  text.append(pick);
  row.append(text);
  return row;
}

/** Fetch the base's plan once per base, then render the customise screen. */
async function hydrateCustomise(): Promise<void> {
  const api = window.bootible;
  if (!api?.getBasePlan || !selectedBaseId) return;
  if (!customiseHydrated) {
    try {
      basePlan = await api.getBasePlan(selectedBaseId);
    } catch {
      basePlan = null;
    }
    // Fresh base entry resets toggles; a just-loaded profile keeps its restored ones.
    if (!keepRestoredCustomise) {
      disabledModules.clear();
      enabledExtras.clear();
    }
    keepRestoredCustomise = false;
    customiseHydrated = true;
  }
  // The Apps/Emulators counts need the catalog loaded.
  if (!appGroups.length && api.getAppGroups) {
    try {
      appGroups = await api.getAppGroups();
    } catch {}
  }
  // Full ROG: load the opt-in removal catalog for the "Remove apps" checklist.
  if (!removalsCatalog.length && api.getRemovals) {
    try {
      removalsCatalog = await api.getRemovals();
    } catch {}
  }
  renderCustomise();
}

// ── app / emulator picker (collapsible groups) ──────────────────────────────
/** An entry is "on" if its winget pick is selected, or — for a module entry like
 *  EmuDeck — its module is enabled. */
function entryOn(a: AppEntry): boolean {
  return a.module ? enabledExtras.has(a.module) : selectedApps.has(a.id);
}

/** The groups shown in the current picker mode (Apps = everything but emulators;
 *  Emulators = just that group). */
function pickerGroups(): AppGroup[] {
  return pickerMode === "emulators"
    ? appGroups.filter((g) => g.id === EMU_GROUP)
    : appGroups.filter((g) => g.id !== EMU_GROUP);
}

function appGroupNode(group: AppGroup): HTMLElement {
  const onCount = group.apps.filter(entryOn).length;
  const details = el("details", "app-group") as HTMLDetailsElement;
  details.dataset.group = group.id;
  // Respect the user's expand/collapse (tracked in openGroups) — don't force a
  // group back open just because it has a selection on every re-render.
  details.open = openGroups.has(group.id);
  const summary = el("summary", "app-group-sum");
  const gcb = el("input", "app-group-check") as HTMLInputElement;
  gcb.type = "checkbox";
  gcb.dataset.group = group.id;
  gcb.checked = onCount === group.apps.length;
  gcb.indeterminate = onCount > 0 && onCount < group.apps.length;
  summary.append(
    gcb,
    el("span", "app-group-name", group.label),
    el("span", `app-group-count${onCount > 0 ? " on" : ""}`, `${onCount} / ${group.apps.length}`),
  );
  const items = el("div", "app-items");
  for (const a of group.apps) {
    const row = el("label", "app-row");
    const cb = el("input", "app-check") as HTMLInputElement;
    cb.type = "checkbox";
    if (a.module) cb.dataset.module = a.module;
    else cb.dataset.app = a.id;
    cb.checked = entryOn(a);
    let logoCls = "app-logo";
    if (FORCE_WHITE.has(a.id)) logoCls += " force-white";
    if (LOGO_SCALE.has(a.id)) logoCls += " scaled";
    const logo = logoEl(APP_LOGOS[a.id], logoCls);
    const meta = el("span", "app-meta");
    meta.append(el("span", "app-name", a.name));
    meta.append(el("span", "app-id", a.desc ?? a.wingetId ?? ""));
    row.append(cb, logo, meta);
    items.append(row);
  }
  if (group.note) items.append(el("p", "app-note", group.note));
  details.append(summary, items);
  return details;
}

function renderApps(): void {
  const host = document.querySelector<HTMLElement>("#apps-body");
  if (!host) return;
  host.replaceChildren(...pickerGroups().map(appGroupNode));
  fill("apps-title", pickerMode === "emulators" ? "Choose emulators" : "Choose apps");
  const n = pickerMode === "emulators" ? pickCounts().emulators : pickCounts().apps;
  const count = document.querySelector("#apps-count");
  if (count) {
    const word = pickerMode === "emulators" ? "emulator" : "app";
    count.textContent = `${n} ${word}${n === 1 ? "" : "s"} selected`;
  }
}

async function hydrateApps(): Promise<void> {
  const api = window.bootible;
  if (!api?.getAppGroups) return;
  if (!appsHydrated) {
    try {
      appGroups = await api.getAppGroups();
    } catch {
      appGroups = [];
    }
    appsHydrated = true;
  }
  // On (re)entering the picker, open the groups that have selections — but from
  // here the user's manual expand/collapse (toggle event) is what's respected.
  openGroups.clear();
  for (const g of pickerGroups()) {
    if (pickerMode === "emulators" || g.apps.some(entryOn)) openGroups.add(g.id);
  }
  renderApps();
}

// Keep openGroups in sync with the user's expand/collapse. `toggle` doesn't
// bubble, so listen in the capture phase.
document.addEventListener(
  "toggle",
  (event) => {
    const d = event.target;
    if (!(d instanceof HTMLDetailsElement) || !d.classList.contains("app-group")) return;
    const id = d.dataset.group;
    if (!id) return;
    if (d.open) openGroups.add(id);
    else openGroups.delete(id);
  },
  true,
);

// ── strip kit (Full ROG): save to disk / USB, format, eject ─────────────────
let skMode: "disk" | "usb" = "disk";
let skDisks: UsbDisk[] = [];
let skSelectedDisk = "";

function setSkStatus(msg: string): void {
  const s = document.querySelector("#sk-status");
  if (s) s.textContent = msg;
}

function setSkMode(mode: "disk" | "usb"): void {
  skMode = mode;
  for (const tab of document.querySelectorAll<HTMLElement>(".sk-tab")) {
    tab.classList.toggle("is-active", tab.dataset.sk === mode);
  }
  for (const pane of document.querySelectorAll<HTMLElement>(".sk-pane")) {
    pane.hidden = pane.dataset.skPane !== mode;
  }
}

function renderSkUsbList(): void {
  const host = document.querySelector<HTMLElement>("#sk-usb-list");
  if (!host) return;
  if (!skDisks.length) {
    host.replaceChildren(
      el("p", "app-note", "No USB media found — plug one in and reopen this screen."),
    );
    return;
  }
  host.replaceChildren(
    ...skDisks.map((d) => {
      const letter = (d.letters || "").split(/[,\s]+/).filter(Boolean)[0] ?? "";
      const row = el("label", "sk-usb-row");
      const radio = el("input", "") as HTMLInputElement;
      radio.type = "radio";
      radio.name = "sk-usb";
      radio.value = letter;
      radio.checked = skSelectedDisk === letter;
      radio.disabled = !letter;
      const meta = el("span", "sk-usb-meta");
      meta.append(el("span", "sk-usb-name", `${d.name} (${d.sizeGb} GB)`));
      meta.append(el("span", "app-id", letter || `disk ${d.number} (no drive letter)`));
      row.append(radio, meta);
      return row;
    }),
  );
}

async function hydrateStripkit(): Promise<void> {
  const api = window.bootible;
  setSkMode(skMode);
  setSkStatus("");
  refreshProfileSaveUI();
  if (api?.getUsbDisks) {
    try {
      skDisks = await api.getUsbDisks();
    } catch {
      skDisks = [];
    }
  }
  renderSkUsbList();
}

/** Install Sunshine/Moonlight on THIS desktop if the user ticked the host boxes.
 *  Mirrors the clean-install path, which the strip flow previously skipped. */
async function skHostStreaming(req: UsbBuildRequest): Promise<void> {
  const which = req.remoteAccessHost;
  if (!which || (!which.sunshine && !which.moonlight)) return;
  const api = window.bootible;
  if (!api?.installHostStreaming) return;
  setSkStatus("Setting up streaming on this PC (host)…");
  const h = await api.installHostStreaming(which);
  setSkStatus(`Host streaming: ${h.output}`);
}

async function skSaveDisk(): Promise<void> {
  const api = window.bootible;
  if (!api?.saveStripKitDisk) return;
  const req = gatherUsbRequest();
  setSkStatus("Saving…");
  const res = await api.saveStripKitDisk(req);
  if (!res) {
    setSkStatus("Cancelled.");
    return;
  }
  setSkStatus(`✓ Saved bootible-prep to ${res.path}`);
  await skHostStreaming(req);
}

async function skCopyUsb(): Promise<void> {
  const api = window.bootible;
  if (!api?.saveStripKitUsb) return;
  if (!skSelectedDisk) {
    setSkStatus("Pick a USB drive first.");
    return;
  }
  const format = document.querySelector<HTMLInputElement>("#sk-format")?.checked ?? false;
  const req = gatherUsbRequest();
  try {
    if (format && api.formatUsb) {
      setSkStatus("Formatting (approve the UAC prompt)…");
      const f = await api.formatUsb(skSelectedDisk);
      if (!f.ok) setSkStatus("Format failed — copying without it…");
    }
    setSkStatus("Copying…");
    const res = await api.saveStripKitUsb(req, skSelectedDisk);
    setSkStatus(`✓ Copied to ${res.path} — safe to eject.`);
    await skHostStreaming(req);
  } catch (e) {
    setSkStatus(`Copy failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function skEject(): Promise<void> {
  const api = window.bootible;
  if (!api?.ejectUsb || !skSelectedDisk) {
    setSkStatus("Pick a USB drive first.");
    return;
  }
  setSkStatus("Ejecting…");
  const r = await api.ejectUsb(skSelectedDisk);
  setSkStatus(
    r.ok
      ? "✓ Ejected — safe to remove."
      : "Eject failed — close any Explorer windows or files open on the drive, then retry.",
  );
}

async function skRefresh(): Promise<void> {
  const api = window.bootible;
  if (!api?.getUsbDisks) return;
  setSkStatus("Rescanning USB media…");
  try {
    skDisks = await api.getUsbDisks();
  } catch {
    skDisks = [];
  }
  renderSkUsbList();
  setSkStatus(
    skDisks.length ? `Found ${skDisks.length} USB drive(s).` : "Still no USB media found.",
  );
}

async function skVerify(): Promise<void> {
  const api = window.bootible;
  const out = document.querySelector("#sk-verify-out");
  const ip = document.querySelector<HTMLInputElement>("#sk-verify-ip")?.value.trim();
  const user = document.querySelector<HTMLInputElement>("#sk-verify-user")?.value.trim();
  if (!ip) {
    if (out) out.textContent = "Enter the device's IP, hostname, or Tailscale IP first.";
    return;
  }
  if (!user) {
    if (out) out.textContent = "Enter the device's account name (the one you set at OOBE).";
    return;
  }
  if (!api?.verifyDevice) return;
  if (out) out.textContent = `Reaching ${user}@${ip} over SSH…`;
  try {
    const r = await api.verifyDevice(ip, user);
    if (out) {
      out.textContent = r.reachable
        ? `✓ Reachable${r.alias ? ` (ssh ${r.alias})` : ""} — ${r.output}`
        : `✗ Couldn't reach it: ${r.output}`;
    }
  } catch (e) {
    if (out) out.textContent = `Verify failed: ${e instanceof Error ? e.message : String(e)}`;
  }
}

// Strip-kit clicks: tab toggle + the disk/usb/eject buttons.
document.addEventListener("click", (event) => {
  const t = event.target as HTMLElement;
  const tab = t.closest<HTMLElement>(".sk-tab");
  if (tab?.dataset.sk) {
    setSkMode(tab.dataset.sk === "usb" ? "usb" : "disk");
    return;
  }
  if (t.closest("#sk-disk-save")) void skSaveDisk();
  else if (t.closest("#sk-usb-copy")) void skCopyUsb();
  else if (t.closest("#sk-usb-eject")) void skEject();
  else if (t.closest("#sk-usb-refresh")) void skRefresh();
  else if (t.closest("#sk-verify-btn")) void skVerify();
});

document.addEventListener("change", (event) => {
  const r = event.target as HTMLInputElement;
  if (r?.name === "sk-usb") skSelectedDisk = r.value;
});

// ── SSH source: BYO key / GitHub / Both ─────────────────────────────────────
let sshHydrated = false;
let sshMode: "byo" | "github" | "both" = "byo";
let githubKeys: string[] = [];

/** Switch the SSH source tab — slide the indicator and show the right pane(s). */
function setSshMode(mode: "byo" | "github" | "both"): void {
  sshMode = mode;
  const order = ["byo", "github", "both"];
  for (const tab of document.querySelectorAll<HTMLElement>(".ssh-tab")) {
    tab.classList.toggle("is-active", tab.dataset.sshmode === mode);
  }
  const glide = document.querySelector<HTMLElement>(".ssh-tab-glide");
  if (glide) glide.style.transform = `translateX(${order.indexOf(mode) * 100}%)`;
  const showByo = mode === "byo" || mode === "both";
  const showGithub = mode === "github" || mode === "both";
  document.querySelector('.ssh-pane[data-pane="byo"]')?.toggleAttribute("hidden", !showByo);
  document.querySelector('.ssh-pane[data-pane="github"]')?.toggleAttribute("hidden", !showGithub);
}

/** Fetch + show the GitHub user's public keys (debounced via blur/Enter). */
async function refreshGithubKeys(): Promise<void> {
  const user = (document.querySelector<HTMLInputElement>("#github-user")?.value ?? "").trim();
  const status = document.querySelector<HTMLElement>("#github-status");
  if (!user) {
    githubKeys = [];
    if (status) status.textContent = "Pulls your public keys from github.com/<user>.keys";
    return;
  }
  if (status) status.textContent = "Looking up keys…";
  githubKeys = (await window.bootible?.githubKeys?.(user)) ?? [];
  if (status) {
    status.textContent = githubKeys.length
      ? `✓ ${githubKeys.length} key${githubKeys.length === 1 ? "" : "s"} from github.com/${user}.keys`
      : `No public keys at github.com/${user}.keys`;
    status.classList.toggle("ok", githubKeys.length > 0);
  }
}

// SSH source tab switch.
document.addEventListener("click", (event) => {
  const tab = (event.target as HTMLElement).closest<HTMLElement>(".ssh-tab");
  const mode = tab?.dataset.sshmode;
  if (mode === "byo" || mode === "github" || mode === "both") setSshMode(mode);
});

// GitHub username -> fetch its public keys (on blur / Enter).
document.addEventListener("change", (event) => {
  if ((event.target as HTMLElement).id === "github-user") void refreshGithubKeys();
});

/** Render the host's SSH keys as a multi-select, or an empty/generate state. */
function renderSshKeys(): void {
  const list = document.querySelector<HTMLElement>("#ssh-key-list");
  if (!list) return;
  if (hostSshKeys.length === 0) {
    const empty = el("p", "muted ssh-empty", "No SSH keys found on this PC. ");
    const gen = el("button", "linkbtn", "Generate one") as HTMLButtonElement;
    gen.type = "button";
    gen.id = "ssh-generate";
    empty.append(gen);
    list.replaceChildren(empty);
    return;
  }
  list.replaceChildren(
    ...hostSshKeys.map((k) => {
      const row = el("label", "ssh-key-row") as HTMLLabelElement;
      const cb = el("input", "ssh-key-check") as HTMLInputElement;
      cb.type = "checkbox";
      cb.dataset.keyId = k.id;
      cb.checked = selectedKeyIds.has(k.id);
      const meta = el("span", "ssh-key-meta");
      meta.append(el("span", "ssh-key-label", k.label), el("span", "ssh-key-type", k.type));
      row.append(cb, meta);
      return row;
    }),
  );
}

/** The Windows RDP checkbox is only usable on Pro (Home can't host RDP), so grey
 *  it out on Home and clear it. */
function updateEditionState(): void {
  const pro = document.querySelector<HTMLInputElement>("#edition-pro")?.checked ?? false;
  const rdp = document.querySelector<HTMLInputElement>("#ra-rdp");
  if (rdp) {
    rdp.disabled = !pro;
    if (!pro) rdp.checked = false;
  }
  document.querySelector("#ra-rdp-row")?.classList.toggle("is-disabled", !pro);
}

/** Fetch the host's SSH public keys and pre-select them all the first time. */
async function hydrateSshKeys(): Promise<void> {
  const api = window.bootible;
  if (!api?.getHostSshKeys) return;
  try {
    hostSshKeys = await api.getHostSshKeys();
  } catch {
    hostSshKeys = [];
  }
  if (!sshHydrated) {
    for (const k of hostSshKeys) selectedKeyIds.add(k.id);
    sshHydrated = true;
  }
  renderSshKeys();
  setSshMode(sshMode);
  updateEditionState();
  // Pre-fill the static IP hint from this PC's subnet (so the user types one host).
  if (!netSuggestion && api.suggestNetwork) {
    try {
      netSuggestion = await api.suggestNetwork();
    } catch {}
    const input = document.querySelector<HTMLInputElement>("#static-ip");
    if (input && netSuggestion) input.placeholder = `${netSuggestion.subnet}50  (optional)`;
  }
}

// Card clicks on the platform / devices / base pages.
document.addEventListener("click", (event) => {
  const card = (event.target as HTMLElement).closest<HTMLElement>("[data-pick]");
  if (!card) return;
  const id = card.dataset.id ?? "";
  if (card.dataset.pick === "platform") {
    const label = card.querySelector(".method-name")?.textContent ?? "";
    fill("devices-eyebrow", `Step 2 of 2 · ${label}s`);
    void hydrateDevices(id);
    location.hash = "devices";
  } else if (card.dataset.pick === "device") {
    void selectDeviceAndGo(id);
  } else if (card.dataset.pick === "base") {
    selectedBaseId = id;
    customiseHydrated = false; // re-resolve the plan for the newly chosen base
    // Full ROG reuses the account screen for SSH/access but hides the
    // clean-install-only fields (account mode, edition, password).
    document.body.classList.toggle("is-strip", id === "full-rog");
    location.hash = "customise";
  }
});

void hydratePlatforms();

// ── module catalog ────────────────────────────────────────────────────────
// The setup groups, the review plan and every module count are driven by the
// real catalog the core exposes — no hardcoded "14".

const GROUP_TAGS: Record<string, string> = {
  system: "configure",
  performance: "tune",
  apps: "install",
  library: "link",
};

let catalog: GroupSummary[] = [];
let deviceName = "ROG Ally X";
let selectedDeviceId = "";
let selectedBaseId = "";

/** OSes provisioned via the SteamOS/Linux host-carrier flow (mirrors core's
 *  usesDeckCarrier — kept in sync; SteamOS today, Bazzite later). */
const CARRIER_OSES = new Set(["steamos"]);
function usesDeckCarrierOs(os: string): boolean {
  return CARRIER_OSES.has(os);
}
let loadedProfileName = ""; // the profile currently loaded (drives Update vs Save-as-new)
let hostSshKeys: HostSshKey[] = [];
const selectedKeyIds = new Set<string>();
let netSuggestion: { prefix: number; gateway: string; subnet: string } | null = null;
let intendedStaticIp = "";
let wallpaperPath = "";
let lockscreenPath = "";
// Review/customise + app-picker state.
let basePlan: BasePlan | null = null;
let customiseHydrated = false;
// Set by applyProfile so the next hydrateCustomise keeps the restored extras/
// disabled modules instead of resetting them for a fresh base.
let keepRestoredCustomise = false;
const disabledModules = new Set<string>(); // unticked floor/base modules
const enabledExtras = new Set<string>(); // ticked optional extras (incl. "apps")
let appGroups: AppGroup[] = [];
const selectedApps = new Set<string>();
const openGroups = new Set<string>(); // which app-picker groups are expanded
// Full ROG opt-in removals (off until ticked).
let removalsCatalog: RemovalEntry[] = [];
const selectedRemovals = new Set<string>();
let appsHydrated = false;
let pickerMode: "apps" | "emulators" = "apps";
const EMU_GROUP = "emulators";

/** Slugs of every emulator entry (so Apps vs Emulators counts can be split). */
function emulatorSlugs(): Set<string> {
  return new Set(appGroups.find((g) => g.id === EMU_GROUP)?.apps.map((a) => a.id) ?? []);
}

/** Whether an emulator entry counts as "on" — winget picks live in selectedApps,
 *  EmuDeck (a module) lives in enabledExtras. */
function emuEntryOn(a: AppEntry): boolean {
  return a.module ? enabledExtras.has(a.module) : selectedApps.has(a.id);
}

/** Count of picked apps (non-emulators) and emulators, for the Review rows. */
function pickCounts(): { apps: number; emulators: number } {
  const emu = emulatorSlugs();
  const apps = [...selectedApps].filter((s) => !emu.has(s)).length;
  const emuGroup = appGroups.find((g) => g.id === EMU_GROUP);
  const emulators = emuGroup ? emuGroup.apps.filter(emuEntryOn).length : 0;
  return { apps, emulators };
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** "1 step" / "3 steps" — pluralise the step count. */
function steps(n: number): string {
  return `${n} step${n === 1 ? "" : "s"}`;
}

/** Render the setup screen: per group, a toggle-all header + per-module rows. */
function renderGroups(): void {
  const container = document.querySelector<HTMLElement>(".groups");
  if (!container) return;

  container.replaceChildren(
    ...catalog.map((group) => {
      const block = el("div", "group-block");

      const head = el("button", "group group-head is-on") as HTMLButtonElement;
      head.type = "button";
      head.dataset.group = group.group;
      head.setAttribute("aria-pressed", "true");
      const toggle = el("span", "group-toggle");
      toggle.setAttribute("aria-hidden", "true");
      const main = el("span", "group-main");
      main.append(
        el("span", "group-name", group.label),
        el("span", "group-desc", group.description),
      );
      const meta = el("span", "group-meta");
      meta.append(
        el("span", "group-tag", GROUP_TAGS[group.group] ?? ""),
        el("span", "group-count", steps(group.moduleCount)),
        el("span", "group-state", ""),
      );
      head.append(toggle, main, meta);

      const rows = el("div", "module-rows");
      rows.append(...group.modules.map(moduleRow));

      block.append(head, rows);
      return block;
    }),
  );
}

/** A single module row — a real toggle, or a dimmed "coming soon" entry that
 *  can't be selected. */
function moduleRow(module: ModuleSummary): HTMLElement {
  const text = el("span", "module-text");
  const name = el("span", "module-name", module.name);
  if (module.planned) name.append(el("span", "module-badge", "coming soon"));
  text.append(name, el("span", "module-desc", module.description));

  const toggle = el("span", "module-toggle");
  toggle.setAttribute("aria-hidden", "true");

  if (module.planned) {
    const row = el("div", "module-soon");
    row.append(toggle, text);
    return row;
  }

  if (module.changes) text.append(el("span", "module-changes", `changes: ${module.changes}`));
  const row = el("button", "module-row is-on") as HTMLButtonElement;
  row.type = "button";
  row.dataset.module = module.id;
  row.setAttribute("aria-pressed", "true");
  row.append(toggle, text);
  return row;
}

// Source of truth for the chosen modules — set by a bundle pick (player path)
// or synced from the tinker toggles. The review/build/export all read this.
let selectedModules: string[] = [];

function selectedModuleIds(): string[] {
  return selectedModules;
}

/** Recompute the selection from the tinker screen's toggled-on rows. */
function syncSelectionFromTinker(): void {
  selectedModules = [...document.querySelectorAll<HTMLElement>(".module-row.is-on")]
    .map((row) => row.dataset.module ?? "")
    .filter(Boolean);
}

/** Group heads reflect all/some/none of their modules being selected. */
function updateGroupHeads(): void {
  for (const head of document.querySelectorAll<HTMLElement>(".group-head")) {
    const rows = [...(head.closest(".group-block")?.querySelectorAll(".module-row") ?? [])];
    const on = rows.filter((r) => r.classList.contains("is-on")).length;
    head.classList.toggle("is-on", on === rows.length && rows.length > 0);
    head.classList.toggle("is-partial", on > 0 && on < rows.length);
    head.setAttribute("aria-pressed", String(on === rows.length));
  }
}

/** Render the review screen's WILL RUN rows: per-group selected counts. */
function renderReviewPlan(): void {
  const plan = document.querySelector<HTMLElement>(".review-plan");
  if (!plan) return;

  const selected = new Set(selectedModuleIds());
  const foot = plan.querySelector(".readout-foot");
  const rows = catalog.map((group) => {
    const picked = group.modules.filter((m) => selected.has(m.id)).length;
    const row = el("div", "plan-row");
    row.append(
      el("span", "mark"),
      el("span", "plan-name", group.label),
      el("span", picked === 0 ? "plan-n muted" : "plan-n", `${picked} of ${group.moduleCount}`),
    );
    return row;
  });

  plan.replaceChildren(...rows);
  if (foot) plan.append(foot);
}

/** Reflect the per-module selection in the setup summary rail. */
function updateSetupSummary(): void {
  syncSelectionFromTinker();
  const selected = selectedModuleIds();
  const groupsOn = new Set(
    [...document.querySelectorAll<HTMLElement>(".module-row.is-on")].map(
      (r) =>
        r
          .closest<HTMLElement>(".group-head, .group-block")
          ?.querySelector(".group-head")
          ?.getAttribute("data-group") ?? "",
    ),
  );
  groupsOn.delete("");
  fill("groups-summary", `${groupsOn.size} of ${catalog.length} on`);
  fill("steps-summary", `${selected.length} to run`);
  updateGroupHeads();
}

async function hydrateCatalog(): Promise<void> {
  const api = window.bootible;
  if (!api?.getCatalog) return;

  try {
    catalog = await api.getCatalog();
  } catch {
    return;
  }
  if (catalog.length === 0) return;

  const total = catalog.reduce((sum, group) => sum + group.moduleCount, 0);
  fill("modules-ready", `${total} modules ready`);
  renderGroups();
  renderReviewPlan();
  updateSetupSummary();
  void hydrateBundles();
  void hydrateState();
}

// ── bundles (the "set it up for me" path) ───────────────────────────────────
let bundles: Bundle[] = [];

/** Fetch the device's bundles and render their cards. */
async function hydrateBundles(): Promise<void> {
  const api = window.bootible;
  if (!api?.getBundles) return;
  try {
    bundles = await api.getBundles();
  } catch {
    return;
  }
  renderBundles();
}

/** Look up each module's summary by id, across all groups. */
function moduleIndex(): Map<string, ModuleSummary> {
  const index = new Map<string, ModuleSummary>();
  for (const group of catalog) for (const module of group.modules) index.set(module.id, module);
  return index;
}

/** Render the bundle cards from the device profile's bundles. */
function renderBundles(): void {
  const list = document.querySelector<HTMLElement>(".bundle-list");
  if (!list || bundles.length === 0) return;
  const index = moduleIndex();
  list.replaceChildren(...bundles.map((bundle) => bundleCard(bundle, index)));
}

function bundleCard(bundle: Bundle, index: Map<string, ModuleSummary>): HTMLElement {
  const card = el("div", "bundle");
  card.dataset.bundle = bundle.id;
  if (bundle.recommended) card.classList.add("is-open");

  const head = el("div", "bundle-head");
  const main = el("span", "bundle-main");
  main.append(
    el("span", "bundle-name", bundle.name),
    el("span", "bundle-desc", bundle.description),
  );
  const meta = el("span", "bundle-meta");
  meta.append(el("span", "group-tag", bundle.tag));
  head.append(main, meta);

  const contents = el("div", "bundle-contents");
  for (const id of bundle.moduleIds) {
    const module = index.get(id);
    if (!module) continue;
    const text = el("span", "bc-text");
    text.append(el("span", "bc-name", module.name), el("span", "bc-desc", module.description));
    const row = el("div", "bc-row");
    row.append(el("span", "bc-dot"), text);
    contents.append(row);
  }

  const actions = el("div", "bundle-actions");
  const use = el("button", "btn-primary", "Use this setup →") as HTMLButtonElement;
  use.type = "button";
  use.dataset.pick = bundle.id;
  const expand = el(
    "button",
    "linkbtn bundle-expand",
    bundle.recommended ? "hide what's inside" : "show what's inside",
  ) as HTMLButtonElement;
  expand.type = "button";
  actions.append(use, expand);

  card.append(head, contents, actions);
  return card;
}

// Pick a bundle → record its modules as the selection and move to the method
// screen. Expand → reveal what's inside.
document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;

  const pick = target.closest<HTMLElement>("[data-pick]");
  if (pick) {
    const bundle = bundles.find((b) => b.id === pick.dataset.pick);
    if (bundle) {
      selectedModules = [...bundle.moduleIds];
      location.hash = "method";
    }
    return;
  }

  const expand = target.closest<HTMLElement>(".bundle-expand");
  if (expand) {
    const open = expand.closest(".bundle")?.classList.toggle("is-open");
    expand.textContent = open ? "hide what's inside" : "show what's inside";
  }
});

/** Annotate the group cards with current on-device state ("✓ set" / "N/M set"). */
async function hydrateState(): Promise<void> {
  const api = window.bootible;
  if (!api?.getState) return;

  let reports: ModuleStateReport[];
  try {
    reports = await api.getState();
  } catch {
    return;
  }
  if (reports.length === 0) return; // off-device: nothing to annotate

  const byGroup = new Map<string, { applied: number; total: number }>();
  for (const report of reports) {
    if (report.state === "unknown") continue; // planned / no probe
    const tally = byGroup.get(report.group) ?? { applied: 0, total: 0 };
    tally.total += 1;
    if (report.state === "applied") tally.applied += 1;
    byGroup.set(report.group, tally);
  }

  for (const head of document.querySelectorAll<HTMLElement>(".group-head")) {
    const group = head.dataset.group;
    const tally = group ? byGroup.get(group) : undefined;
    const slot = head.querySelector(".group-state");
    if (!tally || tally.total === 0 || !slot) continue;
    if (tally.applied === tally.total) {
      slot.textContent = "✓ set";
      head.classList.add("is-applied");
    } else if (tally.applied > 0) {
      slot.textContent = `${tally.applied}/${tally.total} set`;
    }
  }
}

void hydrateCatalog();

// ── method selector (data-driven from the device's provisioning_models) ──────
const METHOD_ICONS: Record<string, string> = {
  usb: "▤",
  export: "▦",
  device: "▣",
  android: "▥",
  guided: "◆",
};

async function hydrateMethods(): Promise<void> {
  const api = window.bootible;
  if (!api?.getMethods) return; // browser: keep the static Ally cards

  let methods: ProvisioningMethod[];
  try {
    methods = await api.getMethods();
  } catch {
    return;
  }
  const list = document.querySelector<HTMLElement>('.view[data-view="method"] .method-list');
  if (!list || methods.length === 0) return;

  list.replaceChildren(
    ...methods.map((method) => {
      const btn = el("button", "method-card") as HTMLButtonElement;
      btn.type = "button";
      btn.dataset.method = method.id;
      // USB needs the account + WiFi steps first; the rest go straight to review.
      btn.dataset.go = method.id === "usb" ? "account" : "review";

      const icon = el("span", "method-icon", METHOD_ICONS[method.id] ?? "▤");
      icon.setAttribute("aria-hidden", "true");

      const main = el("span", "method-main");
      main.append(
        el("span", "method-name", method.label),
        el("span", "method-desc", method.description),
      );

      const meta = el("span", "method-meta");
      const arrow = el("span", "arrow", "→");
      arrow.setAttribute("aria-hidden", "true");
      meta.append(el("span", "group-tag", method.tag), arrow);

      btn.append(icon, main, meta);
      return btn;
    }),
  );
}

void hydrateMethods();

// ── provisioning (dry run) ─────────────────────────────────────────────────
// Entering #provision streams real module step events from the executor into
// the live log. It is a dry run: nothing is written to the device.

const STATE_CLASS: Record<string, string> = {
  running: "is-run",
  applied: "is-done",
  skipped: "is-wait",
  failed: "is-fail",
};
const STATE_LABEL: Record<string, string> = {
  running: "running",
  applied: "done",
  skipped: "skipped",
  failed: "failed",
};

const provisionLines = new Map<string, HTMLElement>();
let provisionDone = 0;
let provisioning = false;

function provisionEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.view[data-view="provision"]');
}

function provisionTotal(): number {
  return catalog.reduce((sum, group) => sum + group.moduleCount, 0) || provisionLines.size || 1;
}

function resetProvision(): void {
  const view = provisionEl();
  if (!view) return;
  provisionLines.clear();
  provisionDone = 0;
  view.querySelector(".log")?.replaceChildren();
  const now = view.querySelector(".provision-now");
  if (now) now.textContent = "Starting dry run…";
  const fill = view.querySelector<HTMLElement>(".progress-fill");
  if (fill) fill.style.width = "0%";
  const meta = view.querySelector(".progress-meta");
  if (meta) meta.textContent = "Dry run — nothing is written to your device.";
}

function onProvisionStep(event: StepEvent): void {
  const view = provisionEl();
  const log = view?.querySelector(".log");
  if (!view || !log) return;

  let line = provisionLines.get(event.moduleId);
  if (!line) {
    line = el("div", "logline");
    line.append(
      el("span", "logmark"),
      el("span", "logname", event.name),
      el("span", "logstate", ""),
    );
    provisionLines.set(event.moduleId, line);
    log.append(line);
  }

  line.classList.remove("is-run", "is-done", "is-wait", "is-fail");
  line.classList.add(STATE_CLASS[event.status] ?? "is-wait");
  const state = line.querySelector(".logstate");
  if (state) state.textContent = STATE_LABEL[event.status] ?? event.status;

  if (event.status === "running") {
    const now = view.querySelector(".provision-now");
    if (now) now.textContent = event.name;
    return;
  }

  provisionDone += 1;
  const total = provisionTotal();
  const fill = view.querySelector<HTMLElement>(".progress-fill");
  if (fill) fill.style.width = `${Math.round((provisionDone / total) * 100)}%`;
  const meta = view.querySelector(".progress-meta");
  if (meta) meta.textContent = `Step ${provisionDone} of ${total} — dry run, nothing is written.`;
}

function onProvisionDone(result: ProvisionResult): void {
  const view = provisionEl();
  const now = view?.querySelector(".provision-now");
  if (now) {
    now.textContent = `Dry run complete — ${result.applied} applied, ${result.skipped} planned.`;
  }
  window.setTimeout(() => {
    if (document.body.dataset.view === "provision") location.hash = "done";
  }, 1200);
}

function startProvision(): void {
  const api = window.bootible;
  if (!api?.provision || provisioning) return; // browser: keep the mock log
  provisioning = true;
  resetProvision();
  api
    .provision()
    .catch(() => {})
    .finally(() => {
      provisioning = false;
    });
}

window.bootible?.onProvisionStep?.(onProvisionStep);
window.bootible?.onProvisionDone?.(onProvisionDone);

// ── method actions ─────────────────────────────────────────────────────────
// The review screen's primary button is method-aware: "export" saves a config
// file; "run on device" (and, for now, "build USB") enters the provision flow.

function receiptRow(key: string, value: string): HTMLElement {
  const row = el("div", "rline");
  row.append(el("span", "mark"), el("span", "rkey", key), el("span", "rval", value));
  return row;
}

// The artifact "View full receipt" / "Open folder" opens (set per flow).
let lastArtifactPath = "";

async function runExport(): Promise<void> {
  const api = window.bootible;
  if (!api?.exportConfig) return;
  const req = gatherUsbRequest();
  const modules = req.modules;
  const result = await api.exportConfig({
    modules,
    baseId: req.baseId,
    sshPublicKeys: req.sshPublicKeys,
  });
  if (!result) return; // cancelled

  lastArtifactPath = result.path;
  fill("done-eyebrow", "Exported");
  fill("done-title", "Config exported");
  fill("done-sub", "Saved to your machine. Re-apply it any time — or build a USB from it.");

  const receipt = document.querySelector<HTMLElement>('.view[data-view="done"] .receipt');
  if (receipt) {
    receipt.replaceChildren(
      receiptRow("device", deviceName),
      receiptRow("modules", `${modules.length} selected`),
      receiptRow("format", "config.yml"),
      receiptRow("saved", result.path),
    );
  }
  location.hash = "done";
}

/** Gather the USB build inputs from the wizard's base, account, SSH + WiFi. */
function gatherUsbRequest(): UsbBuildRequest {
  const val = (sel: string) =>
    document.querySelector<HTMLInputElement | HTMLTextAreaElement>(sel)?.value.trim() ?? "";
  const mode: "local" | "microsoft" =
    document.body.dataset.account === "microsoft" ? "microsoft" : "local";
  const account =
    mode === "local"
      ? { mode, username: val("#acct-user") || "ally", password: val("#acct-pass") || undefined }
      : { mode };
  const ssid = val("#wifi-ssid");
  const wifi = ssid ? { ssid, password: val("#wifi-pass") } : undefined;
  // SSH keys come from BYO (host picker + paste), GitHub (fetched), or both,
  // per the active tab.
  const picked = hostSshKeys.filter((k) => selectedKeyIds.has(k.id)).map((k) => k.publicKey);
  const pasted = val("#ssh-paste");
  const byoKeys = [...picked, ...(pasted ? [pasted] : [])];
  const wantByo = sshMode === "byo" || sshMode === "both";
  const wantGithub = sshMode === "github" || sshMode === "both";
  const sshPublicKeys = [
    ...new Set([...(wantByo ? byoKeys : []), ...(wantGithub ? githubKeys : [])]),
  ];
  const hostname = val("#device-hostname") || undefined;
  const staticIpVal = val("#static-ip");
  const staticIp: StaticIp | undefined = staticIpVal
    ? {
        ip: staticIpVal,
        prefix: netSuggestion?.prefix ?? 24,
        gateway: netSuggestion?.gateway,
        dns: netSuggestion?.gateway,
      }
    : undefined;
  intendedStaticIp = staticIp?.ip ?? "";
  // When a base is chosen it defines the full module set; modifiers (the tinker
  // screen) are an explicit add-on path, not the default all-on toggles.
  // With a base chosen, the customise screen drives the extras (incl. "apps");
  // the floor/base come from baseId minus disabledModules (resolved in main).
  const modules = selectedBaseId ? [...enabledExtras] : selectedModuleIds();
  const checked = (sel: string) => document.querySelector<HTMLInputElement>(sel)?.checked ?? false;
  const edition = checked("#edition-pro") ? "pro" : "home";
  const remoteAccess = {
    sunshine: checked("#ra-sunshine"),
    moonlight: checked("#ra-moonlight"),
    rdp: checked("#ra-rdp"),
  };
  const remoteAccessHost = {
    sunshine: checked("#ra-sunshine-host"),
    moonlight: checked("#ra-moonlight-host"),
  };
  return {
    modules,
    baseId: selectedBaseId || undefined,
    sshPublicKeys: sshPublicKeys.length ? sshPublicKeys : undefined,
    hostname,
    staticIp,
    edition,
    remoteAccess,
    remoteAccessHost,
    sunshineUser: val("#sunshine-user") || undefined,
    sunshinePass: val("#sunshine-pass") || undefined,
    wallpaperPath: wallpaperPath || undefined,
    lockscreenPath: lockscreenPath || undefined,
    disabledModules: disabledModules.size ? [...disabledModules] : undefined,
    selectedApps: selectedApps.size ? [...selectedApps] : undefined,
    selectedRemovals: selectedRemovals.size ? [...selectedRemovals] : undefined,
    account,
    wifi,
  };
}

// ── config profiles: capture / apply the whole UI state ─────────────────────
const fv = (s: string) => document.querySelector<HTMLInputElement>(s)?.value ?? "";
const fck = (s: string) => document.querySelector<HTMLInputElement>(s)?.checked ?? false;
const setV = (s: string, v: unknown) => {
  const e = document.querySelector<HTMLInputElement>(s);
  if (e) e.value = typeof v === "string" ? v : "";
};
const setCk = (s: string, v: unknown) => {
  const e = document.querySelector<HTMLInputElement>(s);
  if (e) e.checked = Boolean(v);
};

/** Snapshot every UI selection into a Profile (passwords go in `secrets`, which
 *  main encrypts with DPAPI). */
function captureProfile(name: string): Profile {
  return {
    name,
    deviceId: selectedDeviceId || undefined,
    baseId: selectedBaseId || undefined,
    ui: {
      selectedApps: [...selectedApps],
      selectedRemovals: [...selectedRemovals],
      enabledExtras: [...enabledExtras],
      disabledModules: [...disabledModules],
      selectedKeyIds: [...selectedKeyIds],
      sshMode,
      githubUser: fv("#github-user"),
      sshPaste: fv("#ssh-paste"),
      hostname: fv("#device-hostname"),
      staticIp: fv("#static-ip"),
      edition: fck("#edition-pro") ? "pro" : "home",
      accountMode: document.body.dataset.account ?? "local",
      acctUser: fv("#acct-user"),
      sunshineUser: fv("#sunshine-user"),
      wifiSsid: fv("#wifi-ssid"),
      ra: { sunshine: fck("#ra-sunshine"), moonlight: fck("#ra-moonlight"), rdp: fck("#ra-rdp") },
      raHost: { sunshine: fck("#ra-sunshine-host"), moonlight: fck("#ra-moonlight-host") },
      wallpaperPath,
      lockscreenPath,
    },
    secrets: {
      sunshinePass: fv("#sunshine-pass"),
      acctPass: fv("#acct-pass"),
      wifiPass: fv("#wifi-pass"),
    },
  };
}

/** Show/hide the Update button for the loaded profile. */
function refreshProfileSaveUI(): void {
  const upd = document.querySelector<HTMLElement>("#sk-update-profile");
  if (!upd) return;
  upd.hidden = !loadedProfileName;
  upd.textContent = loadedProfileName ? `Update "${loadedProfileName}"` : "Update";
}

/** Restore a loaded Profile into the UI (Sets, inputs, checkboxes, derived UI). */
function applyProfile(p: Profile): void {
  loadedProfileName = p.name ?? "";
  setV("#sk-profile-name", loadedProfileName);
  const ui = (p.ui ?? {}) as Record<string, unknown>;
  const list = (k: string) => (Array.isArray(ui[k]) ? (ui[k] as string[]) : []);
  selectedBaseId = p.baseId ?? "";
  const restore = (set: Set<string>, k: string) => {
    set.clear();
    for (const v of list(k)) set.add(v);
  };
  restore(selectedApps, "selectedApps");
  restore(selectedRemovals, "selectedRemovals");
  restore(enabledExtras, "enabledExtras");
  restore(disabledModules, "disabledModules");
  restore(selectedKeyIds, "selectedKeyIds");
  sshMode = (ui.sshMode as typeof sshMode) ?? "byo";
  setV("#github-user", ui.githubUser);
  setV("#ssh-paste", ui.sshPaste);
  setV("#device-hostname", ui.hostname);
  setV("#static-ip", ui.staticIp);
  setCk("#edition-pro", ui.edition === "pro");
  setCk("#edition-home", ui.edition !== "pro");
  setV("#acct-user", ui.acctUser);
  setV("#sunshine-user", ui.sunshineUser);
  setV("#wifi-ssid", ui.wifiSsid);
  const ra = (ui.ra ?? {}) as Record<string, unknown>;
  setCk("#ra-sunshine", ra.sunshine);
  setCk("#ra-moonlight", ra.moonlight);
  setCk("#ra-rdp", ra.rdp);
  const raHost = (ui.raHost ?? {}) as Record<string, unknown>;
  setCk("#ra-sunshine-host", raHost.sunshine);
  setCk("#ra-moonlight-host", raHost.moonlight);
  setV("#sunshine-pass", p.secrets?.sunshinePass);
  setV("#acct-pass", p.secrets?.acctPass);
  setV("#wifi-pass", p.secrets?.wifiPass);
  wallpaperPath = (ui.wallpaperPath as string) ?? "";
  lockscreenPath = (ui.lockscreenPath as string) ?? "";
  // Show the remembered image filenames on the picker buttons (the paths are saved
  // but the labels were blank, so it looked like the images weren't remembered).
  const imgName = (p: string) => (p ? (p.split(/[\\/]/).pop() ?? p) : "");
  const wn = document.querySelector("#wallpaper-name");
  if (wn) wn.textContent = imgName(wallpaperPath);
  const ln = document.querySelector("#lockscreen-name");
  if (ln) ln.textContent = imgName(lockscreenPath);
  document.body.classList.toggle("is-strip", selectedBaseId === "full-rog");
  setSshMode(sshMode); // sync the SSH tab UI
  // Re-fetch GitHub keys so a github/both profile actually has keys baked and
  // shows the matched status (loading the name alone doesn't fetch).
  if ((sshMode === "github" || sshMode === "both") && fv("#github-user")) {
    void refreshGithubKeys();
  }
  customiseHydrated = false; // re-resolve the plan for the restored base
  keepRestoredCustomise = true; // ...but keep the restored extras/disabled modules
}

/** Render saved profiles on the base screen (only this device's, or untagged). */
async function refreshProfileList(): Promise<void> {
  const api = window.bootible;
  const host = document.querySelector<HTMLElement>("#profile-list");
  if (!host || !api?.listProfiles) return;
  let profiles: ProfileSummary[] = [];
  try {
    profiles = await api.listProfiles();
  } catch {}
  const mine = profiles.filter((p) => !p.deviceId || p.deviceId === selectedDeviceId);
  if (mine.length === 0) {
    host.replaceChildren();
    return;
  }
  host.replaceChildren(
    el("p", "profile-head", "…or load a saved profile"),
    ...mine.map((p) => {
      const row = el("div", "profile-row");
      const load = el(
        "button",
        "profile-load",
        `${p.name}${p.baseId ? ` · ${p.baseId}` : ""}`,
      ) as HTMLButtonElement;
      load.type = "button";
      load.dataset.loadProfile = p.name;
      const del = el("button", "profile-del", "✕") as HTMLButtonElement;
      del.type = "button";
      del.dataset.delProfile = p.name;
      del.title = "Delete this profile";
      row.append(load, del);
      return row;
    }),
  );
}

// Load / delete a saved profile (base screen).
document.addEventListener("click", (event) => {
  const t = event.target as HTMLElement;
  const load = t.closest<HTMLElement>("[data-load-profile]");
  if (load?.dataset.loadProfile) {
    const name = load.dataset.loadProfile;
    void (async () => {
      const p = await window.bootible?.loadProfile?.(name);
      if (p) {
        applyProfile(p);
        location.hash = "customise";
      }
    })();
    return;
  }
  const del = t.closest<HTMLElement>("[data-del-profile]");
  if (del?.dataset.delProfile) {
    const name = del.dataset.delProfile;
    void (async () => {
      await window.bootible?.deleteProfile?.(name);
      await refreshProfileList();
    })();
  }
});

// Password reveal toggles (eye icon).
document.addEventListener("click", (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLElement>("[data-reveal]");
  if (!btn?.dataset.reveal) return;
  const input = document.getElementById(btn.dataset.reveal) as HTMLInputElement | null;
  if (input) input.type = input.type === "password" ? "text" : "password";
});

// Save the setup as a profile — Update (the loaded one) or Save as new.
document.addEventListener("click", (event) => {
  const t = event.target as HTMLElement;
  const isUpdate = !!t.closest("#sk-update-profile");
  const isNew = !!t.closest("#sk-save-profile");
  if (!isUpdate && !isNew) return;
  const out = document.querySelector("#sk-profile-status");
  const typed = document.querySelector<HTMLInputElement>("#sk-profile-name")?.value.trim() ?? "";
  const name = isUpdate ? loadedProfileName : typed;
  if (!name) {
    if (out) out.textContent = "Name the profile first, then Save as new.";
    return;
  }
  void (async () => {
    const r = await window.bootible?.saveProfile?.(captureProfile(name));
    if (r?.ok) {
      loadedProfileName = r.name; // now editing this profile → Update targets it
      setV("#sk-profile-name", r.name);
      refreshProfileSaveUI();
      void window.bootible?.cloud?.syncNow(); // push the change if signed in + unlocked
      if (out)
        out.textContent = isUpdate ? `✓ Updated "${r.name}"` : `✓ Saved "${r.name}" to this PC`;
    } else if (out) {
      out.textContent = "Save failed.";
    }
  })();
});

// ── in-app USB writer screen ────────────────────────────────────────────────
const usbState: { isoId: string; isoPath: string; regionId: string; disk: number } = {
  isoId: "",
  isoPath: "",
  regionId: "",
  disk: -1,
};

/** Populate the language + region dropdowns and disk list when the writer opens.
 *  The language option's value is its ISO id, so picking a language sets the
 *  download AND the answer-file UI language from one choice (they can't drift). */
async function hydrateUsbWrite(): Promise<void> {
  const api = window.bootible;
  if (!api?.getLanguages) return;

  const lang = document.querySelector<HTMLSelectElement>("#lang-select");
  if (lang && lang.options.length === 0) {
    let langs: LanguageOption[] = [];
    try {
      langs = await api.getLanguages();
    } catch {}
    lang.replaceChildren(
      ...langs.map((option) => {
        const opt = document.createElement("option");
        opt.value = option.isoId;
        opt.textContent = option.label;
        return opt;
      }),
    );
    if (langs[0]) {
      usbState.isoId = langs[0].isoId;
      usbState.isoPath = "";
    }
  }

  const region = document.querySelector<HTMLSelectElement>("#region-select");
  if (region && region.options.length === 0) {
    let regions: RegionOption[] = [];
    try {
      regions = (await api.getRegions?.()) ?? [];
    } catch {}
    region.replaceChildren(
      ...regions.map((option) => {
        const opt = document.createElement("option");
        opt.value = option.id;
        opt.textContent = option.label;
        return opt;
      }),
    );
    if (regions[0]) usbState.regionId = regions[0].id;
  }

  await refreshDisks();
  updateWriteButton();
}

async function refreshDisks(): Promise<void> {
  const api = window.bootible;
  const list = document.querySelector<HTMLElement>("#disk-list");
  if (!api?.getUsbDisks || !list) return;
  let disks: UsbDisk[] = [];
  try {
    disks = await api.getUsbDisks();
  } catch {}
  if (disks.length === 0) {
    list.replaceChildren(
      el("p", "muted", "No removable USB drives found. Plug one in, then Refresh."),
    );
    return;
  }
  list.replaceChildren(
    ...disks.map((disk) => {
      const btn = el("button", "uw-disk") as HTMLButtonElement;
      btn.type = "button";
      btn.dataset.disk = String(disk.number);
      if (disk.number === usbState.disk) btn.classList.add("is-sel");
      // Match how Explorer names it: "GK-Two (I:)". Fall back to letter, then model.
      const title =
        disk.label && disk.letters
          ? `${disk.label} (${disk.letters})`
          : disk.letters || disk.label || disk.name;
      const detail = [disk.name, `${disk.sizeGb} GB`, `disk ${disk.number}`]
        .filter(Boolean)
        .join(" · ");
      btn.append(el("span", "uw-disk-name", title), el("span", "uw-disk-size", detail));
      return btn;
    }),
  );
}

function updateWriteButton(): void {
  const btn = document.querySelector<HTMLButtonElement>("#usb-write-btn");
  const confirmed = document.querySelector<HTMLInputElement>("#erase-confirm")?.checked ?? false;
  const hasIso = Boolean(usbState.isoId || usbState.isoPath);
  if (btn) btn.disabled = !(confirmed && hasIso && usbState.disk >= 0);
}

async function startUsbWrite(): Promise<void> {
  const api = window.bootible;
  if (!api?.writeUsb) return;
  document.querySelector(".uw-go")?.setAttribute("hidden", "");
  document.querySelector(".uw-progress")?.removeAttribute("hidden");
  // Immediate feedback before the elevated writer emits its first line.
  onUsbProgress({
    pct: 1,
    message: "Preparing — accept the Windows admin (UAC) prompt…",
    status: "running",
  });
  const req = gatherUsbRequest();
  const result = await api.writeUsb({
    ...req,
    diskNumber: usbState.disk,
    isoPath: usbState.isoPath || undefined,
    isoId: usbState.isoId || undefined,
    regionId: usbState.regionId || undefined,
  });
  if (result && !result.started) {
    onUsbProgress({
      pct: 0,
      message: "Couldn't start the write — no device to build for.",
      status: "error",
    });
    return;
  }
  // Set up the host side of streaming in the background, if the user opted in.
  if (req.remoteAccessHost) void maybeInstallHostStreaming(req.remoteAccessHost);
}

function onUsbProgress(event: UsbProgress): void {
  // The Deck writers share the usb:progress channel but have their own progress UI
  // + finish behaviour (onDeckProgress) — don't double-handle them here.
  const dv = document.body.dataset.view;
  if (dv === "deckwrite" || dv === "deckreimage") return;
  const msg = document.querySelector("#uw-msg");
  const fill = document.querySelector<HTMLElement>("#uw-fill");
  const pct = document.querySelector("#uw-pct");
  if (msg) msg.textContent = event.message;
  if (fill) fill.style.width = `${event.pct}%`;
  if (pct) {
    pct.textContent =
      event.status === "error"
        ? "Failed — see the message above."
        : event.status === "done"
          ? "Done — boot the Ally from the stick."
          : `${event.pct}% — keep the app open.`;
  }
  // Once the stick is written, move to watching the network for the device.
  if (event.status === "done") setTimeout(() => (location.hash = "watch"), 1200);
}

window.bootible?.onUsbProgress?.(onUsbProgress);

// ── Steam Deck config + provision-only USB (Path A) ──────────────────────────

const RECOMMENDED_DECKY = ["PowerTools", "ProtonDB Badges", "SteamGridDB"];

/** The Deck choices — the single source of truth (buildDeckBundle normalizes). */
const deckState: DeckConfig = {
  hostname: undefined,
  createSnapshot: true,
  flatpakApps: ["flatseal"],
  ssh: { enabled: false, port: 22, authorizedKeys: [] },
  decky: { enabled: true, plugins: [...RECOMMENDED_DECKY] },
  proton: { ge: true, protonUpQt: true, protontricks: true },
  emudeck: false,
  emulationStorage: "auto",
  sunshine: { enabled: false },
  vnc: false,
  tailscale: false,
  waydroid: false,
  stickdeck: false,
  passwordManagers: { managers: [], method: "flatpak" },
};
let deckDisk = ""; // selected USB drive letter, e.g. "E"

/** A rich toggle row in the ROG `.cz-*` style: name + description + an optional
 *  "what it does" line, bound to a setter on deckState. */
function deckCheck(
  label: string,
  checked: boolean,
  onChange: (v: boolean) => void,
  desc?: string,
  changes?: string,
): HTMLElement {
  const row = el("label", `cz-row${checked ? "" : " is-off"}`);
  const cb = el("input", "cz-check") as HTMLInputElement;
  cb.type = "checkbox";
  cb.checked = checked;
  cb.addEventListener("change", () => {
    row.classList.toggle("is-off", !cb.checked);
    onChange(cb.checked);
    updateDeckSummary();
  });
  const text = el("div", "cz-text");
  text.append(el("div", "cz-name", label));
  if (desc) text.append(el("div", "cz-desc", desc));
  if (changes) text.append(el("div", "cz-chg", changes));
  row.append(cb, text);
  return row;
}

/** A full-width config section: a header (with an optional "· N" count) over a
 *  2-column grid of rows. Picker rows and `.cz-span` fields span both columns. */
function deckSection(title: string, rows: HTMLElement[], count?: number): HTMLElement {
  const sec = el("div", "cz-sec");
  const head = el("div", "cz-sec-h", title);
  if (count !== undefined) head.append(el("span", "cz-sec-count", ` · ${count}`));
  const grid = el("div", "cz-sec-rows");
  grid.append(...rows);
  sec.append(head, grid);
  return sec;
}

/** Count the truthy flags — for a section's "· N" header. */
function countOn(...flags: boolean[]): number {
  return flags.filter(Boolean).length;
}

function updateDeckSummary(): void {
  const n =
    deckState.flatpakApps.length + (deckState.decky.enabled ? deckState.decky.plugins.length : 0);
  const sum = document.querySelector("#deck-summary");
  if (sum) {
    sum.textContent = `${n} item${n === 1 ? "" : "s"} selected — Decky ${deckState.decky.enabled ? "on" : "off"}.`;
  }
}

async function hydrateDeck(): Promise<void> {
  const body = document.querySelector<HTMLElement>("#deck-body");
  if (!body) return;
  body.replaceChildren();

  // Catalog (loaded once) drives which flatpak ids belong to the Emulators picker
  // and the Game-streaming section, so the Apps picker count excludes them — no
  // hardcoded id lists, no drift from the unified catalog.
  const deckApps = (await window.bootible?.getDeckApps?.()) ?? [];
  const EMULATOR_IDS = new Set(deckApps.filter((a) => a.category === "Emulator").map((a) => a.id));
  const streamClients = deckApps.filter((a) => a.category === "Streaming" && a.id !== "sunshine");
  const STREAM_IDS = new Set(streamClients.map((a) => a.id));

  // ── 1. Apps, plugins & managers — the "what gets installed" hub (lead with it).
  // All rows span full width here so the hub reads as one clean vertical stack.
  const deckyToggle = deckCheck(
    "Decky Loader",
    deckState.decky.enabled,
    (v) => {
      deckState.decky.enabled = v;
      void hydrateDeck();
    },
    "The plugin framework for Gaming Mode — adds a plugin menu to the Quick Access panel. PowerTools is the main performance tool.",
    "installs decky-loader",
  );
  deckyToggle.classList.add("cz-span");
  const appCount = deckState.flatpakApps.filter(
    (id) => !EMULATOR_IDS.has(id) && !STREAM_IDS.has(id),
  ).length;
  const emuCount =
    deckState.flatpakApps.filter((id) => EMULATOR_IDS.has(id)).length + (deckState.emudeck ? 1 : 0);
  const installRows: HTMLElement[] = [
    deckPickerRow(
      "Apps",
      "Browsers, comms, media, launchers (Heroic / Lutris / Bottles), streaming & more — grouped by category.",
      appCount,
      "deckapps",
    ),
    deckPickerRow(
      "Emulators",
      "EmuDeck (sets everything up) or standalone RetroArch / Dolphin / PCSX2 / PPSSPP / DuckStation / RetroDeck.",
      emuCount,
      "deckemu",
    ),
    deckyToggle,
  ];
  if (deckState.decky.enabled) {
    installRows.push(
      deckPickerRow(
        "Decky plugins",
        "PowerTools, SteamGridDB, ProtonDB Badges and 100+ more — most-installed first.",
        deckState.decky.plugins.length,
        "deckplugins",
      ),
    );
  }
  installRows.push(
    deckPickerRow(
      "Password managers",
      "1Password, Bitwarden, KeePassXC, Proton Pass — pick any; choose Flatpak or Distrobox.",
      deckState.passwordManagers.managers.length,
      "deckpm",
    ),
  );
  const installCount =
    deckState.flatpakApps.length +
    (deckState.decky.enabled ? deckState.decky.plugins.length : 0) +
    deckState.passwordManagers.managers.length;
  body.append(deckSection("Apps & plugins", installRows, installCount));

  // ── 2. Compatibility (gaming).
  body.append(
    deckSection(
      "Compatibility",
      [
        deckCheck(
          "Proton-GE (latest)",
          deckState.proton.ge,
          (v) => {
            deckState.proton.ge = v;
          },
          "GloriousEggroll's Proton build — better compatibility for many non-Steam and anti-cheat games.",
          "downloads the latest GE into compatibilitytools.d",
        ),
        deckCheck(
          "ProtonUp-Qt",
          deckState.proton.protonUpQt,
          (v) => {
            deckState.proton.protonUpQt = v;
          },
          "A GUI to install + update Proton-GE and other compatibility tools later.",
          "flatpak net.davidotek.pupgui2",
        ),
        deckCheck(
          "protontricks",
          deckState.proton.protontricks,
          (v) => {
            deckState.proton.protontricks = v;
          },
          "Per-game Winetricks for fixing specific titles.",
          "flatpak com.github.Matoking.protontricks",
        ),
      ],
      countOn(deckState.proton.ge, deckState.proton.protonUpQt, deckState.proton.protontricks),
    ),
  );

  // ── 3. Streaming & remote (SSH keys span full width when shown).
  const keys = el("textarea", "uw-select cz-span") as HTMLTextAreaElement;
  keys.id = "deck-ssh-keys";
  keys.placeholder = "Authorized SSH public keys, one per line";
  keys.rows = 3;
  keys.value = deckState.ssh.authorizedKeys.join("\n");
  if (!deckState.ssh.enabled) keys.hidden = true;
  keys.addEventListener("input", () => {
    deckState.ssh.authorizedKeys = keys.value
      .split("\n")
      .map((k) => k.trim())
      .filter(Boolean);
  });
  // Pull a GitHub user's public keys on-device (parity with the ROG flow).
  const ghKeys = el("input", "uw-select cz-span") as HTMLInputElement;
  ghKeys.id = "deck-ssh-github";
  ghKeys.type = "text";
  ghKeys.placeholder = "GitHub username — adds github.com/<user>.keys";
  ghKeys.value = deckState.ssh.githubUser ?? "";
  if (!deckState.ssh.enabled) ghKeys.hidden = true;
  ghKeys.addEventListener("input", () => {
    deckState.ssh.githubUser = ghKeys.value.trim().replace(/[^A-Za-z0-9-]/g, "") || undefined;
  });
  // Sunshine web-UI credentials — pre-set on the Deck (parity with the ROG flow),
  // shown only when Sunshine is enabled.
  const sunshineCreds = el("div", "cz-span deck-field");
  sunshineCreds.id = "deck-sunshine-creds";
  if (!deckState.sunshine.enabled) sunshineCreds.hidden = true;
  sunshineCreds.append(
    el(
      "div",
      "cz-desc",
      "Optional Sunshine login — set it here and it's pre-configured (no typing on the Deck).",
    ),
  );
  const suser = el("input", "uw-select") as HTMLInputElement;
  suser.type = "text";
  suser.placeholder = "Sunshine username";
  suser.value = deckState.sunshine.user ?? "";
  suser.addEventListener("input", () => {
    deckState.sunshine.user = suser.value.trim() || undefined;
  });
  const spass = el("input", "uw-select") as HTMLInputElement;
  spass.type = "password";
  spass.placeholder = "Sunshine password";
  spass.value = deckState.sunshine.pass ?? "";
  spass.addEventListener("input", () => {
    deckState.sunshine.pass = spass.value || undefined;
  });
  sunshineCreds.append(suser, spass);
  // Game-streaming clients (catalog Streaming category, minus the Sunshine host
  // which has its own toggle + creds) live here on the main page rather than being
  // duplicated in the Apps picker. streamClients was derived up top from deckApps.
  const clientRows = streamClients.map((c) =>
    deckCheck(
      c.name,
      deckState.flatpakApps.includes(c.id),
      (v) => {
        const set = new Set(deckState.flatpakApps);
        if (v) set.add(c.id);
        else set.delete(c.id);
        deckState.flatpakApps = [...set];
      },
      c.note ?? "Game-streaming client.",
      `installs ${c.ref}`,
    ),
  );
  body.append(
    deckSection(
      "Game streaming",
      [
        deckCheck(
          "Sunshine (host)",
          deckState.sunshine.enabled,
          (v) => {
            deckState.sunshine.enabled = v;
            document.querySelector("#deck-sunshine-creds")?.toggleAttribute("hidden", !v);
          },
          "Stream games FROM this Deck to a Moonlight client on another screen.",
          "installs dev.lizardbyte.app.Sunshine",
        ),
        sunshineCreds,
        ...clientRows,
      ],
      countOn(deckState.sunshine.enabled) +
        streamClients.filter((c) => deckState.flatpakApps.includes(c.id)).length,
    ),
  );
  body.append(
    deckSection(
      "Remote access",
      [
        deckCheck(
          "VNC remote desktop",
          deckState.vnc,
          (v) => {
            deckState.vnc = v;
          },
          "Remote access to the Deck's KDE desktop from another machine.",
          "enables a VNC server",
        ),
        deckCheck(
          "Tailscale",
          deckState.tailscale,
          (v) => {
            deckState.tailscale = v;
          },
          "Zero-config mesh VPN — reach the Deck securely from anywhere.",
          "installs tailscaled (run 'tailscale up' to log in)",
        ),
        deckCheck(
          "SSH server",
          deckState.ssh.enabled,
          (v) => {
            deckState.ssh.enabled = v;
            document.querySelector("#deck-ssh-keys")?.toggleAttribute("hidden", !v);
            document.querySelector("#deck-ssh-github")?.toggleAttribute("hidden", !v);
          },
          "Remote shell + file access. Paste keys or pull them from GitHub for key-only login.",
          "enables sshd",
        ),
        keys,
        ghKeys,
      ],
      countOn(deckState.vnc, deckState.tailscale, deckState.ssh.enabled),
    ),
  );

  // ── 3b. Network (optional fixed IP for Wi-Fi or Ethernet).
  const mkText = (
    placeholder: string,
    value: string,
    onInput: (v: string) => void,
    type = "text",
  ): HTMLInputElement => {
    const i = el("input", "uw-select") as HTMLInputElement;
    i.type = type;
    i.placeholder = placeholder;
    i.value = value;
    i.addEventListener("input", () => onInput(i.value));
    return i;
  };
  const netFields = el("div", "cz-span deck-field");
  netFields.id = "deck-net-fields";
  if (!deckState.staticIp) netFields.hidden = true;
  const ifaceSel = el("select", "uw-select") as HTMLSelectElement;
  for (const [v, l] of [
    ["wifi", "Wi-Fi"],
    ["ethernet", "Ethernet"],
  ] as const) {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = l;
    if (deckState.staticIp?.iface === v) o.selected = true;
    ifaceSel.append(o);
  }
  ifaceSel.addEventListener("change", () => {
    if (deckState.staticIp) deckState.staticIp.iface = ifaceSel.value as "wifi" | "ethernet";
  });
  netFields.append(
    ifaceSel,
    mkText("IP address — e.g. 192.168.1.50", deckState.staticIp?.ip ?? "", (v) => {
      if (deckState.staticIp) deckState.staticIp.ip = v.trim();
    }),
    mkText(
      "Prefix (1–32) — 24 for a /24 network",
      deckState.staticIp ? String(deckState.staticIp.prefix) : "24",
      (v) => {
        if (deckState.staticIp) deckState.staticIp.prefix = Number(v) || 24;
      },
      "number",
    ),
    mkText("Gateway (optional) — e.g. 192.168.1.1", deckState.staticIp?.gateway ?? "", (v) => {
      if (deckState.staticIp) deckState.staticIp.gateway = v.trim() || undefined;
    }),
    mkText("DNS (optional) — e.g. 1.1.1.1,8.8.8.8", deckState.staticIp?.dns ?? "", (v) => {
      if (deckState.staticIp) deckState.staticIp.dns = v.trim() || undefined;
    }),
  );
  body.append(
    deckSection(
      "Network",
      [
        deckCheck(
          "Static IP",
          Boolean(deckState.staticIp),
          (v) => {
            deckState.staticIp = v ? { iface: "wifi", ip: "", prefix: 24 } : undefined;
            void hydrateDeck();
          },
          "Pin a fixed address on Wi-Fi or Ethernet so the Deck is always reachable at the same IP.",
          "sets ipv4 via NetworkManager",
        ),
        netFields,
      ],
      deckState.staticIp ? 1 : 0,
    ),
  );

  // ── 4. Extras.
  body.append(
    deckSection(
      "Extras",
      [
        deckCheck(
          "Waydroid",
          deckState.waydroid,
          (v) => {
            deckState.waydroid = v;
          },
          "Run Android apps on the Deck. The installer is interactive — finish it on-device.",
          "stages the Waydroid installer",
        ),
        deckCheck(
          "StickDeck",
          deckState.stickdeck,
          (v) => {
            deckState.stickdeck = v;
          },
          "Use the Deck as a wireless gamepad for your PC.",
          "installs StickDeck (latest release)",
        ),
      ],
      countOn(deckState.waydroid, deckState.stickdeck),
    ),
  );

  // ── 5. System (advanced — snapshot + hostname).
  const hostField = el("div", "cz-span deck-field");
  hostField.append(
    el("div", "cz-name", "Hostname (optional)"),
    el(
      "div",
      "cz-desc",
      "The device's network name + SSH alias. Leave blank to keep the default (steamdeck); set one to tell devices apart, e.g. deck-living-room.",
    ),
  );
  const host = el("input", "uw-select") as HTMLInputElement;
  host.type = "text";
  host.placeholder = "steamdeck";
  host.value = deckState.hostname ?? "";
  host.addEventListener("input", () => {
    deckState.hostname = host.value.trim() || undefined;
  });
  hostField.append(host);
  body.append(
    deckSection(
      "System",
      [
        deckCheck(
          "Btrfs snapshot before changes",
          deckState.createSnapshot,
          (v) => {
            deckState.createSnapshot = v;
          },
          "A safe rollback point — undo everything if a tweak misbehaves.",
          "btrfs snapshot of / before any change",
        ),
        hostField,
      ],
      countOn(deckState.createSnapshot),
    ),
  );

  updateDeckSummary();
}

/** A picker row (ROG style): name + description + a "Choose … (N) →" button that
 *  navigates to a dedicated picker screen. */
function deckPickerRow(label: string, desc: string, count: number, target: string): HTMLElement {
  const row = el("div", "cz-row cz-picker");
  const text = el("div", "cz-text");
  text.append(el("div", "cz-name", label), el("div", "cz-desc", desc));
  const pick = el(
    "button",
    "cz-applink",
    `Choose ${label.toLowerCase()} (${count}) →`,
  ) as HTMLButtonElement;
  pick.type = "button";
  pick.dataset.go = target;
  text.append(pick);
  row.append(text);
  return row;
}

/** Update a picker screen's "N selected" eyebrow. */
function setDeckPickCount(view: string, n: number, word: string): void {
  const tag = document.querySelector(`#${view}-count`);
  if (tag) tag.textContent = `${n} ${word}${n === 1 ? "" : "s"} selected`;
}

/** 1234567 → "1.2M", 34000 → "34K", 999 → "999". */
function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/** A simple app-row (checkbox + name + meta), the ROG picker-item style. */
function deckItemRow(
  name: string,
  meta: string,
  checked: boolean,
  onChange: (v: boolean) => void,
): HTMLElement {
  const row = el("label", "app-row");
  const cb = el("input", "app-check") as HTMLInputElement;
  cb.type = "checkbox";
  cb.checked = checked;
  cb.addEventListener("change", () => onChange(cb.checked));
  const m = el("span", "app-meta");
  m.append(el("span", "app-name", name));
  if (meta) m.append(el("span", "app-id", meta));
  row.append(cb, m);
  return row;
}

// ── Apps picker screen (collapsible category groups, like ROG) ──
async function hydrateDeckApps(): Promise<void> {
  const box = document.querySelector<HTMLElement>("#deckapps-body");
  if (!box) return;
  box.replaceChildren(el("p", "muted", "Loading apps…"));
  let apps: FlatpakApp[] = [];
  try {
    apps = (await window.bootible?.getDeckApps?.()) ?? [];
  } catch {
    box.replaceChildren(el("p", "muted", "Couldn't load the app list."));
    return;
  }
  // Emulators (deckemu picker) and streaming (Game streaming section on the main
  // page) each have their own home — keep them out of the general Apps picker.
  renderDeckApps(
    box,
    apps.filter((a) => a.category !== "Emulator" && a.category !== "Streaming"),
  );
  setDeckPickCount("deckapps", deckState.flatpakApps.length, "app");
}

// ── Emulators picker screen (EmuDeck manager + standalone emulators) ──
async function hydrateDeckEmulators(): Promise<void> {
  const box = document.querySelector<HTMLElement>("#deckemu-body");
  if (!box) return;
  box.replaceChildren(el("p", "muted", "Loading emulators…"));
  let apps: FlatpakApp[] = [];
  try {
    apps = (await window.bootible?.getDeckApps?.()) ?? [];
  } catch {
    box.replaceChildren(el("p", "muted", "Couldn't load the emulator list."));
    return;
  }
  const emus = apps.filter((a) => a.category === "Emulator");
  const update = (): void =>
    setDeckPickCount(
      "deckemu",
      emus.filter((a) => deckState.flatpakApps.includes(a.id)).length + (deckState.emudeck ? 1 : 0),
      "emulator",
    );
  const emudeck = deckCheck(
    "EmuDeck",
    deckState.emudeck,
    (v) => {
      deckState.emudeck = v;
      update();
    },
    "Sets up emulators + the Emulation folder tree for you. The wizard finishes on-device.",
    "stages EmuDeck; run its wizard once",
  );
  emudeck.classList.add("cz-span");
  const rows = emus.map((a) =>
    deckItemRow(a.name, "", deckState.flatpakApps.includes(a.id), (v) => {
      const set = new Set(deckState.flatpakApps);
      if (v) set.add(a.id);
      else set.delete(a.id);
      deckState.flatpakApps = [...set];
      update();
    }),
  );
  box.replaceChildren(emudeck, ...rows);
  update();
}

function renderDeckApps(box: HTMLElement, apps: FlatpakApp[]): void {
  const byCat = new Map<string, FlatpakApp[]>();
  for (const app of apps) {
    const l = byCat.get(app.category);
    if (l) l.push(app);
    else byCat.set(app.category, [app]);
  }
  const groups = [...byCat].map(([cat, list]) => {
    const details = el("details", "app-group") as HTMLDetailsElement;
    const countEl = el("span", "app-group-count", "");
    const gcb = el("input", "app-group-check") as HTMLInputElement;
    gcb.type = "checkbox";
    const items = el("div", "app-items");
    const refreshHead = (): void => {
      const n = list.filter((a) => deckState.flatpakApps.includes(a.id)).length;
      gcb.checked = n === list.length;
      gcb.indeterminate = n > 0 && n < list.length;
      countEl.textContent = `${n} / ${list.length}`;
      countEl.classList.toggle("on", n > 0);
      setDeckPickCount("deckapps", deckState.flatpakApps.length, "app");
    };
    for (const a of list) {
      items.append(
        deckItemRow(a.name, "", deckState.flatpakApps.includes(a.id), (v) => {
          const set = new Set(deckState.flatpakApps);
          if (v) set.add(a.id);
          else set.delete(a.id);
          deckState.flatpakApps = [...set];
          refreshHead();
        }),
      );
    }
    gcb.addEventListener("change", () => {
      const set = new Set(deckState.flatpakApps);
      for (const a of list) {
        if (gcb.checked) set.add(a.id);
        else set.delete(a.id);
      }
      deckState.flatpakApps = [...set];
      for (const r of items.querySelectorAll<HTMLInputElement>(".app-check"))
        r.checked = gcb.checked;
      refreshHead();
    });
    const summary = el("summary", "app-group-sum");
    summary.append(gcb, el("span", "app-group-name", cat), countEl);
    details.append(summary, items);
    refreshHead();
    return details;
  });
  box.replaceChildren(...groups);
}

// ── Decky plugins picker screen (flat list, most-installed first) ──
async function hydrateDeckPlugins(): Promise<void> {
  const box = document.querySelector<HTMLElement>("#deckplugins-body");
  if (!box) return;
  box.replaceChildren(el("p", "muted", "Loading the plugin store…"));
  let list: DeckyStorePlugin[] = [];
  try {
    list = (await window.bootible?.getDeckyPlugins?.()) ?? [];
  } catch {
    box.replaceChildren(
      el("p", "muted", "Couldn't reach the Decky store — defaults will be used."),
    );
    return;
  }
  renderDeckPlugins(box, list);
  setDeckPickCount("deckplugins", deckState.decky.plugins.length, "plugin");
}

function renderDeckPlugins(box: HTMLElement, list: DeckyStorePlugin[]): void {
  if (list.length === 0) {
    box.replaceChildren(el("p", "muted", "No plugins returned — the defaults will be used."));
    return;
  }
  // The list is long, so offer a live filter over name / description / tags / author.
  const search = el("input", "deck-search") as HTMLInputElement;
  search.type = "search";
  search.placeholder = `Search ${list.length} plugins…`;
  const listEl = el("div", "plugin-list");
  // fetchDeckyPlugins returns them sorted by downloads (most-installed first).
  const cards: { el: HTMLElement; hay: string }[] = list.map((p) => {
    const card = el("div", "plugin-card");
    const row = el("label", "app-row");
    const cb = el("input", "app-check") as HTMLInputElement;
    cb.type = "checkbox";
    cb.checked = deckState.decky.plugins.includes(p.name);
    cb.addEventListener("change", () => {
      const set = new Set(deckState.decky.plugins);
      if (cb.checked) set.add(p.name);
      else set.delete(p.name);
      deckState.decky.plugins = [...set];
      setDeckPickCount("deckplugins", deckState.decky.plugins.length, "plugin");
    });
    const meta = el("span", "app-meta");
    meta.append(el("span", "app-name", p.name));
    meta.append(
      el("span", "app-id", `${formatDownloads(p.downloads)} installs · ${p.author || "unknown"}`),
    );
    row.append(cb, meta);
    // "Details" expands the full store info (no public per-plugin page exists, so
    // we show what the store API already returns — description, tags, version, icon).
    const info = el("button", "plugin-info-btn") as HTMLButtonElement;
    info.type = "button";
    info.textContent = "Details";
    info.setAttribute("aria-expanded", "false");
    const detail = el("div", "plugin-detail");
    detail.hidden = true;
    if (p.imageUrl) {
      const img = el("img", "plugin-img") as HTMLImageElement;
      img.src = p.imageUrl;
      img.alt = "";
      img.loading = "lazy";
      detail.append(img);
    }
    detail.append(el("p", "plugin-desc", p.description || "No description provided."));
    if (p.tags.length) {
      const tags = el("div", "plugin-tags");
      for (const t of p.tags) tags.append(el("span", "plugin-tag", t));
      detail.append(tags);
    }
    if (p.version) detail.append(el("p", "plugin-ver", `v${p.version}`));
    info.addEventListener("click", () => {
      const open = detail.hidden;
      detail.hidden = !open;
      info.setAttribute("aria-expanded", String(open));
      info.textContent = open ? "Hide" : "Details";
    });
    const head = el("div", "plugin-head");
    head.append(row, info);
    card.append(head, detail);
    listEl.append(card);
    return {
      el: card,
      hay: `${p.name} ${p.description} ${p.tags.join(" ")} ${p.author}`.toLowerCase(),
    };
  });
  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    for (const c of cards) c.el.hidden = q !== "" && !c.hay.includes(q);
  });
  box.replaceChildren(search, listEl);
}

// ── Password managers picker screen ──
async function hydrateDeckPm(): Promise<void> {
  const box = document.querySelector<HTMLElement>("#deckpm-body");
  if (!box) return;
  box.replaceChildren(el("p", "muted", "Loading…"));
  let list: PasswordManager[] = [];
  try {
    list = (await window.bootible?.getDeckPasswordManagers?.()) ?? [];
  } catch {
    box.replaceChildren(el("p", "muted", "Couldn't load password managers."));
    return;
  }
  renderDeckPasswordManagers(box, list);
  setDeckPickCount("deckpm", deckState.passwordManagers.managers.length, "manager");
}

function renderDeckPasswordManagers(box: HTMLElement, list: PasswordManager[]): void {
  const rows = list.map((pm) =>
    deckItemRow(pm.name, "", deckState.passwordManagers.managers.includes(pm.id), (v) => {
      const set = new Set(deckState.passwordManagers.managers);
      if (v) set.add(pm.id);
      else set.delete(pm.id);
      deckState.passwordManagers.managers = [...set];
      setDeckPickCount("deckpm", deckState.passwordManagers.managers.length, "manager");
    }),
  );
  const methodWrap = el("div", "cz-sec");
  methodWrap.append(el("div", "cz-sec-h", "Install method"));
  const method = el("select", "uw-select") as HTMLSelectElement;
  for (const [value, label] of [
    ["flatpak", "Flatpak (simpler)"],
    ["distrobox", "Distrobox (system auth + SSH agent)"],
  ] as const) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    method.append(opt);
  }
  method.value = deckState.passwordManagers.method;
  method.addEventListener("change", () => {
    deckState.passwordManagers.method = method.value === "distrobox" ? "distrobox" : "flatpak";
  });
  methodWrap.append(method);
  box.replaceChildren(...rows, methodWrap);
}

async function hydrateDeckWrite(): Promise<void> {
  await refreshDeckDisks();
  updateDeckWriteButton();
}

async function refreshDeckDisks(): Promise<void> {
  const api = window.bootible;
  const list = document.querySelector<HTMLElement>("#deck-disk-list");
  if (!api?.getUsbDisks || !list) return;
  let disks: UsbDisk[] = [];
  try {
    disks = await api.getUsbDisks();
  } catch {}
  if (disks.length === 0) {
    list.replaceChildren(
      el("p", "muted", "No removable USB drives found. Plug one in, then Refresh."),
    );
    return;
  }
  list.replaceChildren(
    ...disks.map((disk) => {
      const letter = (disk.letters.match(/[A-Za-z](?=:)/)?.[0] ?? "").toUpperCase();
      const btn = el("button", "uw-disk deck-disk") as HTMLButtonElement;
      btn.type = "button";
      btn.dataset.letter = letter;
      btn.disabled = !letter;
      if (letter && letter === deckDisk) btn.classList.add("is-sel");
      const title =
        disk.label && disk.letters ? `${disk.label} (${disk.letters})` : disk.letters || disk.name;
      const detail = [
        disk.name,
        `${disk.sizeGb} GB`,
        letter ? "" : "no drive letter — format it in Explorer first",
      ]
        .filter(Boolean)
        .join(" · ");
      btn.append(el("span", "uw-disk-name", title), el("span", "uw-disk-size", detail));
      return btn;
    }),
  );
}

function updateDeckWriteButton(): void {
  const btn = document.querySelector<HTMLButtonElement>("#deck-write-btn");
  const confirmed =
    document.querySelector<HTMLInputElement>("#deck-erase-confirm")?.checked ?? false;
  if (btn) btn.disabled = !(confirmed && deckDisk);
}

async function startDeckWrite(): Promise<void> {
  const api = window.bootible;
  if (!api?.writeDeckProvisionUsb || !deckDisk) return;
  document.querySelector('[data-view="deckwrite"] .uw-go')?.setAttribute("hidden", "");
  document.querySelector("#deck-progress")?.removeAttribute("hidden");
  onDeckProgress({
    pct: 1,
    message: "Formatting — accept the admin (UAC) prompt…",
    status: "running",
  });
  const result = await api.writeDeckProvisionUsb({ driveLetter: deckDisk, config: deckState });
  if (result && !result.started) {
    onDeckProgress({ pct: 0, message: "Couldn't start the write.", status: "error" });
  }
}

// Both Deck writers (provision-only + reimage) stream on usb:progress; route to
// whichever screen is active by its element prefix.
function onDeckProgress(event: UsbProgress): void {
  const view = document.body.dataset.view;
  const pfx = view === "deckreimage" ? "deckre" : view === "deckwrite" ? "deck" : null;
  if (!pfx) return;
  const msg = document.querySelector(`#${pfx}-msg`);
  const fill = document.querySelector<HTMLElement>(`#${pfx}-fill`);
  const pct = document.querySelector(`#${pfx}-pct`);
  if (msg) msg.textContent = event.message;
  if (fill) fill.style.width = `${event.pct}%`;
  if (pct) {
    const doneText =
      pfx === "deckre"
        ? "Done — boot the Deck from this USB and choose Reimage."
        : "Done — eject it and run bootible/provision.sh on your Deck.";
    pct.textContent =
      event.status === "error"
        ? "Failed — see the message above."
        : event.status === "done"
          ? doneText
          : `${event.pct}% — keep the app open.`;
  }
}

window.bootible?.onUsbProgress?.(onDeckProgress);

document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (target.closest("#deck-disk-refresh")) {
    void refreshDeckDisks();
    return;
  }
  const disk = target.closest<HTMLElement>(".deck-disk");
  if (disk) {
    deckDisk = disk.dataset.letter ?? "";
    for (const d of document.querySelectorAll(".deck-disk"))
      d.classList.toggle("is-sel", d === disk);
    updateDeckWriteButton();
    return;
  }
  if (target.closest("#deck-write-btn")) void startDeckWrite();
});

document.addEventListener("change", (event) => {
  if ((event.target as HTMLElement).id === "deck-erase-confirm") updateDeckWriteButton();
});

// ── Deck full reimage (Path B) ───────────────────────────────────────────────
let deckReDisk = -1; // selected USB disk NUMBER (flash needs the whole disk)

async function hydrateDeckReimage(): Promise<void> {
  const imgEl = document.querySelector("#deckre-image");
  if (imgEl) imgEl.textContent = "Finding the latest image…";
  void window.bootible?.resolveDeckImage?.().then((r) => {
    if (imgEl) {
      imgEl.textContent = r ? r.name : "Couldn't reach the image server — check your connection.";
    }
  });
  await refreshDeckReimageDisks();
  updateDeckReimageButton();
}

async function refreshDeckReimageDisks(): Promise<void> {
  const api = window.bootible;
  const list = document.querySelector<HTMLElement>("#deckre-disk-list");
  if (!api?.getUsbDisks || !list) return;
  let disks: UsbDisk[] = [];
  try {
    disks = await api.getUsbDisks();
  } catch {}
  if (disks.length === 0) {
    list.replaceChildren(
      el("p", "muted", "No removable USB drives found. Plug one in, then Refresh."),
    );
    return;
  }
  list.replaceChildren(
    ...disks.map((disk) => {
      const btn = el("button", "uw-disk deckre-disk") as HTMLButtonElement;
      btn.type = "button";
      btn.dataset.number = String(disk.number);
      if (disk.number === deckReDisk) btn.classList.add("is-sel");
      const title =
        disk.label && disk.letters ? `${disk.label} (${disk.letters})` : disk.letters || disk.name;
      const detail = [disk.name, `${disk.sizeGb} GB`, `disk ${disk.number}`]
        .filter(Boolean)
        .join(" · ");
      btn.append(el("span", "uw-disk-name", title), el("span", "uw-disk-size", detail));
      return btn;
    }),
  );
}

function updateDeckReimageButton(): void {
  const btn = document.querySelector<HTMLButtonElement>("#deckre-write-btn");
  const confirmed =
    document.querySelector<HTMLInputElement>("#deckre-erase-confirm")?.checked ?? false;
  if (btn) btn.disabled = !(confirmed && deckReDisk >= 0);
}

async function startDeckReimage(): Promise<void> {
  const api = window.bootible;
  if (!api?.writeDeckReimageUsb || deckReDisk < 0) return;
  document.querySelector('[data-view="deckreimage"] .uw-go')?.setAttribute("hidden", "");
  document.querySelector("#deckre-progress")?.removeAttribute("hidden");
  onDeckProgress({
    pct: 1,
    message: "Starting — accept the admin (UAC) prompt…",
    status: "running",
  });
  const result = await api.writeDeckReimageUsb({ diskNumber: deckReDisk, config: deckState });
  if (result && !result.started) {
    onDeckProgress({ pct: 0, message: "Couldn't start the write.", status: "error" });
  }
}

document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (target.closest("#deckre-disk-refresh")) {
    void refreshDeckReimageDisks();
    return;
  }
  const disk = target.closest<HTMLElement>(".deckre-disk");
  if (disk) {
    deckReDisk = Number(disk.dataset.number);
    for (const d of document.querySelectorAll(".deckre-disk"))
      d.classList.toggle("is-sel", d === disk);
    updateDeckReimageButton();
    return;
  }
  if (target.closest("#deckre-write-btn")) void startDeckReimage();
});

document.addEventListener("change", (event) => {
  if ((event.target as HTMLElement).id === "deckre-erase-confirm") updateDeckReimageButton();
});

// ── device discovery (watch screen) ─────────────────────────────────────────
const discovered = new Map<string, DiscoveredDevice>();
// Verify results survive the 5s beacon re-renders, keyed by device IP.
const verifyResults = new Map<string, { reachable: boolean; output: string; alias?: string }>();

/** Render the discovered devices, the build we just made first. */
function renderDiscovered(): void {
  const list = document.querySelector<HTMLElement>(".watch-list");
  if (!list) return;
  const devices = [...discovered.values()].sort((a, b) => Number(b.mine) - Number(a.mine));
  if (devices.length === 0) {
    list.replaceChildren(
      el(
        "p",
        "muted",
        "Listening on the network — boot your device from the USB and it'll appear here.",
      ),
    );
    return;
  }
  list.replaceChildren(
    ...devices.map((d) => {
      const card = el("div", `watch-card${d.mine ? " is-mine" : ""}`);
      const head = el("div", "watch-head");
      head.append(
        el("span", "watch-name", d.hostname || d.mac || "device"),
        el("span", `watch-status status-${d.status}`, d.status),
      );
      const detail = [d.ip, d.mine ? "this is your build" : ""].filter(Boolean).join(" · ");
      card.append(head, el("div", "watch-meta muted", detail));

      // Static-IP reconciliation: the beacon's actual IP vs what we asked for.
      if (d.mine && intendedStaticIp) {
        const ok = d.ip === intendedStaticIp;
        card.append(
          el(
            "div",
            `watch-reconcile ${ok ? "ok" : "warn"}`,
            ok
              ? `✓ static IP ${intendedStaticIp} applied`
              : `⚠ wanted ${intendedStaticIp} but it's on ${d.ip} (static IP didn't take — still reachable here)`,
          ),
        );
      }

      const verify = el("button", "btn-ghost watch-verify", "Verify over SSH") as HTMLButtonElement;
      verify.type = "button";
      verify.dataset.verifyIp = d.ip;
      verify.dataset.verifyUser = d.username || ""; // SSH as the device's own account
      card.append(verify);

      const result = verifyResults.get(d.ip);
      if (result) {
        if (result.reachable && result.alias) {
          card.append(el("div", "watch-alias", `✓ verified — now just \`ssh ${result.alias}\``));
        }
        card.append(
          el(
            "pre",
            `watch-result ${result.reachable ? "ok" : "fail"}`,
            result.reachable ? result.output : `Couldn't reach it: ${result.output}`,
          ),
        );
      }
      return card;
    }),
  );
}

window.bootible?.onBeaconDevice?.((d) => {
  discovered.set(d.buildId || d.mac, d);
  renderDiscovered();
});

/** If the user opted to also set up streaming on this PC, do it (winget) and
 *  show the result on the watch screen. Driven by the account-screen choices. */
async function maybeInstallHostStreaming(which: {
  sunshine?: boolean;
  moonlight?: boolean;
}): Promise<void> {
  if (!which.sunshine && !which.moonlight) return;
  const out = document.querySelector<HTMLElement>(".host-streaming-result");
  if (out) {
    out.textContent = "Setting up streaming on this PC…";
    out.hidden = false;
  }
  const result = (await window.bootible?.installHostStreaming?.(which)) ?? {
    ok: false,
    output: "no bridge",
  };
  if (out) out.textContent = result.output;
}

// Pick a wallpaper / lock-screen image from this PC.
document.addEventListener("click", (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLButtonElement>(
    "#pick-wallpaper, #pick-lockscreen",
  );
  if (!btn) return;
  const isWall = btn.id === "pick-wallpaper";
  void (async () => {
    const path = await window.bootible?.browseImage?.();
    if (!path) return;
    const name = path.split(/[\\/]/).pop() ?? path;
    if (isWall) wallpaperPath = path;
    else lockscreenPath = path;
    const label = document.querySelector(isWall ? "#wallpaper-name" : "#lockscreen-name");
    if (label) label.textContent = name;
  })();
});

// Verify a discovered device over SSH (key auth, no prompts).
document.addEventListener("click", (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLButtonElement>(".watch-verify");
  if (!btn) return;
  const ip = btn.dataset.verifyIp ?? "";
  if (!ip) return;
  const user = btn.dataset.verifyUser || undefined; // the beacon-reported account
  btn.textContent = "Checking…";
  btn.disabled = true;
  void (async () => {
    const result = (await window.bootible?.verifyDevice?.(ip, user)) ?? {
      reachable: false,
      output: "no bridge",
    };
    verifyResults.set(ip, result);
    renderDiscovered();
  })();
});

// Writer-screen interactions (ISO source, disk pick, confirm, write).
document.addEventListener("change", (event) => {
  const target = event.target as HTMLElement;
  if (target.id === "lang-select") {
    usbState.isoId = (target as HTMLSelectElement).value;
    usbState.isoPath = "";
    const path = document.querySelector("#iso-path");
    if (path) path.textContent = "";
  }
  if (target.id === "region-select") {
    usbState.regionId = (target as HTMLSelectElement).value;
  }
  if (target instanceof HTMLInputElement && target.dataset.keyId) {
    if (target.checked) selectedKeyIds.add(target.dataset.keyId);
    else selectedKeyIds.delete(target.dataset.keyId);
  }
  if (target.id === "edition-home" || target.id === "edition-pro") updateEditionState();
  // Reveal the "also on this PC" host option (and Sunshine login fields) when a
  // streaming app is ticked.
  if (target.id === "ra-sunshine" || target.id === "ra-moonlight") {
    const app = target.id === "ra-sunshine" ? "sunshine" : "moonlight";
    const on = (target as HTMLInputElement).checked;
    document.querySelector(`.ra-host[data-host="${app}"]`)?.toggleAttribute("hidden", !on);
    if (app === "sunshine") {
      document.querySelector('.ra-creds[data-host="sunshine"]')?.toggleAttribute("hidden", !on);
    }
  }
  if (target.id === "lang-select" || target.id === "erase-confirm") updateWriteButton();
  // Customise screen: a module toggle (floor/base = untick to disable; extra = tick to add).
  if (target instanceof HTMLInputElement && target.dataset.moduleId) {
    const id = target.dataset.moduleId;
    if (target.dataset.kind === "extra") {
      if (target.checked) enabledExtras.add(id);
      else enabledExtras.delete(id);
    } else if (target.checked) {
      disabledModules.delete(id);
    } else {
      disabledModules.add(id);
    }
    renderCustomise();
  }
  // Removals checklist (Full ROG): opt-in app removals — off until ticked.
  if (target instanceof HTMLInputElement && target.dataset.removal) {
    if (target.checked) selectedRemovals.add(target.dataset.removal);
    else selectedRemovals.delete(target.dataset.removal);
    renderCustomise();
  }
  // App-picker: a single app, or a whole group.
  // A single app pick (winget) or a module-driven entry (e.g. EmuDeck).
  if (target instanceof HTMLInputElement && target.dataset.app) {
    if (target.checked) selectedApps.add(target.dataset.app);
    else selectedApps.delete(target.dataset.app);
    renderApps();
  }
  if (target instanceof HTMLInputElement && target.dataset.module) {
    if (target.checked) enabledExtras.add(target.dataset.module);
    else enabledExtras.delete(target.dataset.module);
    renderApps();
  }
  // Whole-group tick: select/clear every entry (winget -> selectedApps, module
  // entries -> enabledExtras).
  if (target instanceof HTMLInputElement && target.dataset.group) {
    const g = appGroups.find((x) => x.id === target.dataset.group);
    if (g) {
      for (const a of g.apps) {
        const set = a.module ? enabledExtras : selectedApps;
        const key = a.module ?? a.id;
        if (target.checked) set.add(key);
        else set.delete(key);
      }
    }
    renderApps();
  }
});

// Stop the group checkbox (inside <summary>) from also collapsing the group.
document.addEventListener("click", (event) => {
  if ((event.target as HTMLElement).classList?.contains("app-group-check")) {
    event.stopPropagation();
  }
});

// A Review picker row (Apps / Emulators) opens the picker in the right mode.
document.addEventListener("click", (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLElement>("[data-picker]");
  if (!btn) return;
  pickerMode = btn.dataset.picker === "emulators" ? "emulators" : "apps";
  location.hash = "apps";
});

// "Select recommended" on the removals checklist: tick the recommended set.
document.addEventListener("click", (event) => {
  if (!(event.target as HTMLElement).closest("[data-removals-rec]")) return;
  for (const r of removalsCatalog) if (r.recommended) selectedRemovals.add(r.id);
  renderCustomise();
});

document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;

  if (target.closest("#iso-browse")) {
    void (async () => {
      const picked = await window.bootible?.browseIso?.();
      if (!picked) return;
      // Use the local ISO for the image, but keep the chosen language's isoId so
      // the answer file's UI language still matches (uiLanguage is derived from it).
      usbState.isoPath = picked;
      const path = document.querySelector("#iso-path");
      if (path) path.textContent = picked;
      updateWriteButton();
    })();
    return;
  }

  if (target.closest("#disk-refresh")) {
    void refreshDisks();
    return;
  }

  if (target.closest("#ssh-generate")) {
    void (async () => {
      const created = await window.bootible?.generateHostSshKey?.(`${deviceName} via bootible`);
      if (!created) return;
      if (!hostSshKeys.some((k) => k.id === created.id)) hostSshKeys.push(created);
      selectedKeyIds.add(created.id);
      renderSshKeys();
    })();
    return;
  }

  const disk = target.closest<HTMLElement>(".uw-disk:not(.deck-disk):not(.deckre-disk)");
  if (disk) {
    usbState.disk = Number(disk.dataset.disk);
    for (const d of document.querySelectorAll(".uw-disk:not(.deck-disk):not(.deckre-disk)"))
      d.classList.toggle("is-sel", d === disk);
    updateWriteButton();
    return;
  }

  if (target.closest("#usb-write-btn")) void startUsbWrite();
});

async function runApplyDevice(): Promise<void> {
  const api = window.bootible;
  if (!api?.applyDevice) {
    location.hash = "provision"; // browser/no-preload: fall back to the dry-run preview
    return;
  }
  const result = await api.applyDevice({
    modules: selectedModuleIds(),
    account: { mode: "local" },
  });
  if (result.status === "cancelled") return;

  const receipt = document.querySelector<HTMLElement>('.view[data-view="done"] .receipt');
  if (result.status === "blocked") {
    fill("done-eyebrow", "Blocked");
    fill("done-title", "Not a recognised handheld");
    fill(
      "done-sub",
      "Run on device only works on a whitelisted ROG Ally. From here you can still build a USB or export a config for one.",
    );
    receipt?.replaceChildren(receiptRow("apply", "hard-blocked — no Ally detected"));
    location.hash = "done";
    return;
  }

  fill("done-eyebrow", "Applying");
  fill("done-title", "Configuring your Ally");
  fill(
    "done-sub",
    "An elevated window is running the setup. Restore points are taken before and after — you can roll back any time.",
  );
  receipt?.replaceChildren(
    receiptRow("device", deviceName),
    receiptRow("restore", "fresh + post-config"),
    receiptRow("log", "C:\\bootible\\bootstrap.log"),
  );
  location.hash = "done";
}

document.addEventListener("click", (event) => {
  const trigger = (event.target as HTMLElement).closest<HTMLElement>('[data-action="apply"]');
  if (!trigger) return;
  const method = document.body.dataset.method ?? "device";
  if (method === "export") void runExport();
  else if (method === "usb") location.hash = "usbwrite";
  else void runApplyDevice();
});

// "View full receipt" opens the artifact this run produced (folder / file).
document.addEventListener("click", (event) => {
  const trigger = (event.target as HTMLElement).closest<HTMLElement>(
    '[data-action="open-artifact"]',
  );
  if (!trigger) return;
  if (lastArtifactPath && window.bootible?.openPath) {
    void window.bootible.openPath(lastArtifactPath);
  } else {
    location.hash = "home";
  }
});

// ── Welcome / sign-in ───────────────────────────────────────────────────────
const cloud = window.bootible?.cloud;

/** Reflect the signed-in account (email + Sign out) in the top bar. */
async function refreshAccount(): Promise<void> {
  const acct = document.querySelector<HTMLElement>("#account");
  const emailEl = document.querySelector<HTMLElement>("#account-email");
  const twofaBtn = document.querySelector<HTMLButtonElement>("#account-2fa");
  if (!acct || !cloud) return;
  const s = await cloud.status();
  if (s.signedIn) {
    if (emailEl) emailEl.textContent = s.email ?? "Signed in";
    if (twofaBtn) {
      twofaBtn.textContent = s.twoFactorEnabled ? "2FA on" : "Set up 2FA";
      twofaBtn.hidden = false;
    }
    acct.hidden = false;
  } else {
    acct.hidden = true;
    if (twofaBtn) twofaBtn.hidden = true;
  }
}

document.querySelector<HTMLButtonElement>("#account-signout")?.addEventListener("click", () => {
  void (async () => {
    if (!cloud) return;
    await cloud.signOut();
    const emailEl = document.querySelector<HTMLElement>("#account-email");
    if (emailEl) emailEl.textContent = "";
    document.querySelector<HTMLElement>("#account")?.setAttribute("hidden", "");
    location.hash = "welcome";
  })();
});

function welcomeError(msg: string | null): void {
  const el = document.querySelector<HTMLElement>("#welcome-error");
  if (el) el.textContent = msg ?? ""; // space is reserved in CSS — no reflow
}

/** Disable a button + show a spinner while an async action runs, then restore. */
async function withBusy<T>(
  btn: HTMLButtonElement | null | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  if (btn) {
    btn.disabled = true;
    btn.classList.add("busy");
  }
  try {
    return await fn();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove("busy");
    }
  }
}

async function doEmailAuth(mode: "signin" | "signup"): Promise<void> {
  if (!cloud) return;
  const email = document.querySelector<HTMLInputElement>("#welcome-email")?.value.trim() ?? "";
  const password = document.querySelector<HTMLInputElement>("#welcome-pass")?.value ?? "";
  if (!email || password.length < 8) {
    welcomeError("Enter your email and an 8+ character password.");
    return;
  }
  welcomeError(null);
  const btn = document.querySelector<HTMLButtonElement>(`[data-auth='${mode}']`);
  const r = await withBusy(btn, () =>
    mode === "signup"
      ? cloud.signUpEmail({ email, password })
      : cloud.signInEmail({ email, password }),
  );
  if (r.needsVerification) return showVerifyMail(email); // sign-in blocked until verified
  if (!r.ok) {
    welcomeError(r.error ?? "Sign-in failed.");
    return;
  }
  if (mode === "signup") return showVerifyMail(email); // new account must verify first
  if ((r as { twoFactor?: boolean }).twoFactor)
    location.hash = "twofa"; // second factor required
  else void afterSignIn();
}

let pendingVerifyEmail = "";
function showVerifyMail(email: string): void {
  pendingVerifyEmail = email;
  const addr = document.querySelector<HTMLElement>("#verify-email-addr");
  if (addr) addr.textContent = email;
  const msg = document.querySelector<HTMLElement>("#verify-msg");
  if (msg) msg.textContent = "";
  location.hash = "verifymail";
}

// ── Sync-key step (passphrase setup / unlock / recovery) ─────────────────────
type SyncMode = "setup" | "unlock" | "recovery" | "reset";
let syncMode: SyncMode = "setup";
let setupOwn = false; // setup sub-mode: false = generated, true = the user's own
let generatedPass = "";

function syncEl<T extends HTMLElement>(id: string): T | null {
  return document.querySelector<T>(id);
}
function syncError(msg: string | null): void {
  const el = syncEl<HTMLElement>("#synckey-error");
  if (el) el.textContent = msg ?? "";
}

/** A diceware passphrase: 6 random words from the EFF list (~77 bits). */
function genPassphrase(): string {
  const rand = crypto.getRandomValues(new Uint32Array(6));
  return Array.from(rand, (r) => WORDLIST[r % WORDLIST.length] ?? "").join(" ");
}

async function copyToClipboard(text: string, btn: HTMLButtonElement): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    const original = btn.textContent ?? "";
    btn.textContent = "Copied!";
    setTimeout(() => {
      btn.textContent = original;
    }, 1500);
  } catch {
    syncError("Couldn't copy — select the text and copy manually.");
  }
}

/** Within setup, switch between a generated passphrase and the user's own. */
function applySetupSubmode(): void {
  const pass = syncEl<HTMLInputElement>("#synckey-pass");
  const confirm = syncEl<HTMLInputElement>("#synckey-confirm");
  const genActions = syncEl<HTMLElement>("#synckey-gen-actions");
  const ownToggle = syncEl<HTMLButtonElement>("#synckey-own-toggle");
  if (!setupOwn) {
    if (!generatedPass) generatedPass = genPassphrase();
    if (pass) {
      pass.readOnly = true;
      pass.type = "text";
      pass.value = generatedPass;
    }
    confirm?.setAttribute("hidden", "");
    genActions?.removeAttribute("hidden");
    if (ownToggle) ownToggle.textContent = "Set my own passphrase instead";
  } else {
    if (pass) {
      pass.readOnly = false;
      pass.type = "password";
      pass.value = "";
      pass.placeholder = "Sync passphrase (8+ characters)";
    }
    if (confirm) confirm.value = "";
    confirm?.removeAttribute("hidden");
    genActions?.setAttribute("hidden", "");
    if (ownToggle) ownToggle.textContent = "Use a generated passphrase instead";
  }
}

/** After sign-in, route to set/unlock the sync key, or straight in if ready. */
async function afterSignIn(): Promise<void> {
  if (!cloud) {
    location.hash = "platform";
    return;
  }
  void refreshAccount();
  const ks = await cloud.keyStatus();
  if (!ks.signedIn || ks.unlocked) {
    if (ks.unlocked) void cloud.syncNow(); // sync on entry when already unlocked
    location.hash = "platform";
    return;
  }
  configureSyncKey(ks.hasServerKey ? "unlock" : "setup");
  location.hash = "synckey";
}

function configureSyncKey(mode: SyncMode): void {
  syncMode = mode;
  const title = syncEl<HTMLElement>("#synckey-title");
  const sub = syncEl<HTMLElement>("#synckey-sub");
  const pass = syncEl<HTMLInputElement>("#synckey-pass");
  const confirm = syncEl<HTMLInputElement>("#synckey-confirm");
  const submit = syncEl<HTMLButtonElement>("#synckey-submit");
  const ownToggle = syncEl<HTMLButtonElement>("#synckey-own-toggle");
  const recToggle = syncEl<HTMLButtonElement>("#synckey-recovery-toggle");
  const genActions = syncEl<HTMLElement>("#synckey-gen-actions");
  syncEl<HTMLElement>("#synckey-form")?.removeAttribute("hidden");
  syncEl<HTMLElement>("#synckey-recovery")?.setAttribute("hidden", "");
  syncError(null);

  if (mode === "setup" || mode === "reset") {
    if (title)
      title.textContent = mode === "reset" ? "Set a new passphrase" : "Set a sync passphrase";
    if (sub)
      sub.textContent =
        mode === "reset"
          ? "Recovered. Choose a new passphrase to lock your synced secrets — your recovery code stays the same."
          : "This encrypts your saved secrets before they ever leave this device — we can't see it or reset it. Save it in your password manager; you'll also get a one-time recovery code.";
    if (submit) submit.textContent = mode === "reset" ? "Set new passphrase" : "Set passphrase";
    ownToggle?.removeAttribute("hidden");
    recToggle?.setAttribute("hidden", "");
    setupOwn = false;
    generatedPass = genPassphrase();
    applySetupSubmode();
    return;
  }

  // unlock / recovery — a single editable field, no generated controls.
  genActions?.setAttribute("hidden", "");
  ownToggle?.setAttribute("hidden", "");
  confirm?.setAttribute("hidden", "");
  if (pass) {
    pass.readOnly = false;
    pass.type = "password";
    pass.value = "";
  }
  recToggle?.removeAttribute("hidden");
  if (mode === "unlock") {
    if (title) title.textContent = "Unlock your synced secrets";
    if (sub) sub.textContent = "Enter your sync passphrase to decrypt your secrets on this device.";
    if (pass) pass.placeholder = "Sync passphrase";
    if (submit) submit.textContent = "Unlock";
    if (recToggle) recToggle.textContent = "Use a recovery code instead";
  } else {
    if (title) title.textContent = "Enter your recovery code";
    if (sub) sub.textContent = "Use the one-time recovery code you saved when you set up sync.";
    if (pass) pass.placeholder = "xxxx-xxxx-xxxx-xxxx";
    if (submit) submit.textContent = "Unlock with code";
    if (recToggle) recToggle.textContent = "Use my passphrase instead";
  }
}

async function submitSyncKey(): Promise<void> {
  if (!cloud) return;
  const pass = syncEl<HTMLInputElement>("#synckey-pass")?.value.trim() ?? "";
  syncError(null);
  if (syncMode === "setup" || syncMode === "reset") {
    if (setupOwn) {
      const confirm = syncEl<HTMLInputElement>("#synckey-confirm")?.value.trim() ?? "";
      if (pass.length < 8) return syncError("Use a passphrase of at least 8 characters.");
      if (pass !== confirm) return syncError("The passphrases don't match.");
    }
    const r = syncMode === "reset" ? await cloud.resetPassphrase(pass) : await cloud.setupKey(pass);
    if (!r.ok) return syncError(r.error ?? "Couldn't set the passphrase.");
    if (syncMode === "reset") {
      location.hash = "platform"; // recovery code unchanged — straight in
      return;
    }
    // Setup: reveal the recovery code; the user continues from there.
    const code = syncEl<HTMLElement>("#recovery-code");
    if (code) code.textContent = (r as { recoveryCode?: string }).recoveryCode ?? "";
    syncEl<HTMLElement>("#synckey-form")?.setAttribute("hidden", "");
    syncEl<HTMLElement>("#synckey-recovery")?.removeAttribute("hidden");
    return;
  }
  if (!pass) return syncError("Enter your passphrase.");
  const r = syncMode === "recovery" ? await cloud.unlockRecovery(pass) : await cloud.unlock(pass);
  if (!r.ok) return syncError(r.error ?? "That didn't work.");
  // Recovered → make them set a fresh passphrase; a plain unlock goes straight in.
  if (syncMode === "recovery") configureSyncKey("reset");
  else location.hash = "platform";
}

syncEl<HTMLButtonElement>("#synckey-submit")?.addEventListener("click", () =>
  withBusy(syncEl<HTMLButtonElement>("#synckey-submit"), submitSyncKey),
);
syncEl<HTMLButtonElement>("#synckey-done")?.addEventListener("click", () => {
  location.hash = "platform";
});
syncEl<HTMLButtonElement>("#synckey-recovery-toggle")?.addEventListener("click", () =>
  configureSyncKey(syncMode === "recovery" ? "unlock" : "recovery"),
);
syncEl<HTMLButtonElement>("#synckey-own-toggle")?.addEventListener("click", () => {
  setupOwn = !setupOwn;
  applySetupSubmode();
});
syncEl<HTMLButtonElement>("#synckey-regen")?.addEventListener("click", () => {
  generatedPass = genPassphrase();
  const pass = syncEl<HTMLInputElement>("#synckey-pass");
  if (pass) pass.value = generatedPass;
});
syncEl<HTMLButtonElement>("#synckey-copy")?.addEventListener("click", (e) => {
  void copyToClipboard(generatedPass, e.currentTarget as HTMLButtonElement);
});
syncEl<HTMLButtonElement>("#recovery-copy")?.addEventListener("click", (e) => {
  const code = syncEl<HTMLElement>("#recovery-code")?.textContent ?? "";
  void copyToClipboard(code, e.currentTarget as HTMLButtonElement);
});

// ── Two-factor (TOTP) ─────────────────────────────────────────────────────────
function twofaErr(id: string, msg: string | null): void {
  const el = document.querySelector<HTMLElement>(id);
  if (el) el.textContent = msg ?? "";
}

// Sign-in challenge: verify the code, then continue the normal post-sign-in flow.
document.querySelector<HTMLButtonElement>("#twofa-verify")?.addEventListener("click", () => {
  void (async () => {
    if (!cloud) return;
    const code = document.querySelector<HTMLInputElement>("#twofa-code")?.value.trim() ?? "";
    twofaErr("#twofa-error", null);
    if (!code) return twofaErr("#twofa-error", "Enter the 6-digit code.");
    const r = await withBusy(document.querySelector<HTMLButtonElement>("#twofa-verify"), () =>
      cloud.verifyTotp(code),
    );
    if (r.ok) await afterSignIn();
    else twofaErr("#twofa-error", r.error ?? "That code didn't match.");
  })();
});

// Open the setup/disable screen from the account chip, in the right mode.
function openTwofaSetup(enabled: boolean): void {
  document.querySelector<HTMLElement>("#twofa-step-pass")?.toggleAttribute("hidden", enabled);
  document.querySelector<HTMLElement>("#twofa-step-verify")?.setAttribute("hidden", "");
  document.querySelector<HTMLElement>("#twofa-step-disable")?.toggleAttribute("hidden", !enabled);
  const title = document.querySelector<HTMLElement>("#twofasetup-title");
  if (title) title.textContent = enabled ? "Two-factor is on" : "Set up two-factor";
  for (const id of ["#twofa-pass", "#twofa-confirm-code", "#twofa-disable-pass"]) {
    const el = document.querySelector<HTMLInputElement>(id);
    if (el) el.value = "";
  }
  for (const id of ["#twofasetup-error", "#twofasetup-error2", "#twofasetup-error3"])
    twofaErr(id, null);
  location.hash = "twofasetup";
}

document.querySelector<HTMLButtonElement>("#account-2fa")?.addEventListener("click", () => {
  void (async () => {
    if (!cloud) return;
    openTwofaSetup(!!(await cloud.status()).twoFactorEnabled);
  })();
});

// Enroll step 1: password → enable → render QR + backup codes.
document.querySelector<HTMLButtonElement>("#twofa-enable")?.addEventListener("click", () => {
  void (async () => {
    if (!cloud) return;
    const password = document.querySelector<HTMLInputElement>("#twofa-pass")?.value ?? "";
    twofaErr("#twofasetup-error", null);
    if (!password) return twofaErr("#twofasetup-error", "Enter your account password.");
    const r = await withBusy(document.querySelector<HTMLButtonElement>("#twofa-enable"), () =>
      cloud.enable2FA(password),
    );
    if (!r.ok) return twofaErr("#twofasetup-error", r.error ?? "Couldn't start setup.");
    const img = document.querySelector<HTMLImageElement>("#twofa-qr");
    if (img && r.totpURI) img.src = await QRCode.toDataURL(r.totpURI, { margin: 1, width: 200 });
    const bk = document.querySelector<HTMLElement>("#twofa-backup");
    if (bk) bk.textContent = (r.backupCodes ?? []).join("  ");
    document.querySelector<HTMLElement>("#twofa-step-pass")?.setAttribute("hidden", "");
    document.querySelector<HTMLElement>("#twofa-step-verify")?.removeAttribute("hidden");
  })();
});

// Enroll step 2: confirm a code → 2FA on.
document.querySelector<HTMLButtonElement>("#twofa-confirm")?.addEventListener("click", () => {
  void (async () => {
    if (!cloud) return;
    const code =
      document.querySelector<HTMLInputElement>("#twofa-confirm-code")?.value.trim() ?? "";
    twofaErr("#twofasetup-error2", null);
    if (!code) return twofaErr("#twofasetup-error2", "Enter a code from your app.");
    const r = await withBusy(document.querySelector<HTMLButtonElement>("#twofa-confirm"), () =>
      cloud.verify2FASetup(code),
    );
    if (!r.ok) return twofaErr("#twofasetup-error2", r.error ?? "That code didn't match.");
    await refreshAccount();
    location.hash = "platform";
  })();
});

document.querySelector<HTMLButtonElement>("#twofa-backup-copy")?.addEventListener("click", (e) => {
  const codes = document.querySelector<HTMLElement>("#twofa-backup")?.textContent ?? "";
  void copyToClipboard(codes, e.currentTarget as HTMLButtonElement);
});

// Disable.
document.querySelector<HTMLButtonElement>("#twofa-disable")?.addEventListener("click", () => {
  void (async () => {
    if (!cloud) return;
    const password = document.querySelector<HTMLInputElement>("#twofa-disable-pass")?.value ?? "";
    twofaErr("#twofasetup-error3", null);
    if (!password) return twofaErr("#twofasetup-error3", "Enter your account password.");
    const r = await withBusy(document.querySelector<HTMLButtonElement>("#twofa-disable"), () =>
      cloud.disable2FA(password),
    );
    if (!r.ok) return twofaErr("#twofasetup-error3", r.error ?? "Couldn't disable 2FA.");
    await refreshAccount();
    location.hash = "platform";
  })();
});

// Enter in any field on the sync-key / 2FA cards triggers the visible primary button.
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const t = e.target;
  if (!(t instanceof HTMLInputElement)) return;
  const card = t.closest(".synckey-card");
  if (!card) return;
  const btn = Array.from(card.querySelectorAll<HTMLButtonElement>(".btn-primary")).find(
    (b) => b.offsetParent !== null,
  );
  if (btn) {
    e.preventDefault();
    btn.click();
  }
});

document.querySelector<HTMLFormElement>("#welcome-email-form")?.addEventListener("submit", (e) => {
  e.preventDefault();
  void doEmailAuth("signin");
});
document
  .querySelector<HTMLButtonElement>("[data-auth='signup']")
  ?.addEventListener("click", () => void doEmailAuth("signup"));

// Check-your-email view: resend the verification link / go back to sign in.
document.querySelector<HTMLButtonElement>("#verify-resend")?.addEventListener("click", (e) => {
  void (async () => {
    if (!cloud || !pendingVerifyEmail) return;
    const msg = document.querySelector<HTMLElement>("#verify-msg");
    const r = await withBusy(e.currentTarget as HTMLButtonElement, () =>
      cloud.resendVerification(pendingVerifyEmail),
    );
    if (msg) msg.textContent = r.ok ? "Sent — check your inbox." : (r.error ?? "Couldn't resend.");
  })();
});
document.querySelector<HTMLButtonElement>("#verify-back")?.addEventListener("click", () => {
  location.hash = "welcome";
});

// Forgot password: email a reset link (completed on the Worker /reset-password page).
document.querySelector<HTMLButtonElement>("#forgot-pw")?.addEventListener("click", (e) => {
  void (async () => {
    if (!cloud) return;
    const email = document.querySelector<HTMLInputElement>("#welcome-email")?.value.trim() ?? "";
    if (!email) {
      welcomeError("Enter your email above, then tap Forgot password.");
      return;
    }
    const r = await withBusy(e.currentTarget as HTMLButtonElement, () =>
      cloud.requestPasswordReset(email),
    );
    welcomeError(
      r.ok
        ? `Reset link sent to ${email} — check your inbox.`
        : (r.error ?? "Couldn't send the reset email."),
    );
  })();
});

// Social provider icons + interim handler. Real brand SVGs live in assets/logos/auth/
// (discord present; google/github/twitch fall back to a monogram until dropped in).
// Browser token capture is the next step.
for (const btn of document.querySelectorAll<HTMLButtonElement>(".provider-ico")) {
  const provider = btn.dataset.provider ?? "";
  const url = AUTH_LOGOS[provider];
  if (url) {
    const img = el("img", "provider-ico-img") as HTMLImageElement;
    img.src = url;
    img.alt = "";
    btn.appendChild(img);
  } else {
    btn.textContent = btn.dataset.mono ?? provider.charAt(0).toUpperCase();
  }
  btn.addEventListener("click", () => {
    void (async () => {
      if (!cloud) return;
      welcomeError(null);
      const r = await withBusy(btn, () => cloud.signInSocial(provider));
      if (r.ok) await afterSignIn();
      else if (r.error !== "Sign-in was cancelled.") welcomeError(r.error ?? "Sign-in failed.");
    })();
  });
}

// First render. Resolve the session BEFORE painting so a signed-in user doesn't
// flash the welcome screen before being redirected in. Views stay hidden until then.
document.body.classList.add("booting");
void (async () => {
  try {
    if (!location.hash && cloud) {
      const s = await cloud.status();
      if (s.signedIn) {
        await afterSignIn();
        return;
      }
    }
    syncFromHash();
    void refreshAccount();
  } finally {
    document.body.classList.remove("booting");
  }
})();
