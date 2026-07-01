import type { DiscoveredDevice } from "@bootible/core";
import { el, fill } from "../../lib/dom";
import { rog } from "../../lib/rog-state";
import { session } from "../../lib/session";
import { gatherUsbRequest, receiptRow } from "./usbwrite";

// ── device discovery (watch screen) ─────────────────────────────────────────
const discovered = new Map<string, DiscoveredDevice>();
// Verify results survive the 5s beacon re-renders, keyed by device IP.
const verifyResults = new Map<string, { reachable: boolean; output: string; alias?: string }>();

/** Render the discovered devices, the build we just made first. */
export function renderDiscovered(): void {
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

export async function runApplyDevice(): Promise<void> {
  const api = window.bootible;
  if (!api?.applyDevice) {
    location.hash = "provision"; // browser/no-preload: fall back to the dry-run preview
    return;
  }
  // Apply the FULL chosen config (base + modifiers + removals), not just the tinker
  // module ids — so Full ROG "run on device" strips the current Windows in place,
  // and a clean-install run-on-device applies its removals/settings too. main
  // resolves modules from the request (resolveModules) + does restore points.
  const result = await api.applyDevice(gatherUsbRequest());
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
