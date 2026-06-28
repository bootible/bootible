import type { BundleFile } from "./bundle";
import type { DeckConfig } from "./deck-config";
import { normalizeDeckConfig } from "./deck-config";
import { generateDeckProvision } from "./deck-provision";

/**
 * Assemble the files that go on the USB `BOOTIBLE` exFAT partition for a Steam
 * Deck build (the offline carrier validated on real hardware). After SteamOS is
 * installed, the user runs `bootible/provision.sh` once in Desktop Mode; it reads
 * its choices, applies them, and the README lists the few manual finish steps.
 * Paths are relative to the partition root and live under `bootible/` (matching
 * the carrier spike). The app's USB-writer writes these after appending the
 * partition; see docs/v2/linux.
 */

/** The honest "finish on the device" steps, tailored to what was enabled. */
function finishSteps(cfg: DeckConfig): string[] {
  const steps = ["Run `passwd` first if you haven't set a Deck password (needed for the script)."];
  if (cfg.decky.enabled) steps.push("Restart to Gaming Mode to see Decky (… menu → plug icon).");
  if (cfg.emudeck) steps.push("Run the EmuDeck wizard from the Desktop, then Steam ROM Manager.");
  if (cfg.sunshine) steps.push("Open Sunshine and set credentials at https://localhost:47990.");
  if (cfg.waydroid) steps.push('Run "Waydroid Installer" from the Desktop to install Android.');
  if (cfg.stickdeck) steps.push("Run StickDeck from the Desktop to use the Deck as a controller.");
  if (cfg.tailscale) steps.push("Run `tailscale up` to sign in to your VPN.");
  return steps;
}

function readme(cfg: DeckConfig): string {
  const finish = finishSteps(cfg)
    .map((s) => `  - ${s}`)
    .join("\n");
  return `bootible — Steam Deck setup

After SteamOS is installed, switch to Desktop Mode and:
  1. Open Konsole.
  2. Run:  bash /run/media/*/BOOTIBLE/bootible/provision.sh

It takes a btrfs snapshot first and installs everything via update-safe methods
(Flatpak / Proton-GE / Decky / Distrobox), so a SteamOS update won't wipe it.

Finish on the device (steps SteamOS needs a human for):
${finish}

Your exact choices are saved in config.json beside this file.
`;
}

export function buildDeckBundle(input: Partial<DeckConfig>): BundleFile[] {
  const cfg = normalizeDeckConfig(input);
  return [
    { path: "bootible/provision.sh", content: generateDeckProvision(cfg) },
    { path: "bootible/config.json", content: `${JSON.stringify(cfg, null, 2)}\n` },
    { path: "bootible/README.txt", content: readme(cfg) },
  ];
}
