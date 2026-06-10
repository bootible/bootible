# Display Module
# ==============
# HDR toggle and refresh rate configuration for the ROG Ally internal panel.
#
# HDR: uses HDRCmd from the HDRTray project (res2k/HDRTray on GitHub).
#   HDRCmd correctly handles the Win11 24H2 Auto Color Management (ACM) edge
#   case where the built-in HDR toggle may not fully activate HDR on the
#   internal panel. HDRCmd is downloaded on first use and cached locally.
#
# Refresh rate: applies only panel-supported modes (validated via
#   EnumDisplaySettings). Attempting an unsupported mode is skipped with a
#   warning that lists the available rates for the current resolution.

if (-not (Get-Command Resolve-DisplayPlan -ErrorAction SilentlyContinue)) {
    Write-Status "Display helpers not loaded - skipping display module" "Warning"
    return
}

$configHdr = Get-ConfigValue "configure_hdr" ""
$configHz  = Get-ConfigValue "set_refresh_rate" 0

$plan = @(Resolve-DisplayPlan -ConfigureHdr $configHdr -RefreshRate $configHz)

if ($plan.Count -eq 0) {
    Write-Status "Display settings unchanged" "Info"
    return
}

if ($Script:DryRun) {
    foreach ($action in $plan) {
        if ($action.Action -eq "hdr") {
            Write-Status "[DRY RUN] Would turn HDR $($action.Value)" "Info"
        } elseif ($action.Action -eq "refresh") {
            Write-Status "[DRY RUN] Would set refresh rate to $($action.Value)Hz" "Info"
        }
    }
    return
}

# ------------------------------------------------------------------ HDR action
$hdrAction = $plan | Where-Object { $_.Action -eq "hdr" }
if ($hdrAction) {
    $hdrCmdDir = Join-Path $env:LOCALAPPDATA "Bootible\tools\HDRCmd"
    $hdrCmdExe = Join-Path $hdrCmdDir "HDRCmd.exe"

    if (-not (Test-Path $hdrCmdExe)) {
        Write-Status "HDRCmd not found - downloading from res2k/HDRTray..." "Info"
        if (-not (Get-Command Get-GitHubLatestRelease -ErrorAction SilentlyContinue)) {
            Write-Status "Winget helpers not loaded - cannot download HDRCmd; skipping HDR" "Warning"
        } else {
            $release = Get-GitHubLatestRelease -Repo "res2k/HDRTray" -AssetPattern "HDRTray*.zip"
            if (-not $release) {
                Write-Status "Could not resolve HDRTray release - skipping HDR toggle" "Warning"
            } else {
                $zipFile = Join-Path $env:TEMP $release.AssetName
                $prevProgressPreference = $ProgressPreference
                try {
                    $ProgressPreference = 'SilentlyContinue'
                    Invoke-WebRequest -Uri $release.DownloadUrl -OutFile $zipFile -UseBasicParsing -ErrorAction Stop

                    if ($release.Digest -and $release.Digest -match '^sha256:([0-9a-fA-F]{64})$') {
                        $expectedHash = $matches[1]
                        $actualHash = (Get-FileHash -Path $zipFile -Algorithm SHA256).Hash
                        if ($actualHash -ne $expectedHash) {
                            throw "SHA256 mismatch for $($release.AssetName): expected $expectedHash, got $actualHash"
                        }
                    } else {
                        $downloaded = (Get-Item $zipFile).Length
                        if ($downloaded -ne $release.Size) {
                            throw "Size mismatch: expected $($release.Size) bytes, got $downloaded"
                        }
                    }

                    $extractDir = Join-Path $env:TEMP "HDRTray_extract"
                    if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
                    New-Item -ItemType Directory -Path $extractDir -Force | Out-Null
                    Expand-Archive -Path $zipFile -DestinationPath $extractDir -Force

                    $foundExe = Get-ChildItem -Path $extractDir -Recurse -Filter "HDRCmd.exe" |
                        Select-Object -First 1
                    if (-not $foundExe) {
                        throw "HDRCmd.exe not found in extracted archive $($release.AssetName)"
                    }

                    New-Item -ItemType Directory -Path $hdrCmdDir -Force | Out-Null
                    Copy-Item -Path $foundExe.FullName -Destination $hdrCmdExe -Force
                    Write-Status "HDRCmd $($release.Tag) installed" "Success"
                } catch {
                    Write-Status "Failed to download HDRCmd: $_" "Warning"
                    Write-Status "HDR toggle skipped" "Info"
                    $hdrCmdExe = $null
                } finally {
                    $ProgressPreference = $prevProgressPreference
                    Remove-Item $zipFile -Force -ErrorAction SilentlyContinue
                    if (Test-Path (Join-Path $env:TEMP "HDRTray_extract")) {
                        Remove-Item (Join-Path $env:TEMP "HDRTray_extract") -Recurse -Force -ErrorAction SilentlyContinue
                    }
                }
            }
        }
    }

    if ($hdrCmdExe -and (Test-Path $hdrCmdExe)) {
        $hdrValue = $hdrAction.Value
        $prevEAP = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            & $hdrCmdExe $hdrValue 2>&1 | Out-Null
            if ($LASTEXITCODE -ne 0) {
                Write-Status "HDRCmd exited with code $LASTEXITCODE while setting HDR $hdrValue" "Warning"
            } else {
                $label = if ($hdrValue -eq "on") { "HDR turned on" } else { "HDR turned off" }
                Write-Status $label "Success"
                if (Get-Command Add-AppliedChange -ErrorAction SilentlyContinue) {
                    Add-AppliedChange $label
                }
            }
        } catch {
            Write-Status "Failed to run HDRCmd: $_" "Warning"
        } finally {
            $ErrorActionPreference = $prevEAP
        }
    }
}

# --------------------------------------------------------------- Refresh action
$refreshAction = $plan | Where-Object { $_.Action -eq "refresh" }
if ($refreshAction) {
    $targetHz = [int]$refreshAction.Value
    try {
        # Add P/Invoke types once per session
        if (-not ([System.Management.Automation.PSTypeName]'Bootible.DisplayHelper').Type) {
            Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Collections.Generic;

namespace Bootible {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    public struct DEVMODE {
        private const int CCHDEVICENAME = 32;
        private const int CCHFORMNAME   = 32;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = CCHDEVICENAME)]
        public string dmDeviceName;
        public short  dmSpecVersion;
        public short  dmDriverVersion;
        public short  dmSize;
        public short  dmDriverExtra;
        public int    dmFields;

        // display union: POINTL + orientation + fixedOutput
        public int    dmPositionX;
        public int    dmPositionY;
        public int    dmDisplayOrientation;
        public int    dmDisplayFixedOutput;

        public short  dmColor;
        public short  dmDuplex;
        public short  dmYResolution;
        public short  dmTTOption;
        public short  dmCollate;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = CCHFORMNAME)]
        public string dmFormName;
        public short  dmLogPixels;
        public int    dmBitsPerPel;
        public int    dmPelsWidth;
        public int    dmPelsHeight;
        public int    dmDisplayFlags;
        public int    dmDisplayFrequency;
        public int    dmICMMethod;
        public int    dmICMIntent;
        public int    dmMediaType;
        public int    dmDitherType;
        public int    dmReserved1;
        public int    dmReserved2;
        public int    dmPanningWidth;
        public int    dmPanningHeight;
    }

    public class DisplayHelper {
        private const int ENUM_CURRENT_SETTINGS = -1;
        private const int DM_DISPLAYFREQUENCY   = 0x400000;
        private const int CDS_UPDATEREGISTRY    = 0x1;
        public  const int DISP_CHANGE_SUCCESSFUL = 0;

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern bool EnumDisplaySettings(
            string deviceName, int modeNum, ref DEVMODE devMode);

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern int ChangeDisplaySettingsEx(
            string deviceName, ref DEVMODE devMode,
            IntPtr hwnd, int flags, IntPtr lParam);

        public static int GetCurrentWidth()  { return GetCurrentMode().dmPelsWidth;  }
        public static int GetCurrentHeight() { return GetCurrentMode().dmPelsHeight; }

        private static DEVMODE GetCurrentMode() {
            DEVMODE dm = new DEVMODE();
            dm.dmSize = (short)Marshal.SizeOf(dm);
            EnumDisplaySettings(null, ENUM_CURRENT_SETTINGS, ref dm);
            return dm;
        }

        public static List<int> GetSupportedRefreshRates(int width, int height) {
            List<int> rates = new List<int>();
            DEVMODE dm = new DEVMODE();
            dm.dmSize = (short)Marshal.SizeOf(dm);
            int modeNum = 0;
            while (EnumDisplaySettings(null, modeNum, ref dm)) {
                if (dm.dmPelsWidth == width && dm.dmPelsHeight == height) {
                    if (!rates.Contains(dm.dmDisplayFrequency)) {
                        rates.Add(dm.dmDisplayFrequency);
                    }
                }
                modeNum++;
            }
            return rates;
        }

        public static int SetRefreshRate(int hz) {
            DEVMODE dm = GetCurrentMode();
            dm.dmDisplayFrequency = hz;
            dm.dmFields = DM_DISPLAYFREQUENCY;
            dm.dmSize = (short)Marshal.SizeOf(dm);
            return ChangeDisplaySettingsEx(null, ref dm, IntPtr.Zero, CDS_UPDATEREGISTRY, IntPtr.Zero);
        }
    }
}
'@ -ErrorAction Stop
        }

        $curW = [Bootible.DisplayHelper]::GetCurrentWidth()
        $curH = [Bootible.DisplayHelper]::GetCurrentHeight()
        $supported = @([Bootible.DisplayHelper]::GetSupportedRefreshRates($curW, $curH))

        if ($supported.Count -eq 0) {
            Write-Status "Could not enumerate display modes for ${curW}x${curH} - skipping refresh rate change" "Warning"
        } elseif ($supported -notcontains $targetHz) {
            $list = ($supported | Sort-Object) -join ", "
            Write-Status "Refresh rate ${targetHz}Hz not supported for ${curW}x${curH} (available: $list Hz) - skipping" "Warning"
        } else {
            $result = [Bootible.DisplayHelper]::SetRefreshRate($targetHz)
            if ($result -eq [Bootible.DisplayHelper]::DISP_CHANGE_SUCCESSFUL) {
                Write-Status "Refresh rate set to ${targetHz}Hz" "Success"
                if (Get-Command Add-AppliedChange -ErrorAction SilentlyContinue) {
                    Add-AppliedChange "Refresh rate set to ${targetHz}Hz"
                }
            } else {
                Write-Status "ChangeDisplaySettingsEx returned $result while setting ${targetHz}Hz - refresh rate not applied" "Warning"
            }
        }
    } catch {
        Write-Status "Failed to apply refresh rate change: $_" "Warning"
    }
}
