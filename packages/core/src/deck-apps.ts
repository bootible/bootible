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
    ref: "com.github.iwalton3.jellyfin-media-player",
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
 * Decky Loader plugin catalog (from the v1 `decky_plugins` config). `storeName`
 * is the exact name in the official Decky store (plugins.deckbrew.xyz), which the
 * generated script resolves to a download hash.
 */
export interface DeckyPlugin {
  id: string;
  storeName: string;
  name: string;
  recommended?: boolean;
}

export const DECKY_PLUGINS: readonly DeckyPlugin[] = [
  {
    id: "powertools",
    storeName: "PowerTools",
    name: "PowerTools (CPU/GPU control)",
    recommended: true,
  },
  {
    id: "protondb-badges",
    storeName: "ProtonDB Badges",
    name: "ProtonDB Badges",
    recommended: true,
  },
  { id: "steamgriddb", storeName: "SteamGridDB", name: "SteamGridDB (artwork)", recommended: true },
  { id: "hltb", storeName: "HLTB for Deck", name: "HowLongToBeat" },
  { id: "playtime", storeName: "PlayTime", name: "PlayTime tracking" },
  { id: "autosuspend", storeName: "AutoSuspend", name: "AutoSuspend" },
  { id: "battery-tracker", storeName: "Battery Tracker", name: "Battery Tracker" },
  { id: "isthereanydeal", storeName: "IsThereAnyDeal for Deck", name: "IsThereAnyDeal" },
  { id: "css-loader", storeName: "CSS Loader", name: "CSS Loader (themes)" },
  { id: "animation-changer", storeName: "Animation Changer", name: "Animation Changer" },
  { id: "bluetooth", storeName: "Bluetooth", name: "Bluetooth" },
  { id: "tailscale-control", storeName: "Tailscale Control", name: "Tailscale Control" },
  { id: "kde-connect", storeName: "KDE Connect", name: "KDE Connect" },
  { id: "decky-cloud-save", storeName: "Decky Cloud Save", name: "Decky Cloud Save" },
  { id: "deckmtp", storeName: "DeckMTP", name: "DeckMTP (file transfer)" },
  { id: "autoflatpaks", storeName: "AutoFlatpaks", name: "AutoFlatpaks" },
  { id: "discord-status", storeName: "Discord Status", name: "Discord Status" },
  { id: "decky-notifications", storeName: "Decky Notifications", name: "Decky Notifications" },
  { id: "magicpods", storeName: "MagicPods", name: "MagicPods" },
] as const;

const PLUGIN_BY_ID = new Map(DECKY_PLUGINS.map((p) => [p.id, p]));

/** Resolve chosen plugin ids to their Decky store names, skipping unknown ids. */
export function deckyStoreNames(ids: readonly string[]): string[] {
  return ids.map((id) => PLUGIN_BY_ID.get(id)?.storeName).filter((n): n is string => !!n);
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
