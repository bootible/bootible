// RECORDED REASON for >400 lines (coding-standard §4): the renderer god-file,
// well into decomposition — 4022 → ~2450 lines. Already carved out: the Deck flow
// (features/deck/*), the auth flow (features/auth.ts), the hash router
// (lib/router.ts), shared device context (lib/session.ts), logoMap (lib/logos.ts),
// and now the ROG flow's ~35 shared state vars into lib/rog-state.ts (the `rog`
// object). What remains is the ROG SCREENS themselves — device-pick → customise →
// apps → ssh → bundles → method → provisioning → profiles → USB-writer → watch +
// gatherUsbRequest — which now all read/write `rog.*` and can be split into
// features/rog/* next (no shared-state blocker any more).
// See docs/v2/standards/remediation-plan.md P3.
import "./styles.css";
import type {
  AppEntry,
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
  ModuleSummary,
  PasswordManager,
  PlanModule,
  PlatformOption,
  Profile,
  ProfileSummary,
  ProvisioningMethod,
  ProvisionResult,
  RegionOption,
  RemovalEntry,
  StaticIp,
  StepEvent,
  UsbBuildRequest,
  UsbDisk,
  UsbProgress,
  UsbWriteRequest as UsbWriteReq,
} from "@bootible/core";
import brandMark from "./assets/bootible-mark.png";
import { DiskPicker } from "./components/DiskPicker";
import { GroupedPicker, type PickerItem } from "./components/GroupedPicker";
import { NetworkSettings } from "./components/NetworkSettings";
import { ProfileBar } from "./components/ProfileBar";
import { RemoteAccessSettings } from "./components/RemoteAccessSettings";
import { SshAccessEditor } from "./components/SshAccessEditor";
import { StatusMessage } from "./components/StatusMessage";
import { StreamingSettings } from "./components/StreamingSettings";
import { afterSignIn, cloud, refreshAccount } from "./features/auth";
import {
  hydrateDeck,
  hydrateDeckApps,
  hydrateDeckEmulators,
  hydrateDeckPlugins,
  hydrateDeckPm,
  hydrateDeckReimage,
  hydrateDeckSetup,
  hydrateDeckWrite,
} from "./features/deck";
import { el, fill, steps } from "./lib/dom";
import {
  APP_LOGOS,
  DEVICE_BRAND,
  DEVICE_LOGOS,
  FORCE_WHITE,
  LOGO_SCALE,
  logoEl,
  OS_LOGOS,
} from "./lib/logos";
import { rog } from "./lib/rog-state";
import { registerRoute, syncFromHash } from "./lib/router";
import { session } from "./lib/session";

// Brand mark in the sysbar + window favicon (Vite resolves the hashed URL).
const markImg = document.querySelector<HTMLImageElement>("#brand-mark");
if (markImg) markImg.src = brandMark;
const favicon = document.querySelector<HTMLLinkElement>("#favicon");
if (favicon) favicon.href = brandMark;
const welcomeLogo = document.querySelector<HTMLImageElement>("#welcome-logo");
if (welcomeLogo) welcomeLogo.src = brandMark;

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
  if (rog.selectedBaseId === "full-rog") {
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

/** Write a value into every [data-field="<field>"] element. */

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
  session.deviceId = id;
  session.deviceName = device.name;
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
  try {
    rog.baseOptions = await api.getBases();
  } catch {
    return;
  }
  list.replaceChildren(...rog.baseOptions.map(baseCard));
}

// ── review & customise screen ───────────────────────────────────────────────
const FLOOR_WARNING = "Not recommended — every bootible device is meant to be tuned & debloated.";

/** One toggle row on the customise screen. Floor/base are checked by default
 *  (untick → rog.disabledModules); extras are unchecked (tick → rog.enabledExtras). */
function customiseRow(m: PlanModule, kind: "floor" | "base" | "extra"): HTMLElement {
  const isApps = m.id === "apps";
  const checked = kind === "extra" ? rog.enabledExtras.has(m.id) : !rog.disabledModules.has(m.id);
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
      `Choose apps (${rog.selectedApps.size}) →`,
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
  // Cards lay out 2-up inside a full-width section (the shared .cz-sec-rows grid,
  // same as the Deck) so the page shape is identical across bases.
  const grid = el("div", "cz-sec-rows");
  grid.append(...rows);
  sec.append(head, grid);
  return sec;
}

function renderCustomise(): void {
  const host = document.querySelector<HTMLElement>("#customise-body");
  if (!host || !basePlan) return;
  // Show which base this is — easy to forget if you step away and come back.
  const baseLabel =
    rog.baseOptions.find((b) => b.id === rog.selectedBaseId)?.label ?? rog.selectedBaseId;
  fill("customise-base", baseLabel ? ` · ${baseLabel}` : "");
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
  // Opt-in "Remove apps" checklist (generic Windows bloat/trialware) — offered on
  // every Windows base, not just Full ROG.
  if (removalsCatalog.length) {
    secs.push(removalsSection());
  }
  host.replaceChildren(...secs);
  // Running summary.
  const floorOn = basePlan.floor.filter((m) => !rog.disabledModules.has(m.id)).length;
  const baseOn = basePlan.base.filter((m) => !rog.disabledModules.has(m.id)).length;
  const extrasOn = rog.enabledExtras.size + rog.selectedApps.size;
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
  // Collapsed by default even when pre-ticked — the "22 / 23" count shows the
  // recommended set is selected; expand to review/untick individual apps.
  const summary = el("summary", "app-group-sum");
  summary.append(
    el("span", "app-group-name", "Remove apps (optional)"),
    el(
      "span",
      `app-group-count${rog.selectedRemovals.size > 0 ? " on" : ""}`,
      `${rog.selectedRemovals.size} / ${removalsCatalog.length}`,
    ),
  );
  const body = el("div", "app-items");
  const note = el(
    "p",
    "app-note",
    "Recommended bloat & trialware is pre-ticked — untick anything you want to keep. Phone Link is kept by default.",
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
    cb.checked = rog.selectedRemovals.has(r.id);
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
  if (!api?.getBasePlan || !rog.selectedBaseId) return;
  // A fresh base entry (not a just-loaded profile) gets the base's baked defaults.
  const freshEntry = !rog.customiseHydrated && !rog.keepRestoredCustomise;
  if (!rog.customiseHydrated) {
    try {
      basePlan = await api.getBasePlan(rog.selectedBaseId);
    } catch {
      basePlan = null;
    }
    // Fresh base entry resets toggles; a just-loaded profile keeps its restored ones.
    if (!rog.keepRestoredCustomise) {
      rog.disabledModules.clear();
      rog.enabledExtras.clear();
    }
    rog.keepRestoredCustomise = false;
    rog.customiseHydrated = true;
  }
  void mountRogProfileBar("load"); // pick a saved profile to start from
  // The Apps/Emulators counts need the rog.catalog loaded.
  if (!rog.appGroups.length && api.getAppGroups) {
    try {
      rog.appGroups = await api.getAppGroups();
    } catch {}
  }
  // Base labels for the screen header (cached by the base picker; fetch if the
  // user deep-linked straight here).
  if (!rog.baseOptions.length && api.getBases) {
    try {
      rog.baseOptions = await api.getBases();
    } catch {}
  }
  // Load the removal rog.catalog for the "Remove apps" checklist (every Windows base).
  if (!removalsCatalog.length && api.getRemovals) {
    try {
      removalsCatalog = await api.getRemovals();
    } catch {}
  }
  // Baked-profile default: a fresh base entry pre-ticks the recommended removals
  // (the user reviews + unticks anything to keep — not a silent nuke). A restored
  // profile keeps exactly the removals it saved.
  if (freshEntry) {
    rog.selectedRemovals.clear();
    for (const r of removalsCatalog) if (r.recommended) rog.selectedRemovals.add(r.id);
  }
  renderCustomise();
}

// ── app / emulator picker (collapsible groups) ──────────────────────────────
/** An entry is "on" if its winget pick is selected, or — for a module entry like
 *  EmuDeck — its module is enabled. */
function entryOn(a: AppEntry): boolean {
  return a.module ? rog.enabledExtras.has(a.module) : rog.selectedApps.has(a.id);
}

/** The groups shown in the current picker mode (Apps = everything but emulators;
 *  Emulators = just that group). */
function pickerGroups(): AppGroup[] {
  return rog.pickerMode === "emulators"
    ? rog.appGroups.filter((g) => g.id === EMU_GROUP)
    : rog.appGroups.filter((g) => g.id !== EMU_GROUP);
}

/** Map an AppEntry to a shared-picker item, with the ROG app logo. */
function rogAppItem(a: AppEntry): PickerItem {
  let logoCls = "app-logo";
  if (FORCE_WHITE.has(a.id)) logoCls += " force-white";
  if (LOGO_SCALE.has(a.id)) logoCls += " scaled";
  return {
    id: a.id,
    label: a.name,
    sublabel: a.desc ?? a.wingetId ?? "",
    checked: entryOn(a),
    icon: logoEl(APP_LOGOS[a.id], logoCls),
  };
}

/** The "N apps/emulators selected" line under the picker (the GroupedPicker keeps
 *  the per-group heads in sync itself; this is the only thing a toggle must update). */
function refreshAppsCount(): void {
  const count = document.querySelector("#apps-count");
  if (!count) return;
  const n = rog.pickerMode === "emulators" ? pickCounts().emulators : pickCounts().apps;
  const word = rog.pickerMode === "emulators" ? "emulator" : "app";
  count.textContent = `${n} ${word}${n === 1 ? "" : "s"} selected`;
}

/** Apply an AppEntry toggle to the right set (winget app → rog.selectedApps, module
 *  entry like EmuDeck → rog.enabledExtras). */
function applyAppToggle(a: AppEntry, on: boolean): void {
  const set = a.module ? rog.enabledExtras : rog.selectedApps;
  const key = a.module ?? a.id;
  if (on) set.add(key);
  else set.delete(key);
}

function renderApps(): void {
  const host = document.querySelector<HTMLElement>("#apps-body");
  if (!host) return;
  host.replaceChildren(
    GroupedPicker({
      groups: pickerGroups().map((g) => ({
        id: g.id,
        label: g.label,
        note: g.note,
        open: rog.openGroups.has(g.id),
        items: g.apps.map(rogAppItem),
      })),
      onToggleItem: (groupId, itemId, on) => {
        const a = rog.appGroups.find((x) => x.id === groupId)?.apps.find((x) => x.id === itemId);
        if (a) applyAppToggle(a, on);
        refreshAppsCount();
      },
      onToggleGroup: (groupId, on) => {
        const g = rog.appGroups.find((x) => x.id === groupId);
        if (g) for (const a of g.apps) applyAppToggle(a, on);
        refreshAppsCount();
      },
      onToggleOpen: (groupId, open) => {
        if (open) rog.openGroups.add(groupId);
        else rog.openGroups.delete(groupId);
      },
    }),
  );
  fill("apps-title", rog.pickerMode === "emulators" ? "Choose emulators" : "Choose apps");
  refreshAppsCount();
}

async function hydrateApps(): Promise<void> {
  const api = window.bootible;
  if (!api?.getAppGroups) return;
  const host = document.querySelector<HTMLElement>("#apps-body");
  if (!rog.appsHydrated) {
    host?.replaceChildren(StatusMessage({ kind: "loading", message: "Loading apps…" }));
    try {
      rog.appGroups = await api.getAppGroups();
      rog.appsHydrated = true;
    } catch {
      // A failed rog.catalog fetch used to silently render an empty picker — surface it.
      host?.replaceChildren(
        StatusMessage({
          kind: "error",
          message: "Couldn't load the app rog.catalog.",
          onRetry: () => void hydrateApps(),
        }),
      );
      return;
    }
  }
  // On (re)entering the picker, open the groups that have selections — but from
  // here the user's manual expand/collapse (toggle event) is what's respected.
  rog.openGroups.clear();
  for (const g of pickerGroups()) {
    if (rog.pickerMode === "emulators" || g.apps.some(entryOn)) rog.openGroups.add(g.id);
  }
  renderApps();
}

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
// ROG game-streaming + remote-access state — the single source of truth (the
// shared StreamingSettings / RemoteAccessSettings render from it; gather/profile
// read it), the same pattern the Sunshine password already used.

function currentEditionIsPro(): boolean {
  return document.querySelector<HTMLInputElement>("#edition-pro")?.checked ?? false;
}

/** (Re)mount the shared StreamingSettings for the ROG (Sunshine host + creds +
 *  Moonlight + the "also set it up on this PC" host toggles). */
function mountRogStreaming(): void {
  const mount = document.querySelector<HTMLElement>("#rog-streaming-mount");
  if (!mount) return;
  mount.replaceChildren(
    StreamingSettings({
      showHost: true,
      value: {
        sunshineEnabled: rog.sunshineEnabled,
        sunshineUser: rog.sunshineUser || undefined,
        sunshinePass: rog.sunshinePromptPass ? undefined : rog.sunshinePass || undefined,
        sunshinePromptPass: rog.sunshinePromptPass,
        sunshineHost: rog.sunshineHost,
        moonlight: rog.moonlight,
        moonlightHost: rog.moonlightHost,
      },
      onChange: (next) => {
        // Re-mount only when a toggle changes which fields show, so typing in
        // user/password keeps focus (matches the Deck's mountDeckStreaming).
        const toggled =
          rog.sunshineEnabled !== next.sunshineEnabled ||
          rog.moonlight !== next.moonlight ||
          Boolean(rog.sunshinePromptPass) !== Boolean(next.sunshinePromptPass);
        rog.sunshineEnabled = next.sunshineEnabled;
        rog.sunshineUser = next.sunshineUser ?? "";
        rog.sunshinePromptPass = Boolean(next.sunshinePromptPass);
        rog.sunshinePass = next.sunshinePromptPass ? "" : (next.sunshinePass ?? "");
        rog.sunshineHost = Boolean(next.sunshineHost);
        rog.moonlight = next.moonlight;
        rog.moonlightHost = Boolean(next.moonlightHost);
        if (toggled) mountRogStreaming();
      },
    }),
  );
}

/** (Re)mount the shared RemoteAccessSettings for the ROG (just RDP; disabled — and
 *  cleared — unless the edition is Pro, since Home can't host Remote Desktop). */
function mountRogRemoteAccess(): void {
  const mount = document.querySelector<HTMLElement>("#rog-remote-access-mount");
  if (!mount) return;
  const pro = currentEditionIsPro();
  mount.replaceChildren(
    RemoteAccessSettings({
      options: [
        {
          id: "rdp",
          label: "Windows Remote Desktop",
          desc: "The full Windows desktop via mstsc, from another machine.",
          enabled: rog.rdp && pro,
          disabled: !pro,
          note: pro ? undefined : "needs Windows Pro — switch the edition above",
        },
      ],
      onToggle: (_id, on) => {
        rog.rdp = on;
      },
    }),
  );
}

/** (Re)mount the shared SshAccessEditor on the ROG account screen (host-key
 *  discovery + GitHub + paste; keys enable SSH). */
function mountRogSsh(): void {
  const mount = document.querySelector<HTMLElement>("#ssh-mount");
  if (!mount) return;
  const editor = SshAccessEditor({
    hostKeys: rog.hostSshKeys,
    value: {
      hostKeyIds: [...rog.selectedKeyIds],
      pastedKeys: rog.pastedKeys,
      githubUser: rog.githubUser || undefined,
    },
    // Only show a count once we've actually fetched for THIS username (else a
    // restored profile would show a stale "0 keys" before the fetch runs).
    githubKeyCount:
      rog.githubUser && rog.githubFetchedFor === rog.githubUser ? rog.githubKeys.length : null,
    onChange: (next) => {
      rog.selectedKeyIds.clear();
      for (const id of next.hostKeyIds) rog.selectedKeyIds.add(id);
      rog.pastedKeys = next.pastedKeys;
      rog.githubUser = next.githubUser ?? "";
    },
    onGithubUser: (user) => {
      void fetchRogGithub(user);
    },
  });
  mount.replaceChildren(editor);
  // No SSH key on this PC yet? Offer to generate one (handler at #ssh-generate).
  if (rog.hostSshKeys.length === 0) {
    const gen = el("button", "linkbtn", "Generate a key on this PC") as HTMLButtonElement;
    gen.type = "button";
    gen.id = "ssh-generate";
    editor.prepend(gen);
  }
  // A username we haven't fetched yet (e.g. just restored from a profile) → fetch it.
  if (rog.githubUser && rog.githubFetchedFor !== rog.githubUser)
    void fetchRogGithub(rog.githubUser);
}

/** Fetch the GitHub user's public keys (baked into the build) + re-mount to show
 *  the live count. Runs on blur, so the re-mount doesn't steal focus mid-type. */
async function fetchRogGithub(user: string): Promise<void> {
  rog.githubFetchedFor = user; // set before the await so the re-mount doesn't re-trigger
  rog.githubKeys = user ? ((await window.bootible?.githubKeys?.(user)) ?? []) : [];
  mountRogSsh();
}

/** RDP is only usable on Pro (Home can't host Remote Desktop), so clear it on Home
 *  and re-mount the remote-access component (which greys the toggle out). */
function updateEditionState(): void {
  if (!currentEditionIsPro()) rog.rdp = false;
  mountRogRemoteAccess();
}

/** Fetch the host's SSH public keys and pre-select them all the first time. */
async function hydrateSshKeys(): Promise<void> {
  const api = window.bootible;
  if (!api?.getHostSshKeys) return;
  try {
    rog.hostSshKeys = await api.getHostSshKeys();
  } catch {
    rog.hostSshKeys = [];
  }
  if (!rog.sshHydrated) {
    for (const k of rog.hostSshKeys) rog.selectedKeyIds.add(k.id);
    rog.sshHydrated = true;
  }
  mountRogSsh();
  updateEditionState();
  // Learn this PC's subnet so the network editor can infer prefix/gateway/dns
  // (the user types only the host), then mount the shared NetworkSettings editor.
  if (!rog.netSuggestion && api.suggestNetwork) {
    try {
      rog.netSuggestion = await api.suggestNetwork();
    } catch {}
  }
  mountRogNetwork();
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
    rog.selectedBaseId = id;
    rog.customiseHydrated = false; // re-resolve the plan for the newly chosen base
    // Full ROG reuses the account screen for SSH/access but hides the
    // clean-install-only fields (account mode, edition, password).
    document.body.classList.toggle("is-strip", id === "full-rog");
    location.hash = "customise";
  }
});

void hydratePlatforms();

// ── module rog.catalog ────────────────────────────────────────────────────────
// The setup groups, the review plan and every module count are driven by the
// real rog.catalog the core exposes — no hardcoded "14".

const GROUP_TAGS: Record<string, string> = {
  system: "configure",
  performance: "tune",
  apps: "install",
  library: "link",
};

/** OSes provisioned via the SteamOS/Linux host-carrier flow (mirrors core's
 *  usesDeckCarrier — kept in sync; SteamOS today, Bazzite later). */
const CARRIER_OSES = new Set(["steamos"]);
function usesDeckCarrierOs(os: string): boolean {
  return CARRIER_OSES.has(os);
}
// ROG static-IP config, held in JS (the shared NetworkSettings component owns the UI).

/** (Re)mount the shared NetworkSettings editor into the ROG config screen. ROG can
 *  infer prefix/gateway/dns from this PC's subnet ("minimize typing"), so it passes
 *  `infer`; the Deck (which can't infer on-device) does not. Same component both. */
function mountRogNetwork(): void {
  const mount = document.querySelector<HTMLElement>("#static-ip-mount");
  if (!mount) return;
  const infer = rog.netSuggestion
    ? {
        prefix: rog.netSuggestion.prefix,
        gateway: rog.netSuggestion.gateway,
        dns: rog.netSuggestion.gateway,
      }
    : undefined;
  mount.replaceChildren(
    NetworkSettings({
      value: rog.staticIp,
      interfaces: ["wifi", "ethernet"],
      infer,
      onChange: (next) => {
        rog.staticIp = next;
        rog.intendedStaticIp = next?.ip ?? "";
      },
    }),
  );
}
// Review/customise + app-picker state.
let basePlan: BasePlan | null = null;
// Set by applyProfile so the next hydrateCustomise keeps the restored extras/
// disabled modules instead of resetting them for a fresh base.
// Full ROG opt-in removals (off until ticked).
let removalsCatalog: RemovalEntry[] = [];
const EMU_GROUP = "emulators";

/** Slugs of every emulator entry (so Apps vs Emulators counts can be split). */
function emulatorSlugs(): Set<string> {
  return new Set(rog.appGroups.find((g) => g.id === EMU_GROUP)?.apps.map((a) => a.id) ?? []);
}

/** Whether an emulator entry counts as "on" — winget picks live in rog.selectedApps,
 *  EmuDeck (a module) lives in rog.enabledExtras. */
function emuEntryOn(a: AppEntry): boolean {
  return a.module ? rog.enabledExtras.has(a.module) : rog.selectedApps.has(a.id);
}

/** Count of picked apps (non-emulators) and emulators, for the Review rows. */
function pickCounts(): { apps: number; emulators: number } {
  const emu = emulatorSlugs();
  const apps = [...rog.selectedApps].filter((s) => !emu.has(s)).length;
  const emuGroup = rog.appGroups.find((g) => g.id === EMU_GROUP);
  const emulators = emuGroup ? emuGroup.apps.filter(emuEntryOn).length : 0;
  return { apps, emulators };
}

/** "1 step" / "3 steps" — pluralise the step count. */

/** Render the setup screen: per group, a toggle-all header + per-module rows. */
function renderGroups(): void {
  const container = document.querySelector<HTMLElement>(".groups");
  if (!container) return;

  container.replaceChildren(
    ...rog.catalog.map((group) => {
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
  const rows = rog.catalog.map((group) => {
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
  fill("groups-summary", `${groupsOn.size} of ${rog.catalog.length} on`);
  fill("steps-summary", `${selected.length} to run`);
  updateGroupHeads();
}

async function hydrateCatalog(): Promise<void> {
  const api = window.bootible;
  if (!api?.getCatalog) return;

  try {
    rog.catalog = await api.getCatalog();
  } catch {
    return;
  }
  if (rog.catalog.length === 0) return;

  const total = rog.catalog.reduce((sum, group) => sum + group.moduleCount, 0);
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
  for (const group of rog.catalog) for (const module of group.modules) index.set(module.id, module);
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
  return rog.catalog.reduce((sum, group) => sum + group.moduleCount, 0) || provisionLines.size || 1;
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
      receiptRow("device", session.deviceName),
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
  // SSH keys = every source the SshAccessEditor collected (keys enable SSH): the
  // selected host keys, pasted keys, and the fetched GitHub keys.
  const picked = rog.hostSshKeys
    .filter((k) => rog.selectedKeyIds.has(k.id))
    .map((k) => k.publicKey);
  const sshPublicKeys = [...new Set([...picked, ...rog.pastedKeys, ...rog.githubKeys])];
  const hostname = val("#device-hostname") || undefined;
  // Static IP comes from the shared NetworkSettings component (held in rog.staticIp),
  // which already folded in the inferred prefix/gateway/dns. Drop it if no address.
  const staticIp: StaticIp | undefined = rog.staticIp?.ip ? rog.staticIp : undefined;
  rog.intendedStaticIp = staticIp?.ip ?? "";
  // When a base is chosen it defines the full module set; modifiers (the tinker
  // screen) are an explicit add-on path, not the default all-on toggles.
  // With a base chosen, the customise screen drives the extras (incl. "apps");
  // the floor/base come from baseId minus rog.disabledModules (resolved in main).
  const modules = rog.selectedBaseId ? [...rog.enabledExtras] : selectedModuleIds();
  const checked = (sel: string) => document.querySelector<HTMLInputElement>(sel)?.checked ?? false;
  const edition = checked("#edition-pro") ? "pro" : "home";
  const remoteAccess = {
    sunshine: rog.sunshineEnabled,
    moonlight: rog.moonlight,
    rdp: rog.rdp,
  };
  const remoteAccessHost = {
    sunshine: rog.sunshineHost,
    moonlight: rog.moonlightHost,
  };
  return {
    modules,
    baseId: rog.selectedBaseId || undefined,
    sshPublicKeys: sshPublicKeys.length ? sshPublicKeys : undefined,
    hostname,
    staticIp,
    edition,
    remoteAccess,
    remoteAccessHost,
    sunshineUser: rog.sunshineUser || undefined,
    // Deferred → kept off the USB (the device's sunshine-creds step skips, so the
    // user sets it via the Sunshine web UI on first run).
    sunshinePass: rog.sunshinePromptPass ? undefined : rog.sunshinePass || undefined,
    wallpaperPath: rog.wallpaperPath || undefined,
    lockscreenPath: rog.lockscreenPath || undefined,
    disabledModules: rog.disabledModules.size ? [...rog.disabledModules] : undefined,
    selectedApps: rog.selectedApps.size ? [...rog.selectedApps] : undefined,
    selectedRemovals: rog.selectedRemovals.size ? [...rog.selectedRemovals] : undefined,
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
    deviceModel: session.deviceId || undefined,
    baseId: rog.selectedBaseId || undefined,
    ui: {
      selectedApps: [...rog.selectedApps],
      selectedRemovals: [...rog.selectedRemovals],
      enabledExtras: [...rog.enabledExtras],
      disabledModules: [...rog.disabledModules],
      selectedKeyIds: [...rog.selectedKeyIds],
      githubUser: rog.githubUser,
      sshPaste: rog.pastedKeys.join("\n"),
      hostname: fv("#device-hostname"),
      staticIp: rog.staticIp, // the whole {iface,ip,prefix,gateway,dns}, not just the address
      edition: fck("#edition-pro") ? "pro" : "home",
      accountMode: document.body.dataset.account ?? "local",
      acctUser: fv("#acct-user"),
      sunshineUser: rog.sunshineUser,
      sunshinePromptPass: rog.sunshinePromptPass,
      wifiSsid: fv("#wifi-ssid"),
      ra: { sunshine: rog.sunshineEnabled, moonlight: rog.moonlight, rdp: rog.rdp },
      raHost: { sunshine: rog.sunshineHost, moonlight: rog.moonlightHost },
      wallpaperPath: rog.wallpaperPath,
      lockscreenPath: rog.lockscreenPath,
    },
    secrets: {
      sunshinePass: rog.sunshinePromptPass ? "" : rog.sunshinePass,
      acctPass: fv("#acct-pass"),
      wifiPass: fv("#wifi-pass"),
    },
  };
}

/** Restore a loaded Profile into the UI (Sets, inputs, checkboxes, derived UI). */
function applyProfile(p: Profile): void {
  rog.loadedProfileName = p.name ?? "";
  const ui = (p.ui ?? {}) as Record<string, unknown>;
  const list = (k: string) => (Array.isArray(ui[k]) ? (ui[k] as string[]) : []);
  rog.selectedBaseId = p.baseId ?? "";
  const restore = (set: Set<string>, k: string) => {
    set.clear();
    for (const v of list(k)) set.add(v);
  };
  restore(rog.selectedApps, "rog.selectedApps");
  restore(rog.selectedRemovals, "rog.selectedRemovals");
  restore(rog.enabledExtras, "rog.enabledExtras");
  restore(rog.disabledModules, "rog.disabledModules");
  restore(rog.selectedKeyIds, "rog.selectedKeyIds");
  rog.githubUser = typeof ui.githubUser === "string" ? ui.githubUser : "";
  rog.pastedKeys =
    typeof ui.sshPaste === "string"
      ? ui.sshPaste
          .split("\n")
          .map((k) => k.trim())
          .filter(Boolean)
      : [];
  setV("#device-hostname", ui.hostname);
  // Restore static IP into the held config + re-mount the editor. Handles legacy
  // profiles where staticIp was just the address string + a separate staticIpIface.
  const savedIp = ui.staticIp;
  if (savedIp && typeof savedIp === "object") {
    rog.staticIp = savedIp as StaticIp;
  } else if (typeof savedIp === "string" && savedIp.trim()) {
    rog.staticIp = {
      iface: (ui.staticIpIface as "wifi" | "ethernet") || "wifi",
      ip: savedIp.trim(),
      prefix: rog.netSuggestion?.prefix ?? 24,
      gateway: rog.netSuggestion?.gateway,
      dns: rog.netSuggestion?.gateway,
    };
  } else {
    rog.staticIp = undefined;
  }
  rog.intendedStaticIp = rog.staticIp?.ip ?? "";
  mountRogNetwork();
  setCk("#edition-pro", ui.edition === "pro");
  setCk("#edition-home", ui.edition !== "pro");
  setV("#acct-user", ui.acctUser);
  setV("#wifi-ssid", ui.wifiSsid);
  rog.sunshineUser = typeof ui.sunshineUser === "string" ? ui.sunshineUser : "";
  const ra = (ui.ra ?? {}) as Record<string, unknown>;
  rog.sunshineEnabled = Boolean(ra.sunshine);
  rog.moonlight = Boolean(ra.moonlight);
  rog.rdp = Boolean(ra.rdp);
  const raHost = (ui.raHost ?? {}) as Record<string, unknown>;
  rog.sunshineHost = Boolean(raHost.sunshine);
  rog.moonlightHost = Boolean(raHost.moonlight);
  rog.sunshinePromptPass = Boolean(ui.sunshinePromptPass);
  rog.sunshinePass = rog.sunshinePromptPass ? "" : (p.secrets?.sunshinePass ?? "");
  // Edition was restored just above; clamp RDP to Pro and (re)mount both the
  // streaming + remote-access components from the restored JS state.
  updateEditionState();
  mountRogStreaming();
  setV("#acct-pass", p.secrets?.acctPass);
  setV("#wifi-pass", p.secrets?.wifiPass);
  rog.wallpaperPath = (ui.wallpaperPath as string) ?? "";
  rog.lockscreenPath = (ui.lockscreenPath as string) ?? "";
  // Show the remembered image filenames on the picker buttons (the paths are saved
  // but the labels were blank, so it looked like the images weren't remembered).
  const imgName = (p: string) => (p ? (p.split(/[\\/]/).pop() ?? p) : "");
  const wn = document.querySelector("#wallpaper-name");
  if (wn) wn.textContent = imgName(rog.wallpaperPath);
  const ln = document.querySelector("#lockscreen-name");
  if (ln) ln.textContent = imgName(rog.lockscreenPath);
  document.body.classList.toggle("is-strip", rog.selectedBaseId === "full-rog");
  // Re-fetch the restored GitHub user's keys so they're baked + counted, then
  // (re)mount the SSH editor with the restored selection.
  if (rog.githubUser) void fetchRogGithub(rog.githubUser);
  else mountRogSsh();
  rog.customiseHydrated = false; // re-resolve the plan for the restored base
  rog.keepRestoredCustomise = true; // ...but keep the restored extras/disabled modules
}

// The currently-loaded ROG profile + a status line, shown in the shared ProfileBar.

/** Render the shared ProfileBar on the ROG configure (customise) screen — same
 *  component + behaviour as the Deck. */
// Load at the start (customise) + save at the end (account). One function, two
// mounts/modes — load-only on customise, save-only on the last config page.
async function mountRogProfileBar(mode: "load" | "save"): Promise<void> {
  const mount = document.querySelector<HTMLElement>(
    mode === "load" ? "#rog-profile-load" : "#rog-profile-mount",
  );
  if (!mount) return;
  const grouped = (await window.bootible?.groupProfiles?.(session.deviceId)) ?? {
    model: [],
    family: [],
  };
  const save = async (name: string): Promise<void> => {
    const r = await window.bootible?.saveProfile?.(captureProfile(name));
    if (r?.ok) {
      rog.loadedProfileName = r.name;
      rog.profileStatus = `✓ Saved "${r.name}" to this PC`;
      void window.bootible?.cloud?.syncNow(); // push if signed in + unlocked
    } else {
      rog.profileStatus = "Save failed.";
    }
    void mountRogProfileBar("save");
  };
  mount.replaceChildren(
    ProfileBar({
      mode,
      profiles: grouped,
      modelLabel: `This ${session.deviceName || "device"}`,
      familyLabel: "Other compatible devices",
      loadedName: rog.loadedProfileName || null,
      status: rog.profileStatus,
      onLoad: async (name) => {
        const p = await window.bootible?.loadProfile?.(name);
        if (p) {
          applyProfile(p); // restores account UI (ssh/network/hostname) + marks customise stale
          rog.loadedProfileName = name;
          rog.profileStatus = `Loaded "${name}"`;
          void hydrateCustomise(); // re-render customise + the load bar with restored config
        }
      },
      onSaveNew: save,
      onUpdate: save,
      onDelete: async (name) => {
        await window.bootible?.deleteProfile?.(name);
        if (rog.loadedProfileName === name) rog.loadedProfileName = "";
        rog.profileStatus = `Deleted "${name}"`;
        void mountRogProfileBar(mode);
      },
    }),
  );
}

// Password reveal toggles (eye icon).
document.addEventListener("click", (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLElement>("[data-reveal]");
  if (!btn?.dataset.reveal) return;
  const input = document.getElementById(btn.dataset.reveal) as HTMLInputElement | null;
  if (input) input.type = input.type === "password" ? "text" : "password";
});

// ── in-app USB writer screen ────────────────────────────────────────────────

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
      rog.usbState.isoId = langs[0].isoId;
      rog.usbState.isoPath = "";
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
    if (regions[0]) rog.usbState.regionId = regions[0].id;
  }

  await refreshDisks();
  updateWriteButton();
}

// The three "choose a USB drive" steps share one DiskPicker (ROG install + Deck
// reimage flash by whole-disk NUMBER; Deck provision copies to a drive LETTER).
let usbDiskPicker: ReturnType<typeof DiskPicker> | null = null;
async function refreshDisks(): Promise<void> {
  const list = document.querySelector<HTMLElement>("#disk-list");
  if (!list) return;
  if (!usbDiskPicker) {
    usbDiskPicker = DiskPicker({
      fetch: async () => (await window.bootible?.getUsbDisks?.()) ?? [],
      mode: "number",
      selected: String(rog.usbState.disk),
      onSelect: (k) => {
        rog.usbState.disk = Number(k);
        updateWriteButton();
      },
    });
    list.replaceChildren(usbDiskPicker.root);
  }
  await usbDiskPicker.refresh();
}

function updateWriteButton(): void {
  const btn = document.querySelector<HTMLButtonElement>("#usb-write-btn");
  const confirmed = document.querySelector<HTMLInputElement>("#erase-confirm")?.checked ?? false;
  const hasIso = Boolean(rog.usbState.isoId || rog.usbState.isoPath);
  if (btn) btn.disabled = !(confirmed && hasIso && rog.usbState.disk >= 0);
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
    diskNumber: rog.usbState.disk,
    isoPath: rog.usbState.isoPath || undefined,
    isoId: rog.usbState.isoId || undefined,
    regionId: rog.usbState.regionId || undefined,
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
      if (d.mine && rog.intendedStaticIp) {
        const ok = d.ip === rog.intendedStaticIp;
        card.append(
          el(
            "div",
            `watch-reconcile ${ok ? "ok" : "warn"}`,
            ok
              ? `✓ static IP ${rog.intendedStaticIp} applied`
              : `⚠ wanted ${rog.intendedStaticIp} but it's on ${d.ip} (static IP didn't take — still reachable here)`,
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
    if (isWall) rog.wallpaperPath = path;
    else rog.lockscreenPath = path;
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
    rog.usbState.isoId = (target as HTMLSelectElement).value;
    rog.usbState.isoPath = "";
    const path = document.querySelector("#iso-path");
    if (path) path.textContent = "";
  }
  if (target.id === "region-select") {
    rog.usbState.regionId = (target as HTMLSelectElement).value;
  }
  if (target instanceof HTMLInputElement && target.dataset.keyId) {
    if (target.checked) rog.selectedKeyIds.add(target.dataset.keyId);
    else rog.selectedKeyIds.delete(target.dataset.keyId);
  }
  if (target.id === "edition-home" || target.id === "edition-pro") updateEditionState();
  if (target.id === "lang-select" || target.id === "erase-confirm") updateWriteButton();
  // Customise screen: a module toggle (floor/base = untick to disable; extra = tick to add).
  if (target instanceof HTMLInputElement && target.dataset.moduleId) {
    const id = target.dataset.moduleId;
    if (target.dataset.kind === "extra") {
      if (target.checked) rog.enabledExtras.add(id);
      else rog.enabledExtras.delete(id);
    } else if (target.checked) {
      rog.disabledModules.delete(id);
    } else {
      rog.disabledModules.add(id);
    }
    renderCustomise();
  }
  // Removals checklist (Full ROG): opt-in app removals — off until ticked.
  if (target instanceof HTMLInputElement && target.dataset.removal) {
    if (target.checked) rog.selectedRemovals.add(target.dataset.removal);
    else rog.selectedRemovals.delete(target.dataset.removal);
    renderCustomise();
  }
  // The app picker (ROG apps/emulators) is the shared GroupedPicker — it owns its
  // own item/group/expand handling via callbacks (see renderApps), so there's no
  // delegated app-check/app-group-check wiring here any more.
});

// A Review picker row (Apps / Emulators) opens the picker in the right mode.
document.addEventListener("click", (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLElement>("[data-picker]");
  if (!btn) return;
  rog.pickerMode = btn.dataset.picker === "emulators" ? "emulators" : "apps";
  location.hash = "apps";
});

// "Select recommended" on the removals checklist: tick the recommended set.
document.addEventListener("click", (event) => {
  if (!(event.target as HTMLElement).closest("[data-removals-rec]")) return;
  for (const r of removalsCatalog) if (r.recommended) rog.selectedRemovals.add(r.id);
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
      rog.usbState.isoPath = picked;
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
      const created = await window.bootible?.generateHostSshKey?.(
        `${session.deviceName} via bootible`,
      );
      if (!created) return;
      if (!rog.hostSshKeys.some((k) => k.id === created.id)) rog.hostSshKeys.push(created);
      rog.selectedKeyIds.add(created.id);
      mountRogSsh();
    })();
    return;
  }

  // Disk selection is owned by the shared DiskPicker (refreshDisks).
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
    receiptRow("device", session.deviceName),
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

// Route registry — each view's on-enter handler (replaces the old syncFromHash
// if/else). Views without a handler are just shown; their interactions are wired
// by global listeners. Deck handlers come from features/deck; the rest are local.
registerRoute("platform", () => void hydratePlatforms());
registerRoute("base", () => void hydrateBases());
registerRoute("customise", () => void hydrateCustomise());
registerRoute("apps", () => void hydrateApps());
registerRoute("stripkit", () => void hydrateStripkit());
registerRoute("account", () => {
  void hydrateSshKeys();
  mountRogStreaming();
  mountRogRemoteAccess();
  void mountRogProfileBar("save"); // save on the last config page (full config)
  // Full ROG restores the factory image — it doesn't create an account, so re-word
  // the screen away from "pick how it signs in".
  const strip = rog.selectedBaseId === "full-rog";
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
});
registerRoute("review", () => {
  setApplyLabel();
  renderReviewPlan();
});
registerRoute("usbwrite", () => void hydrateUsbWrite());
registerRoute("deck", () => void hydrateDeck());
registerRoute("decksetup", () => void hydrateDeckSetup());
registerRoute("deckapps", () => void hydrateDeckApps());
registerRoute("deckemu", () => void hydrateDeckEmulators());
registerRoute("deckplugins", () => void hydrateDeckPlugins());
registerRoute("deckpm", () => void hydrateDeckPm());
registerRoute("deckwrite", () => void hydrateDeckWrite());
registerRoute("deckreimage", () => void hydrateDeckReimage());
registerRoute("watch", () => {
  void window.bootible?.startDiscovery?.();
  renderDiscovered();
});
registerRoute("provision", () => startProvision());

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
