/**
 * The unified device catalog — one entry per app, carrying how it installs on
 * EACH platform it supports. Presence of an install method = availability on that
 * platform: a `winget` makes it a Windows app, a `flatpak` makes it a Steam Deck
 * app, a `module` is a bootible-managed install (e.g. EmuDeck) available wherever
 * the module runs. The per-device pickers are derived from this (see
 * windowsCatalog / deckCatalog), so adding an app once surfaces it on every
 * platform that can run it. See docs/v2/design-unified-catalog.md.
 *
 * Every winget id is from the existing Windows catalog; every flatpak ref is
 * verified live on Flathub (2026-06). Apps with only one method are genuinely
 * single-platform (PowerToys = Windows-only; RetroDeck = Linux-only).
 */

export type AppCategory =
  | "Utility"
  | "Browser"
  | "Communication"
  | "Media"
  | "AI"
  | "Launcher"
  | "Streaming"
  | "Emulator"
  | "Controller"
  | "Dev"
  | "Productivity"
  | "Network"
  | "Remote"
  | "Password";

export interface CatalogApp {
  /** Stable slug shared across platforms + used in config selections. */
  id: string;
  name: string;
  category: AppCategory;
  desc?: string;
  note?: string;
  /** Pre-ticked when its group is enabled (the v1 recommended set). */
  recommended?: boolean;
  /** Windows install via winget (or the Microsoft Store for product-id apps). */
  winget?: { id: string; source?: "msstore" };
  /** Steam Deck install via `flatpak install --user <ref>`. */
  flatpak?: string;
  /** A bootible-managed install instead of a single package (e.g. EmuDeck). When
   *  set without winget/flatpak, the app is available on both platforms. */
  module?: string;
}

export const CATALOG: readonly CatalogApp[] = [
  // ── Utilities ──────────────────────────────────────────────────────────────
  {
    id: "powertoys",
    name: "PowerToys",
    category: "Utility",
    recommended: true,
    winget: { id: "Microsoft.PowerToys" },
  },
  {
    id: "7zip",
    name: "7-Zip",
    category: "Utility",
    recommended: true,
    winget: { id: "7zip.7zip" },
  },
  {
    id: "everything",
    name: "Everything",
    category: "Utility",
    recommended: true,
    winget: { id: "voidtools.Everything" },
  },
  {
    id: "terminal",
    name: "Windows Terminal",
    category: "Utility",
    recommended: true,
    winget: { id: "Microsoft.WindowsTerminal" },
  },
  {
    id: "pwsh7",
    name: "PowerShell 7",
    category: "Utility",
    winget: { id: "Microsoft.PowerShell" },
  },
  {
    id: "flatseal",
    name: "Flatseal",
    category: "Utility",
    recommended: true,
    flatpak: "com.github.tchx84.Flatseal",
    note: "Manage Flatpak permissions — highly recommended.",
  },
  {
    id: "syncthing",
    name: "Syncthing",
    category: "Utility",
    flatpak: "com.github.zocker_160.SyncThingy",
  },
  {
    id: "qbittorrent",
    name: "qBittorrent",
    category: "Utility",
    flatpak: "org.qbittorrent.qBittorrent",
  },
  {
    id: "filezilla",
    name: "FileZilla",
    category: "Utility",
    flatpak: "org.filezillaproject.Filezilla",
  },

  // ── Browsers (Chrome replaces Chromium; both sides match) ────────────────────
  {
    id: "firefox",
    name: "Firefox",
    category: "Browser",
    winget: { id: "Mozilla.Firefox" },
    flatpak: "org.mozilla.firefox",
  },
  {
    id: "chrome",
    name: "Chrome",
    category: "Browser",
    winget: { id: "Google.Chrome" },
    flatpak: "com.google.Chrome",
  },
  {
    id: "opera",
    name: "Opera",
    category: "Browser",
    winget: { id: "Opera.Opera" },
    flatpak: "com.opera.Opera",
  },

  // ── Communication ────────────────────────────────────────────────────────────
  {
    id: "discord",
    name: "Discord",
    category: "Communication",
    winget: { id: "Discord.Discord" },
    flatpak: "com.discordapp.Discord",
  },
  {
    id: "signal",
    name: "Signal",
    category: "Communication",
    winget: { id: "OpenWhisperSystems.Signal" },
    flatpak: "org.signal.Signal",
  },
  {
    id: "telegram",
    name: "Telegram",
    category: "Communication",
    winget: { id: "Telegram.TelegramDesktop" },
    flatpak: "org.telegram.desktop",
  },
  { id: "slack", name: "Slack", category: "Communication", flatpak: "com.slack.Slack" },
  { id: "element", name: "Element (Matrix)", category: "Communication", flatpak: "im.riot.Riot" },
  { id: "zoom", name: "Zoom", category: "Communication", flatpak: "us.zoom.Zoom" },

  // ── Media ────────────────────────────────────────────────────────────────────
  {
    id: "vlc",
    name: "VLC",
    category: "Media",
    winget: { id: "VideoLAN.VLC" },
    flatpak: "org.videolan.VLC",
  },
  {
    id: "spotify",
    name: "Spotify",
    category: "Media",
    winget: { id: "Spotify.Spotify" },
    flatpak: "com.spotify.Client",
  },
  {
    id: "applemusic",
    name: "Apple Music",
    category: "Media",
    winget: { id: "9PFHDD62MXS1", source: "msstore" },
  },
  {
    id: "plex",
    name: "Plex",
    category: "Media",
    winget: { id: "XP9CDQW6ML4NQN", source: "msstore" },
    flatpak: "tv.plex.PlexDesktop",
  },
  {
    id: "jellyfin",
    name: "Jellyfin",
    category: "Media",
    winget: { id: "Jellyfin.JellyfinMediaPlayer" },
    flatpak: "org.jellyfin.JellyfinDesktop",
  },

  // ── AI ───────────────────────────────────────────────────────────────────────
  { id: "claude", name: "Claude", category: "AI", winget: { id: "Anthropic.Claude" } },
  {
    id: "chatgpt",
    name: "ChatGPT",
    category: "AI",
    winget: { id: "9NT1R1C2HH7J", source: "msstore" },
  },

  // ── Game launchers ───────────────────────────────────────────────────────────
  // Steam is winget-only: on a Steam Deck it IS the OS, so we never offer a Steam
  // Flatpak there.
  {
    id: "steam",
    name: "Steam",
    category: "Launcher",
    recommended: true,
    winget: { id: "Valve.Steam" },
  },
  { id: "gog", name: "GOG Galaxy", category: "Launcher", winget: { id: "GOG.Galaxy" } },
  {
    id: "epic",
    name: "Epic Games Launcher",
    category: "Launcher",
    winget: { id: "EpicGames.EpicGamesLauncher" },
  },
  { id: "ea", name: "EA App", category: "Launcher", winget: { id: "ElectronicArts.EADesktop" } },
  {
    id: "ubisoft",
    name: "Ubisoft Connect",
    category: "Launcher",
    winget: { id: "Ubisoft.Connect" },
  },
  { id: "amazon", name: "Amazon Games", category: "Launcher", winget: { id: "Amazon.Games" } },
  { id: "playnite", name: "Playnite", category: "Launcher", winget: { id: "Playnite.Playnite" } },
  {
    id: "heroic",
    name: "Heroic (Epic / GOG)",
    category: "Launcher",
    flatpak: "com.heroicgameslauncher.hgl",
  },
  { id: "lutris", name: "Lutris", category: "Launcher", flatpak: "net.lutris.Lutris" },
  { id: "bottles", name: "Bottles", category: "Launcher", flatpak: "com.usebottles.bottles" },

  // ── Game streaming ───────────────────────────────────────────────────────────
  {
    id: "moonlight",
    name: "Moonlight (client)",
    category: "Streaming",
    winget: { id: "MoonlightGameStreamingProject.Moonlight" },
    flatpak: "com.moonlight_stream.Moonlight",
  },
  {
    id: "sunshine",
    name: "Sunshine (server)",
    category: "Streaming",
    winget: { id: "LizardByte.Sunshine" },
    flatpak: "dev.lizardbyte.app.Sunshine",
  },
  { id: "parsec", name: "Parsec", category: "Streaming", winget: { id: "Parsec.Parsec" } },
  { id: "steamlink", name: "Steam Link", category: "Streaming", winget: { id: "Valve.SteamLink" } },
  {
    id: "chiaki",
    name: "Chiaki-ng (PlayStation)",
    category: "Streaming",
    winget: { id: "Streetpea.Chiaki-ng" },
    flatpak: "io.github.streetpea.Chiaki4deck",
  },
  {
    id: "geforcenow",
    name: "GeForce NOW",
    category: "Streaming",
    winget: { id: "NVIDIA.GeForceNow" },
  },
  {
    id: "greenlight",
    name: "Greenlight (Xbox / xCloud)",
    category: "Streaming",
    flatpak: "io.github.unknownskl.greenlight",
  },

  // ── Emulators (EmuDeck default; RetroDeck Deck-only) ─────────────────────────
  {
    id: "emudeck",
    name: "EmuDeck",
    category: "Emulator",
    recommended: true,
    module: "emudeck",
    desc: "Manager — sets up emulators, cores & folders for you",
  },
  {
    id: "retrodeck",
    name: "RetroDeck",
    category: "Emulator",
    flatpak: "net.retrodeck.retrodeck",
    desc: "All-in-one emulation suite (Linux only)",
  },
  {
    id: "retroarch",
    name: "RetroArch",
    category: "Emulator",
    winget: { id: "Libretro.RetroArch" },
    flatpak: "org.libretro.RetroArch",
    desc: "Multi-system frontend + cores",
  },
  {
    id: "esde",
    name: "ES-DE",
    category: "Emulator",
    winget: { id: "ES-DE.EmulationStation-DE" },
    desc: "EmulationStation frontend (left Flathub in 2024)",
  },
  {
    id: "dolphin",
    name: "Dolphin (GameCube / Wii)",
    category: "Emulator",
    winget: { id: "DolphinEmulator.Dolphin" },
    flatpak: "org.DolphinEmu.dolphin-emu",
  },
  {
    id: "pcsx2",
    name: "PCSX2 (PS2)",
    category: "Emulator",
    winget: { id: "PCSX2Team.PCSX2" },
    flatpak: "net.pcsx2.PCSX2",
  },
  {
    id: "ppsspp",
    name: "PPSSPP (PSP)",
    category: "Emulator",
    winget: { id: "PPSSPPTeam.PPSSPP" },
    flatpak: "org.ppsspp.PPSSPP",
  },
  {
    id: "duckstation",
    name: "DuckStation (PS1)",
    category: "Emulator",
    winget: { id: "Stenzek.DuckStation" },
    flatpak: "org.duckstation.DuckStation",
  },
  {
    id: "cemu",
    name: "Cemu (Wii U)",
    category: "Emulator",
    winget: { id: "Cemu.Cemu" },
    flatpak: "info.cemu.Cemu",
  },
  {
    id: "mgba",
    name: "mGBA (Game Boy Advance)",
    category: "Emulator",
    winget: { id: "JeffreyPfau.mGBA" },
    flatpak: "io.mgba.mGBA",
  },
  {
    id: "melonds",
    name: "melonDS (Nintendo DS)",
    category: "Emulator",
    winget: { id: "melonDS.melonDS" },
    flatpak: "net.kuribo64.melonDS",
  },

  // ── Controller & modding ─────────────────────────────────────────────────────
  {
    id: "handheldcompanion",
    name: "Handheld Companion",
    category: "Controller",
    winget: { id: "BenjaminLSR.HandheldCompanion" },
  },
  { id: "hidhide", name: "HidHide", category: "Controller", winget: { id: "Nefarius.HidHide" } },
  {
    id: "razersynapse",
    name: "Razer Synapse 4",
    category: "Controller",
    winget: { id: "RazerInc.RazerInstaller.Synapse4" },
  },
  {
    id: "8bitdo",
    name: "8BitDo Ultimate Software",
    category: "Controller",
    winget: { id: "8BitDo.UltimateSoftwareV2" },
  },
  {
    id: "vortex",
    name: "Vortex Mod Manager",
    category: "Controller",
    winget: { id: "NexusMods.Vortex" },
  },
  {
    id: "curseforge",
    name: "CurseForge",
    category: "Controller",
    winget: { id: "Overwolf.CurseForge" },
  },
  {
    id: "modrinth",
    name: "Modrinth",
    category: "Controller",
    winget: { id: "Modrinth.ModrinthApp" },
  },

  // ── Dev tools ────────────────────────────────────────────────────────────────
  { id: "git", name: "Git", category: "Dev", winget: { id: "Git.Git" } },
  { id: "python", name: "Python 3.12", category: "Dev", winget: { id: "Python.Python.3.12" } },
  { id: "node", name: "Node.js LTS", category: "Dev", winget: { id: "OpenJS.NodeJS.LTS" } },
  {
    id: "java",
    name: "Java (Temurin 21)",
    category: "Dev",
    winget: { id: "EclipseAdoptium.Temurin.21.JDK" },
  },
  {
    id: "vscode",
    name: "VS Code",
    category: "Dev",
    winget: { id: "Microsoft.VisualStudioCode" },
    flatpak: "com.visualstudio.code",
  },
  {
    id: "obs",
    name: "OBS Studio",
    category: "Dev",
    winget: { id: "OBSProject.OBSStudio" },
    flatpak: "com.obsproject.Studio",
  },
  { id: "neovim", name: "Neovim", category: "Dev", flatpak: "io.neovim.nvim" },

  // ── Productivity ─────────────────────────────────────────────────────────────
  {
    id: "libreoffice",
    name: "LibreOffice",
    category: "Productivity",
    flatpak: "org.libreoffice.LibreOffice",
  },
  { id: "gimp", name: "GIMP", category: "Productivity", flatpak: "org.gimp.GIMP" },
  {
    id: "thunderbird",
    name: "Thunderbird",
    category: "Productivity",
    flatpak: "org.mozilla.Thunderbird",
  },

  // ── Network & VPN ────────────────────────────────────────────────────────────
  {
    id: "tailscale",
    name: "Tailscale",
    category: "Network",
    winget: { id: "Tailscale.Tailscale" },
  },
  { id: "protonvpn", name: "ProtonVPN", category: "Network", winget: { id: "Proton.ProtonVPN" } },
  { id: "nordvpn", name: "NordVPN", category: "Network", winget: { id: "NordSecurity.NordVPN" } },
  {
    id: "expressvpn",
    name: "ExpressVPN",
    category: "Network",
    winget: { id: "ExpressVPN.ExpressVPN" },
  },
  {
    id: "surfshark",
    name: "Surfshark",
    category: "Network",
    winget: { id: "Surfshark.Surfshark" },
  },
  {
    id: "cyberghost",
    name: "CyberGhost",
    category: "Network",
    winget: { id: "CyberGhost.CyberGhost" },
  },
  {
    id: "tunnelbear",
    name: "TunnelBear",
    category: "Network",
    winget: { id: "TunnelBear.TunnelBear" },
  },

  // ── Remote access ────────────────────────────────────────────────────────────
  { id: "anydesk", name: "AnyDesk", category: "Remote", flatpak: "com.anydesk.Anydesk" },

  // ── Password managers ────────────────────────────────────────────────────────
  {
    id: "1password",
    name: "1Password",
    category: "Password",
    winget: { id: "AgileBits.1Password" },
    flatpak: "com.onepassword.OnePassword",
  },
  {
    id: "bitwarden",
    name: "Bitwarden",
    category: "Password",
    winget: { id: "Bitwarden.Bitwarden" },
    flatpak: "com.bitwarden.desktop",
  },
  {
    id: "keepassxc",
    name: "KeePassXC",
    category: "Password",
    winget: { id: "KeePassXCTeam.KeePassXC" },
    flatpak: "org.keepassxc.KeePassXC",
  },
  { id: "protonpass", name: "Proton Pass", category: "Password", flatpak: "me.proton.Pass" },
] as const;

/** True when the app runs on Windows (has a winget install or a module). */
export function onWindows(app: CatalogApp): boolean {
  return Boolean(app.winget) || Boolean(app.module);
}

/** True when the app runs on SteamOS (has a flatpak install or a module). */
export function onSteamOS(app: CatalogApp): boolean {
  return Boolean(app.flatpak) || Boolean(app.module);
}

/** The Windows-installable apps. */
export function windowsCatalog(): CatalogApp[] {
  return CATALOG.filter(onWindows);
}

/** The SteamOS-installable apps. */
export function deckCatalog(): CatalogApp[] {
  return CATALOG.filter(onSteamOS);
}

/** Look up a catalog entry by id. */
export function catalogApp(id: string): CatalogApp | undefined {
  return CATALOG.find((a) => a.id === id);
}

export interface CategoryMeta {
  /** Stable group id the renderer keys collapse-state + the Emulators picker off. */
  id: string;
  label: string;
  /** Shared footnote (only used where it's true on every platform the group shows on). */
  note?: string;
}

/** Per-category display metadata for the grouped pickers, in display order. */
export const CATEGORY_META: Record<AppCategory, CategoryMeta> = {
  Utility: { id: "utilities", label: "Desktop utilities" },
  Browser: { id: "browsers", label: "Browsers" },
  Communication: { id: "comms", label: "Communication" },
  Media: { id: "media", label: "Media" },
  AI: {
    id: "ai",
    label: "AI tools",
    note: "Gemini is browser-only — Google ships no desktop app.",
  },
  Launcher: { id: "launchers", label: "Game launchers" },
  Streaming: { id: "streaming", label: "Game streaming" },
  Emulator: {
    id: "emulators",
    label: "Emulators",
    note: "Emulators only — bring your own legally-owned, first-party backups.",
  },
  Controller: { id: "controller", label: "Controller & modding" },
  Dev: { id: "dev", label: "Dev tools" },
  Productivity: { id: "productivity", label: "Productivity" },
  Network: { id: "network", label: "Network & VPN" },
  Remote: { id: "remote", label: "Remote access" },
  Password: { id: "passwords", label: "Password managers" },
};

export const CATEGORY_ORDER: AppCategory[] = [
  "Utility",
  "Browser",
  "Communication",
  "Media",
  "AI",
  "Launcher",
  "Streaming",
  "Emulator",
  "Controller",
  "Dev",
  "Productivity",
  "Network",
  "Remote",
  "Password",
];

export interface CategoryGroup {
  category: AppCategory;
  meta: CategoryMeta;
  apps: CatalogApp[];
}

/** Group catalog apps by category, in CATEGORY_ORDER, dropping empty categories. */
export function groupByCategory(apps: CatalogApp[]): CategoryGroup[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    meta: CATEGORY_META[category],
    apps: apps.filter((a) => a.category === category),
  })).filter((g) => g.apps.length > 0);
}
