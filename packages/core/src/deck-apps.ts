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
