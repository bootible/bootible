import type { UsbProgress } from "@bootible/core";
import { DiskPicker } from "../../components/DiskPicker";
import { renderProgress } from "../../components/ProgressPanel";
import { fill } from "../../lib/dom";
import { deckState } from "./config";

// Which Deck write is in flight, so usb:progress routes to the right pane. Both
// writers now live in the ONE tabbed #deckbuild view, so we can't derive the
// target from document.body.dataset.view any more — a started write claims it.
let activeDeckWrite: "deck" | "deckre" | null = null;

/** Export the Deck setup (provision.sh + config + README) to a folder — the ROG
 *  "Export config" equivalent. Reuses the shared done screen for the receipt. */
async function deckExport(): Promise<void> {
  const api = window.bootible;
  if (!api?.exportDeck) return;
  const result = await api.exportDeck(deckState);
  if (!result) return; // cancelled
  fill("done-eyebrow", "Exported");
  fill("done-title", "Deck setup exported");
  fill(
    "done-sub",
    `Saved to ${result.path}. Copy the bootible-deck folder onto a Deck and run bootible/provision.sh — or re-import it any time.`,
  );
  location.hash = "done";
}

document.addEventListener("click", (event) => {
  if ((event.target as HTMLElement).closest("[data-deck-export]")) void deckExport();
});

export async function hydrateDeckWrite(): Promise<void> {
  await refreshDeckDisks();
  updateDeckWriteButton();
}

let deckDisk = ""; // selected USB drive letter, e.g. "E"
let deckDiskPicker: ReturnType<typeof DiskPicker> | null = null;
async function refreshDeckDisks(): Promise<void> {
  const list = document.querySelector<HTMLElement>("#deck-disk-list");
  if (!list) return;
  if (!deckDiskPicker) {
    deckDiskPicker = DiskPicker({
      fetch: async () => (await window.bootible?.getUsbDisks?.()) ?? [],
      mode: "letter",
      selected: deckDisk,
      onSelect: (k) => {
        deckDisk = k;
        updateDeckWriteButton();
      },
    });
    list.replaceChildren(deckDiskPicker.root);
  }
  await deckDiskPicker.refresh();
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
  activeDeckWrite = "deck";
  // Retire the confirm + Write button but KEEP Eject visible for the post-write
  // end state (matches the ROG — the user still needs to safely remove the stick).
  const go = document.querySelector<HTMLElement>('[data-deckbuild-pane="provision"] .uw-go');
  go?.querySelector<HTMLElement>(".uw-confirm")?.setAttribute("hidden", "");
  go?.querySelector<HTMLElement>("#deck-write-btn")?.setAttribute("hidden", "");
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
  const pfx = activeDeckWrite;
  if (!pfx) return;
  const doneText =
    pfx === "deckre"
      ? "Done — boot the Deck from this USB and choose Reimage."
      : "Done — eject it and run bootible/provision.sh on your Deck.";
  renderProgress(pfx, event, doneText);
  // Eject lives persistently next to Write (matching the ROG) and find-my-device /
  // verify are the shared DeviceReach block — no gated done-actions row any more.
  // Release the routing claim once the write settles, so a later write on the
  // other tab can't inherit a stale target.
  if (event.status === "done" || event.status === "error") activeDeckWrite = null;
}

window.bootible?.onUsbProgress?.(onDeckProgress);

document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (target.closest("#deck-disk-refresh")) {
    void refreshDeckDisks();
    return;
  }
  // Disk selection is owned by the shared DiskPicker (refreshDeckDisks).
  if (target.closest("#deck-write-btn")) void startDeckWrite();
  if (target.closest("#deck-usb-eject")) {
    void (async () => {
      const pct = document.querySelector("#deck-pct");
      if (pct) pct.textContent = "Ejecting…";
      const r = await window.bootible?.ejectUsb?.(deckDisk);
      if (pct)
        pct.textContent = r?.ok
          ? "✓ Ejected — safe to remove."
          : "Couldn't eject — close any windows on the drive and try again.";
    })();
  }
});

document.addEventListener("change", (event) => {
  if ((event.target as HTMLElement).id === "deck-erase-confirm") updateDeckWriteButton();
});

// ── Deck full reimage (Path B) ───────────────────────────────────────────────
let deckReDisk = -1; // selected USB disk NUMBER (flash needs the whole disk)

export async function hydrateDeckReimage(): Promise<void> {
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

let deckReDiskPicker: ReturnType<typeof DiskPicker> | null = null;
async function refreshDeckReimageDisks(): Promise<void> {
  const list = document.querySelector<HTMLElement>("#deckre-disk-list");
  if (!list) return;
  if (!deckReDiskPicker) {
    deckReDiskPicker = DiskPicker({
      fetch: async () => (await window.bootible?.getUsbDisks?.()) ?? [],
      mode: "number",
      selected: deckReDisk >= 0 ? String(deckReDisk) : "",
      onSelect: (k) => {
        deckReDisk = Number(k);
        updateDeckReimageButton();
      },
    });
    list.replaceChildren(deckReDiskPicker.root);
  }
  await deckReDiskPicker.refresh();
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
  activeDeckWrite = "deckre";
  // Retire the confirm + Write button but KEEP Eject visible for the post-write
  // end state (matches the ROG — the user still needs to safely remove the stick).
  const go = document.querySelector<HTMLElement>('[data-deckbuild-pane="reimage"] .uw-go');
  go?.querySelector<HTMLElement>(".uw-confirm")?.setAttribute("hidden", "");
  go?.querySelector<HTMLElement>("#deckre-write-btn")?.setAttribute("hidden", "");
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
  // Disk selection is owned by the shared DiskPicker (refreshDeckReimageDisks).
  if (target.closest("#deckre-write-btn")) void startDeckReimage();
  // Safe-remove the reimaged stick before carrying it to the Deck. It was flashed
  // by disk NUMBER, so eject by number (the payload partition's letter is assigned
  // by Windows post-flash) — ejectUsbDisk resolves the letter server-side.
  if (target.closest("#deckre-usb-eject")) {
    void (async () => {
      if (deckReDisk < 0) return;
      document.querySelector("#deckre-progress")?.removeAttribute("hidden");
      const pct = document.querySelector("#deckre-pct");
      if (pct) pct.textContent = "Ejecting…";
      const r = await window.bootible?.ejectUsbDisk?.(deckReDisk);
      if (pct)
        pct.textContent = r?.ok
          ? "✓ Ejected — safe to remove."
          : "Couldn't eject — close any windows on the drive and try again.";
    })();
  }
});

document.addEventListener("change", (event) => {
  if ((event.target as HTMLElement).id === "deckre-erase-confirm") updateDeckReimageButton();
});
