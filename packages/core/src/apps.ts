// The supported-app catalog for the app-picker screen, sourced from the v1
// installer modules (config/rog-ally/modules/*.ps1). Individual apps grouped
// into collapsible sections; the user ticks a whole group or single apps, and
// each selected app becomes a winget install on the device. CCleaner and
// DriverEasy were intentionally dropped (junkware; drivers come from WU).

import { getWingetInstallCommands } from "./winget";

export interface AppEntry {
  /** Stable slug used in config (settings.selected_apps). */
  id: string;
  name: string;
  /** winget package id installed on the device. Omitted for entries that are
   *  driven by a bootible module instead (e.g. EmuDeck — see `module`). */
  wingetId?: string;
  /** A bootible module id this entry enables instead of a winget install (for
   *  managers like EmuDeck that aren't a single package). */
  module?: string;
  /** Install source — omit for the default winget source; "msstore" for
   *  Microsoft Store-only apps (product-id installs). */
  source?: "msstore";
  /** Short note shown under the entry. */
  desc?: string;
  /** On by default when its group is enabled (the v1 recommended set). */
  recommended?: boolean;
}

export interface AppGroup {
  id: string;
  label: string;
  apps: AppEntry[];
  /** Optional footnote shown under the group (e.g. "no desktop app" cases). */
  note?: string;
}

export const APP_GROUPS: AppGroup[] = [
  {
    id: "utilities",
    label: "Desktop utilities",
    apps: [
      { id: "powertoys", name: "PowerToys", wingetId: "Microsoft.PowerToys", recommended: true },
      { id: "7zip", name: "7-Zip", wingetId: "7zip.7zip", recommended: true },
      { id: "everything", name: "Everything", wingetId: "voidtools.Everything", recommended: true },
      {
        id: "terminal",
        name: "Windows Terminal",
        wingetId: "Microsoft.WindowsTerminal",
        recommended: true,
      },
      { id: "pwsh7", name: "PowerShell 7", wingetId: "Microsoft.PowerShell" },
    ],
  },
  {
    // Edge ships with Windows; install another and set it as default. Safari has
    // had no Windows version since 2012.
    id: "browsers",
    label: "Browsers",
    apps: [
      { id: "firefox", name: "Firefox", wingetId: "Mozilla.Firefox" },
      { id: "chrome", name: "Chrome", wingetId: "Google.Chrome" },
      { id: "opera", name: "Opera", wingetId: "Opera.Opera" },
    ],
    note: "Edge comes with Windows. Install another browser and set it as default.",
  },
  {
    id: "comms",
    label: "Communication",
    apps: [
      { id: "discord", name: "Discord", wingetId: "Discord.Discord" },
      { id: "signal", name: "Signal", wingetId: "OpenWhisperSystems.Signal" },
      { id: "telegram", name: "Telegram", wingetId: "Telegram.TelegramDesktop" },
    ],
  },
  {
    id: "media",
    label: "Media",
    apps: [
      { id: "vlc", name: "VLC", wingetId: "VideoLAN.VLC" },
      { id: "spotify", name: "Spotify", wingetId: "Spotify.Spotify" },
      { id: "applemusic", name: "Apple Music", wingetId: "9PFHDD62MXS1", source: "msstore" },
    ],
  },
  {
    id: "ai",
    label: "AI tools",
    apps: [
      { id: "claude", name: "Claude", wingetId: "Anthropic.Claude" },
      { id: "chatgpt", name: "ChatGPT", wingetId: "9NT1R1C2HH7J", source: "msstore" },
    ],
    note: "Gemini is browser-only — Google ships no desktop app.",
  },
  {
    id: "launchers",
    label: "Game launchers",
    apps: [
      { id: "steam", name: "Steam", wingetId: "Valve.Steam", recommended: true },
      { id: "gog", name: "GOG Galaxy", wingetId: "GOG.Galaxy" },
      { id: "epic", name: "Epic Games Launcher", wingetId: "EpicGames.EpicGamesLauncher" },
      { id: "ea", name: "EA App", wingetId: "ElectronicArts.EADesktop" },
      { id: "ubisoft", name: "Ubisoft Connect", wingetId: "Ubisoft.Connect" },
      { id: "amazon", name: "Amazon Games", wingetId: "Amazon.Games" },
      { id: "playnite", name: "Playnite", wingetId: "Playnite.Playnite" },
    ],
  },
  {
    id: "streaming",
    label: "Game streaming",
    apps: [
      {
        id: "moonlight",
        name: "Moonlight (client)",
        wingetId: "MoonlightGameStreamingProject.Moonlight",
      },
      { id: "sunshine", name: "Sunshine (server)", wingetId: "LizardByte.Sunshine" },
      { id: "parsec", name: "Parsec", wingetId: "Parsec.Parsec" },
      { id: "steamlink", name: "Steam Link", wingetId: "Valve.SteamLink" },
      { id: "chiaki", name: "Chiaki-ng (PlayStation)", wingetId: "Streetpea.Chiaki-ng" },
      { id: "geforcenow", name: "GeForce NOW", wingetId: "NVIDIA.GeForceNow" },
    ],
  },
  {
    id: "controller",
    label: "Controller & modding",
    apps: [
      {
        id: "handheldcompanion",
        name: "Handheld Companion",
        wingetId: "BenjaminLSR.HandheldCompanion",
      },
      { id: "hidhide", name: "HidHide", wingetId: "Nefarius.HidHide" },
      { id: "ds4windows", name: "DS4Windows", wingetId: "Ryochan7.DS4Windows" },
      { id: "razersynapse", name: "Razer Synapse 4", wingetId: "RazerInc.RazerInstaller.Synapse4" },
      { id: "8bitdo", name: "8BitDo Ultimate Software", wingetId: "8BitDo.UltimateSoftwareV2" },
      { id: "vortex", name: "Vortex Mod Manager", wingetId: "NexusMods.Vortex" },
      { id: "curseforge", name: "CurseForge", wingetId: "Overwolf.CurseForge" },
      { id: "modrinth", name: "Modrinth", wingetId: "Modrinth.ModrinthApp" },
    ],
  },
  {
    id: "emulators",
    label: "Emulators",
    apps: [
      {
        id: "emudeck",
        name: "EmuDeck",
        module: "emudeck",
        desc: "Manager — sets up emulators, cores & folders for you",
      },
      {
        id: "retroarch",
        name: "RetroArch",
        wingetId: "Libretro.RetroArch",
        desc: "Multi-system frontend + cores",
      },
      {
        id: "esde",
        name: "ES-DE",
        wingetId: "ES-DE.EmulationStation-DE",
        desc: "EmulationStation frontend",
      },
      { id: "dolphin", name: "Dolphin (GameCube / Wii)", wingetId: "DolphinEmulator.Dolphin" },
      { id: "pcsx2", name: "PCSX2 (PS2)", wingetId: "PCSX2Team.PCSX2" },
      { id: "ppsspp", name: "PPSSPP (PSP)", wingetId: "PPSSPPTeam.PPSSPP" },
      { id: "duckstation", name: "DuckStation (PS1)", wingetId: "Stenzek.DuckStation" },
      { id: "cemu", name: "Cemu (Wii U)", wingetId: "Cemu.Cemu" },
      { id: "mgba", name: "mGBA (Game Boy Advance)", wingetId: "JeffreyPfau.mGBA" },
      { id: "melonds", name: "melonDS (Nintendo DS)", wingetId: "melonDS.melonDS" },
    ],
    note: "Emulators only — bring your own legally-owned, first-party backups. (RetroDeck is Linux-only, no Windows build.)",
  },
  {
    id: "dev",
    label: "Dev tools",
    apps: [
      { id: "git", name: "Git", wingetId: "Git.Git" },
      { id: "python", name: "Python 3.12", wingetId: "Python.Python.3.12" },
      { id: "node", name: "Node.js LTS", wingetId: "OpenJS.NodeJS.LTS" },
      { id: "java", name: "Java (Temurin 21)", wingetId: "EclipseAdoptium.Temurin.21.JDK" },
      { id: "vscode", name: "VS Code", wingetId: "Microsoft.VisualStudioCode" },
      { id: "obs", name: "OBS Studio", wingetId: "OBSProject.OBSStudio" },
    ],
  },
  {
    id: "network",
    label: "Network & VPN",
    apps: [
      { id: "tailscale", name: "Tailscale", wingetId: "Tailscale.Tailscale" },
      { id: "protonvpn", name: "ProtonVPN", wingetId: "Proton.ProtonVPN" },
      { id: "nordvpn", name: "NordVPN", wingetId: "NordSecurity.NordVPN" },
      { id: "expressvpn", name: "ExpressVPN", wingetId: "ExpressVPN.ExpressVPN" },
      { id: "surfshark", name: "Surfshark", wingetId: "Surfshark.Surfshark" },
      { id: "cyberghost", name: "CyberGhost", wingetId: "CyberGhost.CyberGhost" },
      { id: "tunnelbear", name: "TunnelBear", wingetId: "TunnelBear.TunnelBear" },
    ],
  },
  {
    id: "passwords",
    label: "Password managers",
    apps: [
      { id: "1password", name: "1Password", wingetId: "AgileBits.1Password" },
      { id: "bitwarden", name: "Bitwarden", wingetId: "Bitwarden.Bitwarden" },
      { id: "keepassxc", name: "KeePassXC", wingetId: "KeePassXCTeam.KeePassXC" },
    ],
  },
];

/** Flat lookup of every catalog app by slug. */
const BY_ID = new Map(APP_GROUPS.flatMap((g) => g.apps).map((a) => [a.id, a]));

/** Resolve selected app slugs to their winget package ids (unknown ids dropped). */
export function appWingetIds(selected: string[]): string[] {
  return selected.map((id) => BY_ID.get(id)?.wingetId).filter((w): w is string => Boolean(w));
}

/** Install command arrays for the selected app slugs — default winget source, or
 *  `--source msstore` for Store-only apps. */
export function getSelectedAppCommands(selected: string[]): string[][] {
  const cmds: string[][] = [];
  for (const slug of selected) {
    const a = BY_ID.get(slug);
    if (!a?.wingetId) continue; // unknown, or a module-driven entry (e.g. EmuDeck)
    if (a.source === "msstore") {
      cmds.push([
        "winget",
        "install",
        "--id",
        a.wingetId,
        "--source",
        "msstore",
        "--accept-source-agreements",
        "--accept-package-agreements",
        "--silent",
      ]);
    } else {
      const c = getWingetInstallCommands([a.wingetId])[0];
      if (c) cmds.push(c);
    }
  }
  return cmds;
}
