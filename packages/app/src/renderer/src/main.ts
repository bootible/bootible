// RECORDED REASON for >400 lines (coding-standard §4): the renderer god-file,
// deep into decomposition — 4022 → ~1245 lines and shrinking. Already carved out:
// the Deck flow (features/deck/*), the auth flow (features/auth.ts), the hash
// router (lib/router.ts), shared device context (lib/session.ts), the logo maps
// (lib/logos.ts), the ROG shared state (lib/rog-state.ts, the `rog` object), and
// the ROG screens device-pick / account / catalog / apps / customise / profiles
// (features/rog/*). What remains here is the app shell (boot, route registry,
// delegated DOM handlers, the BootibleApi typing) plus the still-to-split ROG
// screens: strip-kit, method/provisioning, USB-writer, watch + gatherUsbRequest.
// See docs/v2/standards/remediation-plan.md P3.
import "./styles.css";
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
import brandMark from "./assets/bootible-mark.png";
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
import {
  hydrateSshKeys,
  mountRogRemoteAccess,
  mountRogSsh,
  mountRogStreaming,
  updateEditionState,
} from "./features/rog/account";
import { hydrateApps } from "./features/rog/apps";
import {
  hydrateCatalog,
  renderReviewPlan,
  selectedModuleIds,
  updateSetupSummary,
} from "./features/rog/catalog";
import { hydrateCustomise, removalsCatalog, renderCustomise } from "./features/rog/customise";
import { baseCard, hydratePlatforms } from "./features/rog/device";
import { mountRogProfileBar } from "./features/rog/profiles";
import { startProvision } from "./features/rog/provision";
import {
  gatherUsbRequest,
  hydrateUsbWrite,
  lastArtifactPath,
  receiptRow,
  refreshDisks,
  runExport,
  startUsbWrite,
  updateWriteButton,
} from "./features/rog/usbwrite";
import { el, fill } from "./lib/dom";
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

void hydrateCatalog();

// Password reveal toggles (eye icon).
document.addEventListener("click", (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLElement>("[data-reveal]");
  if (!btn?.dataset.reveal) return;
  const input = document.getElementById(btn.dataset.reveal) as HTMLInputElement | null;
  if (input) input.type = input.type === "password" ? "text" : "password";
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
