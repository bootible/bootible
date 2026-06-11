# Optimization Module - Windows Gaming Tweaks
# ============================================
# System optimizations for gaming on ROG Ally X.
#
# CAUTION:
# - Some tweaks may affect Windows features you use
# - Test after applying to ensure nothing breaks
# - You can re-enable features manually if needed
#
# ROG Ally Notes:
# - Windows 11 is generally well-optimized for gaming
# - Game Mode is already enabled by default
# - Most "debloat" scripts are unnecessary and can cause issues

if (-not (Get-ConfigValue "install_optimization" $true)) {
    Write-Status "Optimization module disabled in config" "Info"
    return
}

# Game Mode
# ---------
# Windows Game Mode prioritizes game processes

if (Get-ConfigValue "enable_game_mode" $true) {
    Write-Status "Enabling Windows Game Mode..." "Info"
    try {
        Set-ItemProperty -Path "HKCU:\Software\Microsoft\GameBar" -Name "AutoGameModeEnabled" -Value 1 -Type DWord
        Write-Status "Game Mode enabled" "Success"
    } catch {
        Write-Status "Could not enable Game Mode" "Warning"
    }
}

# Hardware-accelerated GPU Scheduling
# -----------------------------------
# Can improve performance and reduce latency
# AMD frame generation (AFMF) requires HAGS ON - bootible enables it and the drift guard monitors it.

if (Get-ConfigValue "enable_hardware_gpu_scheduling" $true) {
    Write-Status "Enabling Hardware-accelerated GPU Scheduling..." "Info"
    try {
        Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers" -Name "HwSchMode" -Value 2 -Type DWord
        Write-Status "GPU Scheduling enabled (restart required)" "Success"
    } catch {
        Write-Status "Could not enable GPU Scheduling" "Warning"
    }
}

# Disable Game DVR (Background Recording)
# ----------------------------------------
# Saves resources if you don't use Xbox Game Bar recording

if (Get-ConfigValue "disable_game_dvr" $true) {
    Write-Status "Disabling Game DVR background recording..." "Info"
    try {
        Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\GameDVR" -Name "AppCaptureEnabled" -Value 0 -Type DWord -ErrorAction SilentlyContinue
        Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\GameDVR" -Name "AllowGameDVR" -Value 0 -Type DWord -ErrorAction SilentlyContinue
        Write-Status "Game DVR disabled" "Success"
    } catch {
        Write-Status "Could not fully disable Game DVR" "Warning"
    }
}

# Disable Xbox Game Bar (Optional)
# ---------------------------------
# Only if you don't use any Game Bar features

if (Get-ConfigValue "disable_xbox_game_bar" $false) {
    Write-Status "Disabling Xbox Game Bar..." "Info"
    try {
        Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\GameDVR" -Name "GameDVR_Enabled" -Value 0 -Type DWord
        Set-ItemProperty -Path "HKCU:\Software\Microsoft\GameBar" -Name "UseNexusForGameBarEnabled" -Value 0 -Type DWord
        Write-Status "Xbox Game Bar disabled" "Success"
    } catch {
        Write-Status "Could not disable Xbox Game Bar" "Warning"
    }
}

# Disable Windows Tips and Suggestions
# ------------------------------------
# Reduces background activity and notifications

if (Get-ConfigValue "disable_tips" $true) {
    Write-Status "Disabling Windows tips and suggestions..." "Info"
    try {
        Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "SubscribedContent-338389Enabled" -Value 0 -Type DWord
        Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "SoftLandingEnabled" -Value 0 -Type DWord
        Write-Status "Tips disabled" "Success"
    } catch {
        Write-Status "Could not disable tips" "Warning"
    }
}

# Storage Sense
# -------------
# Automatically clean up temporary files

if (Get-ConfigValue "enable_storage_sense" $true) {
    Write-Status "Enabling Storage Sense..." "Info"
    try {
        Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\StorageSense\Parameters\StoragePolicy" -Name "01" -Value 1 -Type DWord -ErrorAction SilentlyContinue
        Write-Status "Storage Sense enabled" "Success"
    } catch {
        Write-Status "Could not enable Storage Sense (may need manual setup)" "Warning"
    }
}

# Power Plan
# ----------
# Note: Armoury Crate manages power on ROG Ally - these are Windows-level settings

if (Get-ConfigValue "configure_power_plans" $true) {
    Write-Status "Power plans are managed by Armoury Crate on ROG Ally" "Info"
    Write-Status "Use Armoury Crate to switch between Silent/Performance/Turbo modes" "Info"
}

# =============================================================================
# PERFORMANCE TWEAKS (Security Trade-offs)
# =============================================================================
# These tweaks improve gaming performance but reduce security.
# Only enable if you understand the risks.

# Core Isolation / Memory Integrity
# ----------------------------------
# Disabling improves gaming performance but reduces protection against malware
# Reference: https://www.youtube.com/watch?v=oSdTNOPXcYk

if (Get-ConfigValue "disable_core_isolation" $false) {
    Write-Status "Disabling Core Isolation (Memory Integrity)..." "Warning"
    Write-Status "This reduces security but improves gaming performance" "Warning"

    if (-not $Script:DryRun) {
        try {
            $path = "HKLM:\SYSTEM\CurrentControlSet\Control\DeviceGuard\Scenarios\HypervisorEnforcedCodeIntegrity"
            if (-not (Test-Path $path)) {
                New-Item -Path $path -Force | Out-Null
            }
            Set-ItemProperty -Path $path -Name "Enabled" -Value 0 -Type DWord
            Write-Status "Core Isolation disabled (restart required)" "Success"
        } catch {
            Write-Status "Could not disable Core Isolation: $_" "Warning"
        }
    } else {
        Write-Status "[DRY RUN] Would disable Core Isolation" "Info"
    }
}

# Virtual Machine Platform
# ------------------------
# Disabling can improve performance if you don't use WSL2, Hyper-V, or Android apps

if (Get-ConfigValue "disable_vm_platform" $false) {
    Write-Status "Disabling Virtual Machine Platform..." "Info"

    if (-not $Script:DryRun) {
        try {
            $feature = Get-WindowsOptionalFeature -Online -FeatureName "VirtualMachinePlatform" -ErrorAction SilentlyContinue
            if ($feature -and $feature.State -eq "Enabled") {
                Disable-WindowsOptionalFeature -Online -FeatureName "VirtualMachinePlatform" -NoRestart -ErrorAction Stop
                Write-Status "Virtual Machine Platform disabled (restart required)" "Success"
            } else {
                Write-Status "Virtual Machine Platform already disabled" "Success"
            }
        } catch {
            Write-Status "Could not disable Virtual Machine Platform: $_" "Warning"
        }
    } else {
        Write-Status "[DRY RUN] Would disable Virtual Machine Platform" "Info"
    }
}

# BitLocker Encryption
# --------------------
# Disabling BitLocker removes drive encryption for slightly better I/O performance
# and easier recovery/dual-boot scenarios. Data will no longer be encrypted at rest.
if (Get-ConfigValue "disable_bitlocker" $false) {
    Write-Status "Checking BitLocker status..." "Info"

    if (-not $Script:DryRun) {
        try {
            $bitlockerVolume = Get-BitLockerVolume -MountPoint "C:" -ErrorAction SilentlyContinue
            if ($bitlockerVolume) {
                if ($bitlockerVolume.ProtectionStatus -eq "On" -or $bitlockerVolume.VolumeStatus -eq "FullyEncrypted") {
                    Write-Status "Disabling BitLocker on C: drive..." "Warning"
                    Write-Status "This will decrypt your drive - data will no longer be encrypted at rest" "Warning"
                    Disable-BitLocker -MountPoint "C:" -ErrorAction Stop
                    Write-Status "BitLocker decryption started (will complete in background, restart required)" "Success"
                    $Script:RequiresRestart = $true
                } elseif ($bitlockerVolume.VolumeStatus -eq "DecryptionInProgress") {
                    Write-Status "BitLocker decryption already in progress" "Info"
                } else {
                    Write-Status "BitLocker already disabled on C: drive" "Success"
                }
            } else {
                Write-Status "BitLocker not available or not configured" "Info"
            }
        } catch {
            Write-Status "Could not disable BitLocker: $_" "Warning"
            Write-Status "You may need to disable it manually via Settings > Privacy & Security > Device encryption" "Info"
        }
    } else {
        Write-Status "[DRY RUN] Would disable BitLocker on C: drive" "Info"
    }
}

# =============================================================================
# AMD DISPLAY SETTINGS
# =============================================================================

# Disable AMD Vari-Bright
# -----------------------
# Vari-Bright dims the screen on battery to save power, but reduces image quality

if (Get-ConfigValue "disable_amd_varibright" $true) {
    Write-Status "Disabling AMD Vari-Bright for better display on battery..." "Info"

    if (-not $Script:DryRun) {
        try {
            # AMD Vari-Bright registry settings
            $amdPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\0000"
            if (Test-Path $amdPath) {
                # PP_VariBrightDefaultOnAC and PP_VariBrightDefaultOnDC control the feature
                Set-ItemProperty -Path $amdPath -Name "PP_VariBrightDefaultOnAC" -Value 0 -Type DWord -ErrorAction SilentlyContinue
                Set-ItemProperty -Path $amdPath -Name "PP_VariBrightDefaultOnDC" -Value 0 -Type DWord -ErrorAction SilentlyContinue
                Write-Status "AMD Vari-Bright disabled" "Success"
            } else {
                Write-Status "AMD display driver path not found - Vari-Bright may need manual config in AMD Software" "Warning"
            }
        } catch {
            Write-Status "Could not disable Vari-Bright: $_" "Warning"
        }
    } else {
        Write-Status "[DRY RUN] Would disable AMD Vari-Bright" "Info"
    }
}

# =============================================================================
# STEAM SETTINGS
# =============================================================================

# Configure Steam for better handheld experience
# -----------------------------------------------
# Prevents Xbox button from conflicting with Steam overlay

$steamConfigPath = "$env:USERPROFILE\AppData\Local\Steam\config"
$steamSharedConfig = Join-Path (Split-Path $steamConfigPath) "userdata"

if (Get-ConfigValue "steam_disable_guide_focus" $true) {
    Write-Status "Configuring Steam to not capture Xbox guide button..." "Info"

    if (-not $Script:DryRun) {
        # Steam stores this in the registry
        try {
            $steamRegPath = "HKCU:\Software\Valve\Steam"
            if (Test-Path $steamRegPath) {
                # BigPictureInForeground controls guide button behavior
                Set-ItemProperty -Path $steamRegPath -Name "BigPictureInForeground" -Value 0 -Type DWord -ErrorAction SilentlyContinue
                Write-Status "Steam guide button focus disabled" "Success"
            } else {
                Write-Status "Steam not installed yet - setting will apply after Steam install" "Info"
            }
        } catch {
            Write-Status "Could not configure Steam: $_" "Warning"
        }
    } else {
        Write-Status "[DRY RUN] Would configure Steam guide button setting" "Info"
    }
}

if (Get-ConfigValue "steam_start_big_picture" $true) {
    Write-Status "Configuring Steam to start in Big Picture mode..." "Info"

    if (-not $Script:DryRun) {
        try {
            $steamRegPath = "HKCU:\Software\Valve\Steam"
            if (Test-Path $steamRegPath) {
                Set-ItemProperty -Path $steamRegPath -Name "BigPictureInForeground" -Value 1 -Type DWord -ErrorAction SilentlyContinue
                Set-ItemProperty -Path $steamRegPath -Name "StartupMode" -Value 1 -Type DWord -ErrorAction SilentlyContinue
                Write-Status "Steam will start in Big Picture mode" "Success"
            } else {
                Write-Status "Steam not installed yet - setting will apply after Steam install" "Info"
            }
        } catch {
            Write-Status "Could not configure Steam: $_" "Warning"
        }
    } else {
        Write-Status "[DRY RUN] Would configure Steam Big Picture startup" "Info"
    }
}

# =============================================================================
# SYSTEM MAINTENANCE
# =============================================================================

# Disk Cleanup
# ------------
# Removes temporary files, system cache, and Windows Update cleanup
# Can recover 10-20GB of space

if (Get-ConfigValue "run_disk_cleanup" $false) {
    Write-Status "Running Disk Cleanup..." "Info"

    if (-not $Script:DryRun) {
        try {
            # Set cleanup flags in registry for automated cleanup
            $cleanupPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\VolumeCaches"
            $categories = @(
                "Temporary Files",
                "Temporary Setup Files",
                "Old ChkDsk Files",
                "Setup Log Files",
                "System error memory dump files",
                "System error minidump files",
                "Windows Error Reporting Files",
                "Windows Upgrade Log Files",
                "Thumbnail Cache",
                "Update Cleanup",
                "Windows Defender"
            )

            foreach ($category in $categories) {
                $catPath = Join-Path $cleanupPath $category
                if (Test-Path $catPath) {
                    Set-ItemProperty -Path $catPath -Name "StateFlags0100" -Value 2 -Type DWord -ErrorAction SilentlyContinue
                }
            }

            # Run cleanup with saved settings
            Start-Process -FilePath "cleanmgr.exe" -ArgumentList "/sagerun:100" -Wait -ErrorAction Stop
            Write-Status "Disk Cleanup complete" "Success"
        } catch {
            Write-Status "Disk Cleanup failed: $_" "Warning"
        }
    } else {
        Write-Status "[DRY RUN] Would run Disk Cleanup" "Info"
    }
}

# Time Sync
# ---------
# Ensures accurate system time (fixes Xbox Game Pass authentication issues)

if (Get-ConfigValue "force_time_sync" $true) {
    Write-Status "Synchronizing system time..." "Info"

    if (-not $Script:DryRun) {
        try {
            # Enable automatic time sync
            Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\W32Time\Parameters" -Name "Type" -Value "NTP" -ErrorAction SilentlyContinue

            # Start Windows Time service if not running
            $timeService = Get-Service -Name "W32Time" -ErrorAction SilentlyContinue
            if ($timeService.Status -ne "Running") {
                Start-Service -Name "W32Time" -ErrorAction SilentlyContinue
            }

            # Force time resync
            w32tm /resync /force 2>&1 | Out-Null
            Write-Status "Time synchronized" "Success"
        } catch {
            Write-Status "Time sync failed: $_" "Warning"
        }
    } else {
        Write-Status "[DRY RUN] Would sync system time" "Info"
    }
}

# Battery Health Report
# ---------------------
# Generates detailed battery health report (useful for diagnostics)

if (Get-ConfigValue "generate_battery_report" $false) {
    Write-Status "Generating battery health report..." "Info"

    if (-not $Script:DryRun) {
        try {
            $reportPath = Join-Path $env:USERPROFILE "Desktop\battery-report.html"
            powercfg /batteryreport /output $reportPath 2>&1 | Out-Null

            if (Test-Path $reportPath) {
                Write-Status "Battery report saved to Desktop" "Success"
                Write-Status "Open battery-report.html to view battery health" "Info"
            } else {
                Write-Status "Battery report generation failed" "Warning"
            }
        } catch {
            Write-Status "Could not generate battery report: $_" "Warning"
        }
    } else {
        Write-Status "[DRY RUN] Would generate battery report on Desktop" "Info"
    }
}

Write-Status "Optimization complete" "Success"
Write-Status "Some changes require a restart to take effect" "Warning"
