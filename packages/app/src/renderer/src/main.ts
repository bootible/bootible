// The renderer entry / app shell. The screens it used to inline have been carved
// into focused modules: the Deck flow (features/deck/*), the auth flow
// (features/auth.ts), and the full ROG flow (features/rog/* — device, account,
// catalog, apps, customise, profiles, provision, usbwrite, stripkit, watch), over
// the shared seams lib/rog-state (the `rog` state object), lib/router, lib/dom,
// lib/logos and lib/session. What's left here is the shell: the BootibleApi IPC
// type, the delegated DOM handlers that span screens, the route registry, and the
// boot sequence. See docs/v2/standards/remediation-plan.md P3.
import "./styles.css";
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
  syncAccountInputsFromState,
  updateEditionState,
} from "./features/rog/account";
import { hydrateApps } from "./features/rog/apps";
import { hydrateBuild } from "./features/rog/build";
import { hydrateCatalog, updateSetupSummary } from "./features/rog/catalog";
import { hydrateCustomise, removalsCatalog, renderCustomise } from "./features/rog/customise";
import { baseCard, hydratePlatforms } from "./features/rog/device";
import { mountRogProfileBar } from "./features/rog/profiles";
import { startProvision } from "./features/rog/provision";
import {
  lastArtifactPath,
  refreshDisks,
  runExport,
  startUsbWrite,
  updateWriteButton,
} from "./features/rog/usbwrite";
import { renderDiscovered, runApplyDevice } from "./features/rog/watch";
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
  // Full ROG restores the factory image rather than clean-installing, so it skips
  // the WiFi pre-seed step (account → build), where build shows the strip-kit tabs.
  if (rog.selectedBaseId === "full-rog" && target === "wifi") target = "build";
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
  if (snap.dataset.account) {
    rog.accountMode = snap.dataset.account === "microsoft" ? "microsoft" : "local";
    document.body.dataset.account = rog.accountMode;
  }
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

void hydrateCatalog();

// Password reveal toggles (eye icon).
document.addEventListener("click", (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLElement>("[data-reveal]");
  if (!btn?.dataset.reveal) return;
  const input = document.getElementById(btn.dataset.reveal) as HTMLInputElement | null;
  if (input) input.type = input.type === "password" ? "text" : "password";
});

// External links open in the system browser (not a new Electron window).
document.addEventListener("click", (event) => {
  const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="http"]');
  if (!link) return;
  event.preventDefault();
  void window.bootible?.openPath?.(link.href);
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
  if (target.id === "edition-home" || target.id === "edition-pro") {
    rog.edition = target.id === "edition-pro" ? "pro" : "home";
    updateEditionState();
  }
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
registerRoute("build", () => hydrateBuild());
registerRoute("account", () => {
  syncAccountInputsFromState(); // reflect the typed rog.* fields (or a loaded profile)
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
