import { el } from "../lib/dom";

export interface VerifyResult {
  reachable: boolean;
  alias?: string;
  output: string;
}

interface DeviceReachOpts {
  /** Navigate to the Watch (find-my-device) screen. */
  onFindDevice: () => void;
  /** SSH-verify the device at an address (device-appropriate command). */
  onVerify: (ip: string, user: string) => Promise<VerifyResult>;
  /** Account-name field placeholder (Windows: OOBE name · Deck: usually "deck"). */
  userPlaceholder?: string;
}

/**
 * The shared "after you write the USB" end state: find-my-device (beacon) + reach
 * it directly by address (IP / hostname / Tailscale / NordVPN Meshnet) with an SSH
 * verify. Used by BOTH build screens (ROG + Deck) so the two present the identical
 * end state. Self-contained (its own listeners, no ids) so two instances — one per
 * build screen — coexist without id collisions.
 */
export function DeviceReach(opts: DeviceReachOpts): HTMLElement {
  const root = el("div", "sk-save");

  const heading = el("p", "sk-h", "Find your device ");
  heading.append(el("span", "muted", "(once it's booted / finished)"));

  const sub = el(
    "p",
    "setup-sub",
    "When setup finishes, the device beacons on your network for ~10 minutes — open Find my device and it'll appear, no IP needed.",
  );

  const findWrap = el("div", "summary-actions");
  const findBtn = el("button", "btn-primary", "Find my device →") as HTMLButtonElement;
  findBtn.type = "button";
  findBtn.addEventListener("click", () => opts.onFindDevice());
  findWrap.append(findBtn);

  const orLine = el(
    "p",
    "setup-sub sk-or",
    "…or reach it directly by address (handy over Tailscale or NordVPN Meshnet):",
  );

  const row = el("div", "sk-verify-row");
  const userIn = el("input", "field-input sk-verify-user") as HTMLInputElement;
  userIn.type = "text";
  userIn.placeholder = opts.userPlaceholder ?? "account name (from OOBE)";
  userIn.autocomplete = "off";
  userIn.spellcheck = false;
  const ipIn = el("input", "field-input") as HTMLInputElement;
  ipIn.type = "text";
  ipIn.placeholder = "device IP, hostname, Tailscale IP or NordVPN Meshnet IP";
  ipIn.autocomplete = "off";
  ipIn.spellcheck = false;
  const verifyBtn = el("button", "btn-ghost", "Verify →") as HTMLButtonElement;
  verifyBtn.type = "button";
  row.append(userIn, ipIn, verifyBtn);

  const out = el("p", "sk-status");

  verifyBtn.addEventListener("click", () => {
    void (async () => {
      const ip = ipIn.value.trim();
      const user = userIn.value.trim();
      if (!ip) {
        out.textContent =
          "Enter the device's IP, hostname, Tailscale IP or NordVPN Meshnet IP first.";
        return;
      }
      if (!user) {
        out.textContent = "Enter the device's account name first.";
        return;
      }
      out.textContent = `Reaching ${user}@${ip} over SSH…`;
      try {
        const r = await opts.onVerify(ip, user);
        out.textContent = r.reachable
          ? `✓ Reachable${r.alias ? ` (ssh ${r.alias})` : ""} — ${r.output}`
          : `✗ Couldn't reach it: ${r.output}`;
      } catch (e) {
        out.textContent = `Verify failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    })();
  });

  root.append(heading, sub, findWrap, orLine, row, out);
  return root;
}
