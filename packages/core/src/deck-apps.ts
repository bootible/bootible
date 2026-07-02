/**
 * Flatpak app catalog for SteamOS / Linux handhelds — now a DERIVED VIEW of the
 * unified CATALOG (catalog.ts). Flatpak is the install method that survives
 * SteamOS updates. The desktop app offers these by id; the generated provision
 * script installs the `ref` for each chosen id via `flatpak install --user`.
 */
import { type AppCategory, type CatalogApp, deckCatalog } from "./catalog";

export interface FlatpakApp {
  /** Stable id used in DeckConfig.flatpakApps and the UI. */
  id: string;
  /** Flathub application id (the thing actually installed). */
  ref: string;
  name: string;
  category: AppCategory;
  /** Recommended-on-by-default (only Flatseal, per v1). */
  recommended?: boolean;
  note?: string;
}

/** The Deck app catalog — derived from CATALOG (every flatpak-installable app).
 *  Password managers are excluded here: they have a dedicated Deck picker with a
 *  Flatpak/Distrobox method choice (see PASSWORD_MANAGERS), so listing them in the
 *  general apps picker too would double them up. */
export const FLATPAK_APPS: readonly FlatpakApp[] = deckCatalog()
  .filter(
    (a): a is CatalogApp & { flatpak: string } => Boolean(a.flatpak) && a.category !== "Password",
  )
  .map((a) => ({
    id: a.id,
    ref: a.flatpak,
    name: a.name,
    category: a.category,
    recommended: a.recommended,
    note: a.note,
  }));

const APP_BY_ID = new Map(FLATPAK_APPS.map((a) => [a.id, a]));

/** Resolve chosen app ids to their Flathub refs, skipping unknown ids. */
export function flatpakRefs(ids: readonly string[]): string[] {
  return ids.map((id) => APP_BY_ID.get(id)?.ref).filter((r): r is string => !!r);
}

/**
 * Decky Loader plugins. Rather than a hardcoded catalog (which rots — plugins
 * come and go, and hashes change every release), bootible **live-pulls** the
 * current list from the official store at runtime and lets the user pick. A small
 * recommended set seeds the defaults. `DeckConfig.decky.plugins` holds store
 * names (the store's `name` field), which the generated script resolves to a hash.
 */
export const DECKY_STORE_URL = "https://plugins.deckbrew.xyz/plugins";

/** Default-on picks for a new user (store names). */
export const RECOMMENDED_DECKY_PLUGINS: readonly string[] = [
  "PowerTools",
  "ProtonDB Badges",
  "SteamGridDB",
];

/** One plugin as surfaced to the picker (projected from the live store entry). */
export interface DeckyStorePlugin {
  name: string;
  author: string;
  description: string;
  tags: string[];
  version: string;
  downloads: number;
  imageUrl?: string;
}

interface RawStorePlugin {
  name?: string;
  author?: string;
  description?: string;
  tags?: string[];
  visible?: boolean;
  downloads?: number;
  image_url?: string;
  versions?: { name?: string; hash?: string }[];
}

/**
 * Fetch the live Decky plugin list for the picker. Public + unauthenticated;
 * pass a fetch impl (Electron main / tests). Hidden (visible:false) entries are
 * dropped and the list is sorted by popularity.
 */
export async function fetchDeckyPlugins(
  fetchImpl: typeof fetch = fetch,
): Promise<DeckyStorePlugin[]> {
  const res = await fetchImpl(DECKY_STORE_URL);
  if (!res.ok) throw new Error(`Decky store ${res.status}`);
  const raw = (await res.json()) as RawStorePlugin[];
  return raw
    .filter((p) => p.visible !== false && p.name)
    .map((p) => ({
      name: p.name as string,
      author: p.author ?? "",
      description: p.description ?? "",
      tags: p.tags ?? [],
      version: p.versions?.[0]?.name ?? "",
      downloads: p.downloads ?? 0,
      imageUrl: p.image_url,
    }))
    .sort((a, b) => b.downloads - a.downloads);
}

/**
 * Password managers, installable two ways (per the v1 distrobox role): as a
 * Flatpak (simple, limited) or in a Distrobox Arch container (full features —
 * system auth, SSH agent). `bin` is the binary used for which/distrobox-export.
 */
export interface PasswordManager {
  id: string;
  name: string;
  /** Flathub ref, or a full .flatpakref URL when flatpakIsRef is set (1Password). */
  flatpak: string;
  flatpakIsRef?: boolean;
  /** Distrobox package + whether it comes from the AUR (yay) vs pacman. */
  pkg: string;
  aur: boolean;
  bin: string;
}

export const PASSWORD_MANAGERS: readonly PasswordManager[] = [
  {
    id: "1password",
    name: "1Password",
    flatpak: "https://downloads.1password.com/linux/flatpak/1Password.flatpakref",
    flatpakIsRef: true,
    pkg: "1password",
    aur: true,
    bin: "1password",
  },
  {
    id: "bitwarden",
    name: "Bitwarden",
    flatpak: "com.bitwarden.desktop",
    // `bitwarden-desktop` doesn't exist on Arch; the desktop client is `bitwarden`
    // in the official extra repo (yay resolves it fine). The old name failed on a
    // real Deck run with "No AUR package found for bitwarden-desktop".
    pkg: "bitwarden",
    aur: true,
    bin: "bitwarden",
  },
  {
    id: "keepassxc",
    name: "KeePassXC",
    flatpak: "org.keepassxc.KeePassXC",
    pkg: "keepassxc",
    aur: false,
    bin: "keepassxc",
  },
  {
    id: "protonpass",
    name: "Proton Pass",
    flatpak: "me.proton.Pass",
    pkg: "proton-pass",
    aur: true,
    bin: "proton-pass",
  },
] as const;

const PM_BY_ID = new Map(PASSWORD_MANAGERS.map((p) => [p.id, p]));

/** Resolve chosen password-manager ids, skipping unknown ids. */
export function passwordManagers(ids: readonly string[]): PasswordManager[] {
  return ids.map((id) => PM_BY_ID.get(id)).filter((p): p is PasswordManager => !!p);
}
