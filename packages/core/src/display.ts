interface RegTweak {
  path: string;
  name: string;
  value: number;
}

// AMD display adapter class key (config/rog-ally/modules/optimization.ps1).
const AMD_CLASS =
  "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\0000";

// Display/GPU tweaks ported from v1 optimization.ps1 — both registry-based.
const TWEAKS: RegTweak[] = [
  // Hardware-accelerated GPU scheduling (HAGS) — also required for AMD AFMF
  {
    path: "HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers",
    name: "HwSchMode",
    value: 2,
  },
  // AMD Vari-Bright off — keeps full brightness/quality on battery
  { path: AMD_CLASS, name: "PP_VariBrightDefaultOnAC", value: 0 },
  { path: AMD_CLASS, name: "PP_VariBrightDefaultOnDC", value: 0 },
];

/**
 * Build `reg add` command arrays for the display/GPU tweaks. The executor's
 * runner decides whether they actually run.
 */
export function getDisplayTweakCommands(): string[][] {
  return TWEAKS.map((tweak) => [
    "reg",
    "add",
    tweak.path,
    "/v",
    tweak.name,
    "/t",
    "REG_DWORD",
    "/d",
    String(tweak.value),
    "/f",
  ]);
}
