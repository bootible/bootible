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
}

export interface DeckConfig {
  /** Optional hostname to set; empty/undefined keeps the current one. */
  hostname?: string;
  /** Take a btrfs snapshot of / before any change (SteamOS-safe rollback). */
  createSnapshot: boolean;
  /** Chosen Flatpak app ids (see FLATPAK_APPS in deck-apps.ts). */
  flatpakApps: string[];
  ssh: DeckSshConfig;
}

export const DEFAULT_DECK_CONFIG: DeckConfig = {
  createSnapshot: true,
  flatpakApps: ["flatseal"], // the one v1 default
  ssh: { enabled: false, port: 22, authorizedKeys: [] },
};

/** Fill any missing fields with defaults — tolerant of partial configs from the UI/carrier. */
export function normalizeDeckConfig(partial: Partial<DeckConfig> | undefined): DeckConfig {
  const p = partial ?? {};
  return {
    hostname: p.hostname?.trim() || undefined,
    createSnapshot: p.createSnapshot ?? DEFAULT_DECK_CONFIG.createSnapshot,
    flatpakApps: [...new Set(p.flatpakApps ?? DEFAULT_DECK_CONFIG.flatpakApps)],
    ssh: {
      enabled: p.ssh?.enabled ?? false,
      port: p.ssh?.port ?? 22,
      authorizedKeys: (p.ssh?.authorizedKeys ?? []).map((k) => k.trim()).filter(Boolean),
    },
  };
}
