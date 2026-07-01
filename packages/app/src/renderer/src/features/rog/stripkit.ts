import type { UsbBuildRequest, UsbDisk } from "@bootible/core";
import { el } from "../../lib/dom";
import { gatherUsbRequest } from "./usbwrite";

// ── strip kit (Full ROG): save to disk / USB, format, eject ─────────────────
// The Save-to-Disk / Save-to-USB tabs live on the unified build screen
// (features/rog/build.ts owns tab visibility); these are the actions behind them.
let skDisks: UsbDisk[] = [];
let skSelectedDisk = "";

function setSkStatus(msg: string): void {
  const s = document.querySelector("#sk-status");
  if (s) s.textContent = msg;
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

export async function hydrateStripkit(): Promise<void> {
  const api = window.bootible;
  // Tab visibility is owned by the unified build screen (features/rog/build.ts);
  // here we only load the USB media list.
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
    if (out)
      out.textContent =
        "Enter the device's IP, hostname, Tailscale IP or NordVPN Meshnet IP first.";
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

// Strip-kit clicks: the disk/usb/eject/verify buttons (tabs are the build screen's).
document.addEventListener("click", (event) => {
  const t = event.target as HTMLElement;
  if (t.closest("#sk-disk-save")) void skSaveDisk();
  else if (t.closest("#sk-usb-copy")) void skCopyUsb();
  else if (t.closest("#sk-usb-eject")) void skEject();
  else if (t.closest("#sk-usb-refresh")) void skRefresh();
  else if (t.closest("#sk-verify-btn")) void skVerify();
});

// The chosen USB drive (radio) for the copy/eject actions.
document.addEventListener("change", (event) => {
  const r = event.target as HTMLInputElement;
  if (r?.name === "sk-usb") skSelectedDisk = r.value;
});
