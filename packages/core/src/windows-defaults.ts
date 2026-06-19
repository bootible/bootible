interface RegTweak {
  path: string;
  name: string;
  type: "REG_DWORD" | "REG_SZ";
  value: string | number;
}

// A curated, broadly-safe subset of the v1 debloat tweaks (config/rog-ally/
// modules/debloat.ps1) — privacy + the gaming-relevant fullscreen-optimisation
// toggle. Each maps to a `reg add` command run via the executor's runner.
const TWEAKS: RegTweak[] = [
  // Disable Windows telemetry
  {
    path: "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection",
    name: "AllowTelemetry",
    type: "REG_DWORD",
    value: 0,
  },
  // Disable activity history feed
  {
    path: "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\System",
    name: "EnableActivityFeed",
    type: "REG_DWORD",
    value: 0,
  },
  // Turn off Windows Copilot
  {
    path: "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsCopilot",
    name: "TurnOffWindowsCopilot",
    type: "REG_DWORD",
    value: 1,
  },
  // Disable Bing search suggestions in Start
  {
    path: "HKCU\\SOFTWARE\\Policies\\Microsoft\\Windows\\Explorer",
    name: "DisableSearchBoxSuggestions",
    type: "REG_DWORD",
    value: 1,
  },
  // Show file extensions
  {
    path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced",
    name: "HideFileExt",
    type: "REG_DWORD",
    value: 0,
  },
  // Disable fullscreen optimisations (better for games)
  {
    path: "HKCU\\System\\GameConfigStore",
    name: "GameDVR_FSEBehaviorMode",
    type: "REG_DWORD",
    value: 2,
  },
];

/**
 * Build `reg add` command arrays for the curated Windows-defaults tweaks,
 * ported from the v1 debloat module. The executor's runner decides whether
 * they actually run.
 */
export function getWindowsDefaultsCommands(): string[][] {
  return TWEAKS.map((tweak) => [
    "reg",
    "add",
    tweak.path,
    "/v",
    tweak.name,
    "/t",
    tweak.type,
    "/d",
    String(tweak.value),
    "/f",
  ]);
}
