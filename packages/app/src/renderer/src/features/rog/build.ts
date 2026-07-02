import { DeviceReach } from "../../components/DeviceReach";
import { fill } from "../../lib/dom";
import { rog } from "../../lib/rog-state";
import { session } from "../../lib/session";
import { hydrateStripkit } from "./stripkit";
import { hydrateUsbWrite, runExport } from "./usbwrite";
import { runApplyDevice } from "./watch";

// The unified "Set up your {device}" build screen: one tabbed view for every base.
// Clean-install bases pick Build USB / Export / Run-on-device; Full ROG picks
// Save-to-Disk / Save-to-USB (the strip kit). All the build LOGIC lives in
// usbwrite/stripkit/watch and is keyed by element id — this module only chooses
// which tabs show and hydrates the right controls.
const CLEAN_TABS = [
  { id: "usb", label: "Build USB" },
  { id: "export", label: "Export" },
  { id: "device", label: "Run on device" },
];
const STRIP_TABS = [
  { id: "skdisk", label: "Save to Disk" },
  { id: "skusb", label: "Save to USB" },
  { id: "device", label: "Run on device" },
];

function setBuildTab(mode: string): void {
  for (const tab of document.querySelectorAll<HTMLElement>("#build-tabs .sk-tab")) {
    tab.classList.toggle("is-active", tab.dataset.build === mode);
  }
  for (const pane of document.querySelectorAll<HTMLElement>("[data-build-pane]")) {
    pane.hidden = pane.dataset.buildPane !== mode;
  }
}

export function hydrateBuild(): void {
  const strip = rog.selectedBaseId === "full-rog";
  const device = session.deviceName || "device";
  fill("build-title", `Set up your ${device}`);
  fill("build-eyebrow", strip ? "Full ROG" : `Your ${device}`);
  fill(
    "build-sub",
    strip
      ? "Restore the factory image, then save the strip kit to run on it."
      : "Pick how to apply your setup — build a USB, export the config, or run it here.",
  );
  // The restore guide is Full-ROG only; the Find-my-device / verify section shows
  // for every base (both beacon on the network once they boot/finish). It's the
  // shared DeviceReach block — the Deck build screen mounts the same one.
  document.getElementById("build-restore")?.toggleAttribute("hidden", !strip);
  const verifyHost = document.getElementById("build-verify");
  if (verifyHost) {
    verifyHost.removeAttribute("hidden");
    verifyHost.replaceChildren(
      DeviceReach({
        onFindDevice: () => {
          location.hash = "watch";
        },
        onVerify: (ip, user) =>
          window.bootible?.verifyDevice?.(ip, user) ??
          Promise.resolve({ reachable: false, output: "unavailable" }),
      }),
    );
  }
  // Show the tabs for this base and select the first.
  const tabs = strip ? STRIP_TABS : CLEAN_TABS;
  const bar = document.getElementById("build-tabs");
  if (bar) {
    bar.replaceChildren(
      ...tabs.map((t, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = `sk-tab${i === 0 ? " is-active" : ""}`;
        b.dataset.build = t.id;
        b.textContent = t.label;
        return b;
      }),
    );
  }
  setBuildTab(tabs[0]?.id ?? "usb");
  // Hydrate the relevant controls (both key their DOM by id, so this is safe).
  if (strip) void hydrateStripkit();
  else void hydrateUsbWrite();
}

// Tab switching within the build screen.
document.addEventListener("click", (event) => {
  const tab = (event.target as HTMLElement).closest<HTMLElement>("#build-tabs .sk-tab");
  if (tab?.dataset.build) setBuildTab(tab.dataset.build);
});

// The Export / Run-on-device tab actions (the Build-USB tab writes via #usb-write-btn,
// the strip tabs via their own sk-* buttons — all wired in usbwrite/stripkit already).
document.getElementById("build-export-btn")?.addEventListener("click", () => void runExport());
document.getElementById("build-device-btn")?.addEventListener("click", () => void runApplyDevice());
