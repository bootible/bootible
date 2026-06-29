/**
 * The portable Steam Deck / SteamOS provisioning config — the v2 successor to the
 * v1 Ansible `config.yml`. The desktop app generates one of these from the user's
 * choices; it's carried on the USB `BOOTIBLE` partition and consumed on-device by
 * the generated provision script (see deck-provision.ts). Only Flatpak/system
 * actions that survive SteamOS updates are modelled.
 *
 * This slice covers the base scaffold + Flatpak apps + SSH. Later slices extend
 * it (Decky + plugins, Proton tools, EmuDeck, Tailscale, Sunshine, Waydroid,
 * SD-card) — add fields here as the generator grows.
 */
export interface DeckSshConfig {
  enabled: boolean;
  /** SSH port; 22 unless the user changes it. */
  port: number;
  /** Public keys to authorise (carried on the USB, written to authorized_keys). */
  authorizedKeys: string[];
  /** Optional GitHub username — its public keys (github.com/<user>.keys) are
   *  fetched on-device and added to authorized_keys (parity with the ROG flow). */
  githubUser?: string;
}

import { RECOMMENDED_DECKY_PLUGINS } from "./deck-apps";
import { normalizeStaticIp, type StaticIp } from "./static-ip";

export interface DeckDeckyConfig {
  enabled: boolean;
  /** Decky plugin store names (from the live store; see fetchDeckyPlugins). */
  plugins: string[];
}

export interface DeckProtonConfig {
  /** Install the latest Proton-GE into compatibilitytools.d. */
  ge: boolean;
  protonUpQt: boolean;
  protontricks: boolean;
}

export interface DeckConfig {
  /** Optional hostname to set; empty/undefined keeps the current one. */
  hostname?: string;
  /** Take a btrfs snapshot of / before any change (SteamOS-safe rollback). */
  createSnapshot: boolean;
  /** Chosen Flatpak app ids (see FLATPAK_APPS in deck-apps.ts). */
  flatpakApps: string[];
  ssh: DeckSshConfig;
  decky: DeckDeckyConfig;
  proton: DeckProtonConfig;
  /** Stage EmuDeck (creates the Emulation tree + drops the launcher; wizard is manual). */
  emudeck: boolean;
  /** Where the Emulation tree lives. */
  emulationStorage: "auto" | "internal" | "sdcard";
  /** Sunshine game-streaming server (Moonlight client is a Flatpak app). */
  /** Sunshine game-streaming server; web-UI credentials pre-set when provided. */
  sunshine: { enabled: boolean; user?: string; pass?: string };
  vnc: boolean;
  tailscale: boolean;
  /** Stage the Waydroid installer (Android; the installer itself is interactive). */
  waydroid: boolean;
  /** Install StickDeck (use the Deck as a wireless controller for a PC). */
  stickdeck: boolean;
  passwordManagers: DeckPasswordManagerConfig;
  /** Optional fixed IP for the Wi-Fi or Ethernet connection (NetworkManager). */
  staticIp?: StaticIp;
}

export interface DeckPasswordManagerConfig {
  /** Password-manager ids (see PASSWORD_MANAGERS in deck-apps.ts). */
  managers: string[];
  /** flatpak = simpler; distrobox = full features (system auth, SSH agent). */
  method: "flatpak" | "distrobox";
}

export const DEFAULT_DECK_CONFIG: DeckConfig = {
  createSnapshot: true,
  flatpakApps: ["flatseal"], // the one v1 default
  ssh: { enabled: false, port: 22, authorizedKeys: [] },
  decky: { enabled: true, plugins: [...RECOMMENDED_DECKY_PLUGINS] },
  proton: { ge: true, protonUpQt: true, protontricks: true },
  emudeck: false,
  emulationStorage: "auto",
  sunshine: { enabled: false },
  vnc: false,
  tailscale: false,
  waydroid: false,
  stickdeck: false,
  passwordManagers: { managers: [], method: "flatpak" },
};

/** Fill any missing fields with defaults — tolerant of partial configs from the UI/carrier. */
export function normalizeDeckConfig(partial: Partial<DeckConfig> | undefined): DeckConfig {
  const p = partial ?? {};
  const d = DEFAULT_DECK_CONFIG;
  return {
    hostname: p.hostname?.trim() || undefined,
    createSnapshot: p.createSnapshot ?? d.createSnapshot,
    flatpakApps: [...new Set(p.flatpakApps ?? d.flatpakApps)],
    ssh: {
      enabled: p.ssh?.enabled ?? false,
      port: p.ssh?.port ?? 22,
      authorizedKeys: (p.ssh?.authorizedKeys ?? []).map((k) => k.trim()).filter(Boolean),
      // GitHub usernames are [A-Za-z0-9-] only — strip anything else so the value
      // is safe to embed in the on-device curl URL.
      githubUser: p.ssh?.githubUser?.trim().replace(/[^A-Za-z0-9-]/g, "") || undefined,
    },
    decky: {
      enabled: p.decky?.enabled ?? d.decky.enabled,
      plugins: [
        ...new Set(p.decky?.plugins ?? (p.decky?.enabled === false ? [] : d.decky.plugins)),
      ],
    },
    proton: {
      ge: p.proton?.ge ?? d.proton.ge,
      protonUpQt: p.proton?.protonUpQt ?? d.proton.protonUpQt,
      protontricks: p.proton?.protontricks ?? d.proton.protontricks,
    },
    emudeck: p.emudeck ?? d.emudeck,
    emulationStorage: p.emulationStorage ?? d.emulationStorage,
    sunshine: {
      enabled: p.sunshine?.enabled ?? false,
      user: p.sunshine?.user?.trim() || undefined,
      pass: p.sunshine?.pass || undefined,
    },
    vnc: p.vnc ?? d.vnc,
    tailscale: p.tailscale ?? d.tailscale,
    waydroid: p.waydroid ?? d.waydroid,
    stickdeck: p.stickdeck ?? d.stickdeck,
    passwordManagers: {
      managers: [...new Set(p.passwordManagers?.managers ?? [])],
      method: p.passwordManagers?.method ?? "flatpak",
    },
    staticIp: normalizeStaticIp(p.staticIp),
  };
}
