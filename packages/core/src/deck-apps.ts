/**
 * Flatpak app catalog for SteamOS / Linux handhelds, ported from the v1 Ansible
 * `flatpak_apps` role. Flatpak is the install method that survives SteamOS updates.
 * The desktop app offers these by id; the generated provision script installs the
 * `ref` for each chosen id via `flatpak install --user`.
 */
export interface FlatpakApp {
  /** Stable id used in DeckConfig.flatpakApps and the UI. */
  id: string;
  /** Flathub application id (the thing actually installed). */
  ref: string;
  name: string;
  category:
    | "Communication"
    | "Media"
    | "Browser"
    | "Productivity"
    | "Utility"
    | "Gaming"
    | "Streaming"
    | "Launcher"
    | "Remote"
    | "Development";
  /** Recommended-on-by-default (only Flatseal, per v1). */
  recommended?: boolean;
  note?: string;
}

export const FLATPAK_APPS: readonly FlatpakApp[] = [
  // Communication
  { id: "discord", ref: "com.discordapp.Discord", name: "Discord", category: "Communication" },
  { id: "signal", ref: "org.signal.Signal", name: "Signal", category: "Communication" },
  { id: "telegram", ref: "org.telegram.desktop", name: "Telegram", category: "Communication" },
  { id: "slack", ref: "com.slack.Slack", name: "Slack", category: "Communication" },
  { id: "element", ref: "im.riot.Riot", name: "Element (Matrix)", category: "Communication" },
  { id: "zoom", ref: "us.zoom.Zoom", name: "Zoom", category: "Communication" },
  // Media
  { id: "spotify", ref: "com.spotify.Client", name: "Spotify", category: "Media" },
  { id: "vlc", ref: "org.videolan.VLC", name: "VLC", category: "Media" },
  { id: "plex", ref: "tv.plex.PlexDesktop", name: "Plex", category: "Media" },
  {
    id: "jellyfin",
    ref: "org.jellyfin.JellyfinDesktop", // renamed from com.github.iwalton3.jellyfin-media-player (v2.0)
    name: "Jellyfin",
    category: "Media",
  },
  // Browsers
  { id: "firefox", ref: "org.mozilla.firefox", name: "Firefox", category: "Browser" },
  { id: "chromium", ref: "org.chromium.Chromium", name: "Chromium", category: "Browser" },
  // Productivity
  { id: "obs", ref: "com.obsproject.Studio", name: "OBS Studio", category: "Productivity" },
  { id: "vscode", ref: "com.visualstudio.code", name: "VS Code", category: "Productivity" },
  {
    id: "libreoffice",
    ref: "org.libreoffice.LibreOffice",
    name: "LibreOffice",
    category: "Productivity",
  },
  { id: "gimp", ref: "org.gimp.GIMP", name: "GIMP", category: "Productivity" },
  {
    id: "thunderbird",
    ref: "org.mozilla.Thunderbird",
    name: "Thunderbird",
    category: "Productivity",
  },
  // Utilities
  {
    id: "flatseal",
    ref: "com.github.tchx84.Flatseal",
    name: "Flatseal",
    category: "Utility",
    recommended: true,
    note: "Manage Flatpak permissions — highly recommended.",
  },
  {
    id: "syncthing",
    ref: "com.github.zocker_160.SyncThingy",
    name: "Syncthing",
    category: "Utility",
  },
  {
    id: "qbittorrent",
    ref: "org.qbittorrent.qBittorrent",
    name: "qBittorrent",
    category: "Utility",
  },
  {
    id: "filezilla",
    ref: "org.filezillaproject.Filezilla",
    name: "FileZilla",
    category: "Utility",
  },
  // Remote access
  { id: "anydesk", ref: "com.anydesk.Anydesk", name: "AnyDesk", category: "Remote" },
  // Gaming streaming clients
  {
    id: "chiaki",
    ref: "io.github.streetpea.Chiaki4deck",
    name: "Chiaki4deck (PS Remote Play)",
    category: "Streaming",
  },
  {
    id: "moonlight",
    ref: "com.moonlight_stream.Moonlight",
    name: "Moonlight",
    category: "Streaming",
    note: "Stream from a PC running Sunshine.",
  },
  {
    id: "greenlight",
    ref: "io.github.unknownskl.greenlight",
    name: "Greenlight (Xbox/xCloud)",
    category: "Streaming",
  },
  // Launchers
  {
    id: "heroic",
    ref: "com.heroicgameslauncher.hgl",
    name: "Heroic (Epic/GOG)",
    category: "Launcher",
  },
  { id: "lutris", ref: "net.lutris.Lutris", name: "Lutris", category: "Launcher" },
  { id: "bottles", ref: "com.usebottles.bottles", name: "Bottles", category: "Launcher" },
  // Development
  { id: "neovim", ref: "io.neovim.nvim", name: "Neovim", category: "Development" },
] as const;

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
    pkg: "bitwarden-desktop",
    aur: true,
    bin: "bitwarden-desktop",
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
