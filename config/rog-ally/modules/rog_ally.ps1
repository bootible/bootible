# ROG Ally Module - Device-Specific Configuration
# ================================================
# ASUS ROG Ally X specific tools and optimizations.
#
# ROG Ally X Specs Reminder:
# - AMD Ryzen Z1 Extreme APU
# - AMD Radeon Graphics (RDNA 3)
# - 7" 1080p 120Hz display
# - 80Wh battery
# - Windows 11
#
# Key Software:
# - Armoury Crate SE: Main control center (pre-installed)
# - MyASUS: System updates and diagnostics
# - Handheld Companion: Alternative controller mapper

if (-not (Get-ConfigValue "install_rog_ally" $true)) {
    Write-Status "ROG Ally module disabled in config" "Info"
    return
}

# Verify we're on a ROG device
$isRogDevice = (Get-WmiObject -Class Win32_ComputerSystem).Manufacturer -like "*ASUS*"
if (-not $isRogDevice) {
    Write-Status "Not detected as ASUS device - some features may not apply" "Warning"
}

# ASUS Software
# -------------

# Armoury Crate is typically pre-installed
# Check if it's there, update if possible
$armouryInstalled = Get-AppxPackage | Where-Object { $_.Name -like "*ArmouryCrate*" -or $_.Name -like "*ASUSROGAlly*" }
if ($armouryInstalled) {
    Write-Status "Armoury Crate is installed" "Success"
} else {
    if (Get-ConfigValue "install_armoury_crate" $true) {
        Write-Status "Armoury Crate not found - install from Microsoft Store or ASUS website" "Warning"
        Write-Status "https://www.asus.com/supportonly/armoury-crate/" "Info"
    }
}

# MyASUS / ASUS PC Assistant (Microsoft Store only - not in winget)
# ROG Ally uses ASUSPCAssistant or ASUSCommandCenter instead of MyASUS
if (Get-ConfigValue "install_myasus" $true) {
    $asusApps = Get-AppxPackage | Where-Object {
        $_.Name -match "MyASUS" -or
        $_.Name -match "ASUSPCAssistant" -or
        $_.Name -match "ASUSCommandCenter"
    }
    if ($asusApps) {
        $appNames = ($asusApps | ForEach-Object { $_.Name -replace '^B9ECED6F\.' }) -join ", "
        Write-Status "ASUS software installed: $appNames" "Success"
    } elseif ($Script:DryRun) {
        Write-Status "[DRY RUN] Would install MyASUS from Microsoft Store" "Info"
    } else {
        Write-Status "Installing MyASUS from Microsoft Store..." "Info"
        try {
            # MyASUS Store ID: 9N7R5S6B0ZZH
            Start-Process "ms-windows-store://pdp/?ProductId=9N7R5S6B0ZZH" -Wait:$false
            Write-Status "Microsoft Store opened - please complete MyASUS installation" "Warning"
            Write-Status "Continuing with other installations..." "Info"
        } catch {
            Write-Status "MyASUS: Install manually from Microsoft Store" "Warning"
        }
    }
}

# Handheld Companion (Alternative to Armoury Crate)
# -------------------------------------------------
# Open-source alternative for controller configuration

if (Get-ConfigValue "install_handheld_companion" $false) {
    $installed = Install-WingetPackage -PackageId "BenjaminLSR.HandheldCompanion" -Name "Handheld Companion"
    if ($installed) {
        Write-Status "Note: Disable Armoury Crate controller features if using Handheld Companion" "Warning"
    } else {
        Write-Status "Handheld Companion: Download from https://github.com/Valkirie/HandheldCompanion" "Info"
    }
}

# Performance Monitoring Tools
# ----------------------------

if (Get-ConfigValue "install_rtss" $false) {
    Install-WingetPackage -PackageId "Guru3D.RTSS" -Name "RivaTuner Statistics Server"
    Write-Status "RTSS: Great for FPS limiting and on-screen display" "Info"
}

if (Get-ConfigValue "install_hwinfo" $false) {
    Install-WingetPackage -PackageId "REALiX.HWiNFO" -Name "HWiNFO"
    Write-Status "HWiNFO: Detailed hardware monitoring" "Info"
}

if (Get-ConfigValue "install_msi_afterburner" $false) {
    $afterburnerPath = "${env:ProgramFiles(x86)}\MSI Afterburner\MSIAfterburner.exe"
    if (Test-Path $afterburnerPath) {
        Write-Status "MSI Afterburner already installed - skipping" "Success"
    } else {
        # MSI's CDN blocks scripted direct downloads (Akamai Access Denied),
        # so install via the community winget manifest instead
        $installed = Install-WingetPackage -PackageId "Guru3D.Afterburner" -Name "MSI Afterburner"
        if (-not $installed -and -not $Script:DryRun) {
            Write-Status "Download manually: https://www.msi.com/Landing/afterburner/graphics-cards" "Info"
        }
    }
    Write-Status "MSI Afterburner: GPU monitoring and overclocking" "Info"
}

if (Get-ConfigValue "install_ghelper" $false) {
    if (-not (Get-Command Get-GitHubLatestRelease -ErrorAction SilentlyContinue)) {
        Write-Status "Winget helpers not loaded - skipping G-Helper install" "Warning"
    } else {
        $gHelperDir = Join-Path $env:LOCALAPPDATA "GHelper"
        $gHelperExe = Join-Path $gHelperDir "GHelper.exe"

        if (Test-Path $gHelperExe) {
            Write-Status "G-Helper already installed - skipping" "Success"
            if (-not $Script:DryRun -and (Get-Command Add-InstallResult -ErrorAction SilentlyContinue)) {
                Add-InstallResult -PackageId 'seerge/g-helper' -Name 'G-Helper' -Status 'skipped' -Source 'direct'
            }
        } elseif ($Script:DryRun) {
            Write-Status "[DRY RUN] Would install G-Helper (Armoury Crate alternative) from GitHub releases" "Info"
        } else {
            Write-Status "Installing G-Helper (lightweight Armoury Crate alternative)..." "Info"
            $release = Get-GitHubLatestRelease -Repo "seerge/g-helper" -AssetPattern "GHelper.zip"
            if (-not $release) {
                Write-Status "Could not resolve G-Helper release - install manually: https://github.com/seerge/g-helper/releases" "Warning"
            } else {
                $zipFile = Join-Path $env:TEMP $release.AssetName
                $prevProgressPreference = $ProgressPreference
                try {
                    $ProgressPreference = 'SilentlyContinue'
                    Invoke-WebRequest -Uri $release.DownloadUrl -OutFile $zipFile -UseBasicParsing -ErrorAction Stop

                    # The digest and the download come from the same GitHub channel,
                    # so this hardens transfer integrity (corruption/truncation),
                    # not provenance
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

                    New-Item -ItemType Directory -Path $gHelperDir -Force | Out-Null
                    Expand-Archive -Path $zipFile -DestinationPath $gHelperDir -Force

                    if (Test-Path $gHelperExe) {
                        Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'GHelper' -Value "`"$gHelperExe`""
                        Write-Status "G-Helper $($release.Tag) installed (autostarts at login)" "Success"
                        if (Get-Command Add-InstallResult -ErrorAction SilentlyContinue) {
                            Add-InstallResult -PackageId 'seerge/g-helper' -Name 'G-Helper' -Status 'succeeded' -Source 'direct'
                        }
                        if (Get-Command Add-AppliedChange -ErrorAction SilentlyContinue) {
                            Add-AppliedChange "G-Helper $($release.Tag) installed (autostart at login)"
                        }
                        try {
                            Start-Process -FilePath $gHelperExe
                            Write-Status "G-Helper started" "Success"
                        } catch {
                            Write-Status "Could not start G-Helper now (it will autostart at next login): $_" "Warning"
                        }
                    } else {
                        Write-Status "G-Helper archive extracted but GHelper.exe not found - check $gHelperDir" "Warning"
                    }
                } catch {
                    Write-Status "Failed to install G-Helper: $_" "Warning"
                    Write-Status "Install manually: https://github.com/seerge/g-helper/releases" "Info"
                    if (Get-Command Add-InstallResult -ErrorAction SilentlyContinue) {
                        Add-InstallResult -PackageId 'seerge/g-helper' -Name 'G-Helper' -Status 'failed' -Source 'direct' -Message $_.Exception.Message
                    }
                } finally {
                    $ProgressPreference = $prevProgressPreference
                    Remove-Item $zipFile -Force -ErrorAction SilentlyContinue
                }
            }
        }
        Write-Status "G-Helper: TDP, fan curves, GPU modes without Armoury Crate" "Info"
    }
}

if (Get-ConfigValue "install_cpuz" $false) {
    Install-WingetPackage -PackageId "CPUID.CPU-Z" -Name "CPU-Z"
    Write-Status "CPU-Z: CPU information and benchmarking" "Info"
}

if (Get-ConfigValue "install_gpuz" $false) {
    Install-WingetPackage -PackageId "TechPowerUp.GPU-Z" -Name "GPU-Z"
    Write-Status "GPU-Z: GPU information and monitoring" "Info"
}

# AMD Adrenalin Software
# ----------------------
# ROG Ally uses AMD graphics - Adrenalin provides additional controls
# Usually pre-installed, but we can check

$amdInstalled = Get-WmiObject -Class Win32_VideoController | Where-Object { $_.Name -like "*AMD*" -or $_.Name -like "*Radeon*" }
if ($amdInstalled) {
    Write-Status "AMD graphics detected" "Success"

    # Check for Adrenalin
    $adrenalinPath = "${env:ProgramFiles}\AMD\CNext\CNext\RadeonSoftware.exe"
    if (Test-Path $adrenalinPath) {
        Write-Status "AMD Adrenalin Software installed" "Success"
    } else {
        Write-Status "AMD Adrenalin: Consider installing for advanced GPU controls" "Info"
        Write-Status "https://www.amd.com/en/support" "Info"
    }
}

# ROG Ally Specific Tips
# ----------------------
Write-Host ""
Write-Status "ROG Ally X Tips:" "Info"
Write-Host "  - Use Armoury Crate to switch between performance modes"
Write-Host "  - Command Center (CC button): Quick access to settings"
Write-Host "  - Armoury Crate button: Opens control center"
Write-Host "  - For best battery life: Silent mode + 15W TDP"
Write-Host "  - For best performance: Turbo mode (25W+ TDP)"
Write-Host "  - Consider using GameScope or Borderless Gaming for better compatibility"
Write-Host ""

Write-Status "ROG Ally setup complete" "Success"
