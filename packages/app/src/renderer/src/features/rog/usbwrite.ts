import type {
  LanguageOption,
  RegionOption,
  StaticIp,
  UsbBuildRequest,
  UsbProgress,
} from "@bootible/core";
import { DiskPicker } from "../../components/DiskPicker";
import { renderProgress } from "../../components/ProgressPanel";
import { el, fill } from "../../lib/dom";
import { rog } from "../../lib/rog-state";
import { session } from "../../lib/session";
import { selectedModuleIds } from "./catalog";

// ── method actions ─────────────────────────────────────────────────────────
// The review screen's primary button is method-aware: "export" saves a config
// file; "run on device" (and, for now, "build USB") enters the provision flow.

export function receiptRow(key: string, value: string): HTMLElement {
  const row = el("div", "rline");
  row.append(el("span", "mark"), el("span", "rkey", key), el("span", "rval", value));
  return row;
}

// The artifact "View full receipt" / "Open folder" opens (set per flow).
export let lastArtifactPath = "";

export async function runExport(): Promise<void> {
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

/** Gather the USB build inputs from the wizard's typed state (rog.*). The account
 *  screen's inputs mirror rog, so there are no DOM reads here — one typed source. */
export function gatherUsbRequest(): UsbBuildRequest {
  const account =
    rog.accountMode === "local"
      ? {
          mode: "local" as const,
          username: rog.acctUser.trim() || "ally",
          password: rog.acctPass.trim() || undefined,
        }
      : { mode: "microsoft" as const };
  const ssid = rog.wifiSsid.trim();
  const wifi = ssid ? { ssid, password: rog.wifiPass.trim() } : undefined;
  // SSH keys = every source the SshAccessEditor collected (keys enable SSH): the
  // selected host keys, pasted keys, and the fetched GitHub keys.
  const picked = rog.hostSshKeys
    .filter((k) => rog.selectedKeyIds.has(k.id))
    .map((k) => k.publicKey);
  const sshPublicKeys = [...new Set([...picked, ...rog.pastedKeys, ...rog.githubKeys])];
  const hostname = rog.hostname.trim() || undefined;
  // Static IP comes from the shared NetworkSettings component (held in rog.staticIp),
  // which already folded in the inferred prefix/gateway/dns. Drop it if no address.
  const staticIp: StaticIp | undefined = rog.staticIp?.ip ? rog.staticIp : undefined;
  rog.intendedStaticIp = staticIp?.ip ?? "";
  // When a base is chosen it defines the full module set; modifiers (the tinker
  // screen) are an explicit add-on path, not the default all-on toggles.
  // With a base chosen, the customise screen drives the extras (incl. "apps");
  // the floor/base come from baseId minus rog.disabledModules (resolved in main).
  const modules = rog.selectedBaseId ? [...rog.enabledExtras] : selectedModuleIds();
  const edition = rog.edition;
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

// ── in-app USB writer screen ────────────────────────────────────────────────

/** Populate the language + region dropdowns and disk list when the writer opens.
 *  The language option's value is its ISO id, so picking a language sets the
 *  download AND the answer-file UI language from one choice (they can't drift). */
export async function hydrateUsbWrite(): Promise<void> {
  const api = window.bootible;
  if (!api?.getLanguages) return;

  const lang = document.querySelector<HTMLSelectElement>("#lang-select");
  if (lang && lang.options.length === 0) {
    let langs: LanguageOption[] = [];
    try {
      langs = await api.getLanguages();
    } catch {}
    if (langs.length === 0) {
      // A silently-empty dropdown blocks the write with no explanation — the isoId
      // it should set drives the write button. Show the failure in the select.
      const opt = document.createElement("option");
      opt.textContent = "Couldn't load languages — reopen this screen";
      opt.disabled = true;
      opt.selected = true;
      lang.replaceChildren(opt);
    } else {
      lang.replaceChildren(
        ...langs.map((option) => {
          const opt = document.createElement("option");
          opt.value = option.isoId;
          opt.textContent = option.label;
          return opt;
        }),
      );
      const first = langs[0];
      if (first) {
        rog.usbState.isoId = first.isoId;
        rog.usbState.isoPath = "";
      }
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
export async function refreshDisks(): Promise<void> {
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

export function updateWriteButton(): void {
  const btn = document.querySelector<HTMLButtonElement>("#usb-write-btn");
  const confirmed = document.querySelector<HTMLInputElement>("#erase-confirm")?.checked ?? false;
  const hasIso = Boolean(rog.usbState.isoId || rog.usbState.isoPath);
  if (btn) btn.disabled = !(confirmed && hasIso && rog.usbState.disk >= 0);
}

export async function startUsbWrite(): Promise<void> {
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
  // + finish behaviour (onDeckProgress) — don't double-handle them here. Since the
  // tabbed-build merge the Deck build screen is the single "deckbuild" view.
  if (document.body.dataset.view === "deckbuild") return;
  renderProgress("uw", event, "Done — boot the Ally from the stick.");
  // Stay on the build screen when the write finishes: the shared DeviceReach block
  // (Find my device + verify) and Eject are right there, so the user ejects and
  // watches when ready rather than being yanked to the Watch screen mid-eject.
}

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

window.bootible?.onUsbProgress?.(onUsbProgress);
