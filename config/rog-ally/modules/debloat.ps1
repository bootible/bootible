# Debloat Module - Windows Privacy & Performance Tweaks
# =====================================================
# Applies registry tweaks and system changes to debloat Windows.
# Based on Chris Titus Tech's WinUtil tweaks.
#
# WARNING: Some tweaks may affect Windows functionality.
# Review each option before enabling.

if (-not (Get-ConfigValue "install_debloat" $true)) {
    Write-Status "Debloat module disabled in config" "Info"
    return
}

# Collection of UCPD-protected HKCU registry keys that require non-elevated context
# These will be applied via a scheduled task at next user logon
$Script:UcpdKeys = @()

# Helper function to set registry value
function Set-RegistryValue {
    param(
        [string]$Path,
        [string]$Name,
        $Value,
        [string]$Type = "DWord"
    )

    if ($Script:DryRun) {
        Write-Status "[DRY RUN] Would set: $Path\$Name = $Value" "Info"
        return
    }

    try {
        if (-not (Test-Path $Path)) {
            New-Item -Path $Path -Force | Out-Null
        }
        Set-ItemProperty -Path $Path -Name $Name -Value $Value -Type $Type -Force
    } catch {
        Write-Status "Failed to set $Path\$Name : $_" "Warning"
    }
}

# =============================================================================
# PRIVACY TWEAKS
# =============================================================================

# Disable Telemetry
if (Get-ConfigValue "disable_telemetry" $true) {
    Write-Status "Disabling Windows telemetry..." "Info"

    # Disable telemetry
    Set-RegistryValue -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection" -Name "AllowTelemetry" -Value 0
    Set-RegistryValue -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\DataCollection" -Name "AllowTelemetry" -Value 0

    # Disable diagnostic data
    Set-RegistryValue -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Diagnostics\DiagTrack" -Name "ShowedToastAtLevel" -Value 1

    # Disable feedback
    Set-RegistryValue -Path "HKCU:\SOFTWARE\Microsoft\Siuf\Rules" -Name "NumberOfSIUFInPeriod" -Value 0

    Write-Status "Telemetry disabled" "Success"
}

# Disable Activity History
if (Get-ConfigValue "disable_activity_history" $true) {
    Write-Status "Disabling activity history..." "Info"

    Set-RegistryValue -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\System" -Name "EnableActivityFeed" -Value 0
    Set-RegistryValue -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\System" -Name "PublishUserActivities" -Value 0
    Set-RegistryValue -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\System" -Name "UploadUserActivities" -Value 0

    Write-Status "Activity history disabled" "Success"
}

# Disable Location Tracking
if (Get-ConfigValue "disable_location_tracking" $true) {
    Write-Status "Disabling location tracking..." "Info"

    Set-RegistryValue -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\LocationAndSensors" -Name "DisableLocation" -Value 1
    Set-RegistryValue -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\LocationAndSensors" -Name "DisableLocationScripting" -Value 1
    Set-RegistryValue -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\LocationAndSensors" -Name "DisableWindowsLocationProvider" -Value 1

    Write-Status "Location tracking disabled" "Success"
}

# Disable Microsoft Copilot
if (Get-ConfigValue "disable_copilot" $true) {
    Write-Status "Disabling Microsoft Copilot..." "Info"

    Set-RegistryValue -Path "HKCU:\SOFTWARE\Policies\Microsoft\Windows\WindowsCopilot" -Name "TurnOffWindowsCopilot" -Value 1
    Set-RegistryValue -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsCopilot" -Name "TurnOffWindowsCopilot" -Value 1

    Write-Status "Microsoft Copilot disabled" "Success"
}

# =============================================================================
# UI TWEAKS
# =============================================================================

# Disable Lock Screen Junk
if (Get-ConfigValue "disable_lockscreen_junk" $true) {
    Write-Status "Disabling lock screen tips, ads, and widgets..." "Info"

    # Disable lock screen tips/tricks/facts
    Set-RegistryValue -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "RotatingLockScreenOverlayEnabled" -Value 0
    Set-RegistryValue -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "SubscribedContent-338387Enabled" -Value 0

    # Disable Windows Spotlight suggestions
    Set-RegistryValue -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "SubscribedContent-338389Enabled" -Value 0

    # Disable "Get fun facts, tips, tricks" on lock screen
    Set-RegistryValue -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "SubscribedContent-338393Enabled" -Value 0

    # Disable suggested content in Settings
    Set-RegistryValue -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "SubscribedContent-353694Enabled" -Value 0
    Set-RegistryValue -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "SubscribedContent-353696Enabled" -Value 0

    # Disable app suggestions
    Set-RegistryValue -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "SoftLandingEnabled" -Value 0
    Set-RegistryValue -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "SystemPaneSuggestionsEnabled" -Value 0

    # Disable Start Menu suggestions
    Set-RegistryValue -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "SubscribedContent-310093Enabled" -Value 0

    # Disable Windows welcome experience
    Set-RegistryValue -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "SubscribedContent-310091Enabled" -Value 0

    # Disable Lock Screen Widgets (Weather, News, etc.)
    # Policy-based settings (work when elevated)
    Set-RegistryValue -Path "HKLM:\SOFTWARE\Policies\Microsoft\Dsh" -Name "AllowNewsAndInterests" -Value 0
    Set-RegistryValue -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Windows Feeds" -Name "EnableFeeds" -Value 0
    Set-RegistryValue -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\System" -Name "DisableLockScreenAppNotifications" -Value 1

    # HKCU settings blocked by UCPD when running elevated - collect for scheduled task
    # These keys require non-elevated context to modify
    $Script:UcpdKeys += @(
        @{ Path = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Feeds"; Name = "ShellFeedsTaskbarViewMode"; Value = "2"; Type = "DWord" },
        @{ Path = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced"; Name = "TaskbarMn"; Value = "0"; Type = "DWord" },
        @{ Path = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Notifications\Settings\Windows.LockScreen.MediaWidget"; Name = "Enabled"; Value = "0"; Type = "DWord" }
    )

    Write-Status "Lock screen junk and widgets disabled (some settings apply at next logon)" "Success"
}

# Classic Right-Click Menu (Windows 11)
if (Get-ConfigValue "classic_right_click_menu" $true) {
    Write-Status "Enabling classic right-click menu..." "Info"

    Set-RegistryValue -Path "HKCU:\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32" -Name "(Default)" -Value "" -Type "String"

    Write-Status "Classic right-click menu enabled (restart Explorer to apply)" "Success"
}

# Disable Bing Search in Start Menu
if (Get-ConfigValue "disable_bing_search" $true) {
    Write-Status "Disabling Bing search in Start Menu..." "Info"

    Set-RegistryValue -Path "HKCU:\SOFTWARE\Policies\Microsoft\Windows\Explorer" -Name "DisableSearchBoxSuggestions" -Value 1
    Set-RegistryValue -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Search" -Name "BingSearchEnabled" -Value 0

    Write-Status "Bing search disabled" "Success"
}

# Show File Extensions
if (Get-ConfigValue "show_file_extensions" $true) {
    Write-Status "Enabling file extension visibility..." "Info"

    Set-RegistryValue -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "HideFileExt" -Value 0

    Write-Status "File extensions visible" "Success"
}

# Show Hidden Files
if (Get-ConfigValue "show_hidden_files" $false) {
    Write-Status "Enabling hidden file visibility..." "Info"

    Set-RegistryValue -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "Hidden" -Value 1
    Set-RegistryValue -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "ShowSuperHidden" -Value 1

    Write-Status "Hidden files visible" "Success"
}

# =============================================================================
# EDGE TWEAKS
# =============================================================================

# Debloat Edge
if (Get-ConfigValue "debloat_edge" $true) {
    Write-Status "Debloating Microsoft Edge..." "Info"

    # Disable Edge telemetry
    Set-RegistryValue -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge" -Name "PersonalizationReportingEnabled" -Value 0
    Set-RegistryValue -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge" -Name "MetricsReportingEnabled" -Value 0
    Set-RegistryValue -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge" -Name "SendSiteInfoToImproveServices" -Value 0

    # Disable Edge shopping features
    Set-RegistryValue -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge" -Name "EdgeShoppingAssistantEnabled" -Value 0

    # Disable Edge sidebar
    Set-RegistryValue -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge" -Name "HubsSidebarEnabled" -Value 0

    # Disable Edge first run experience
    Set-RegistryValue -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge" -Name "HideFirstRunExperience" -Value 1

    Write-Status "Edge debloated" "Success"
}

# Disable Edge
if (Get-ConfigValue "disable_edge" $true) {
    Write-Status "Disabling Microsoft Edge..." "Info"

    # Prevent Edge from running in background
    Set-RegistryValue -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge" -Name "StartupBoostEnabled" -Value 0
    Set-RegistryValue -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge" -Name "BackgroundModeEnabled" -Value 0

    # Disable Edge as default PDF reader
    Set-RegistryValue -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge" -Name "AlwaysOpenPdfExternally" -Value 1

    Write-Status "Edge disabled (may require restart)" "Success"
}

# =============================================================================
# NETWORK TWEAKS
# =============================================================================

# Prefer IPv4 over IPv6
if (Get-ConfigValue "prefer_ipv4" $true) {
    Write-Status "Setting IPv4 preference over IPv6..." "Info"

    Set-RegistryValue -Path "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip6\Parameters" -Name "DisabledComponents" -Value 32

    Write-Status "IPv4 preferred over IPv6" "Success"
}

# Disable Teredo
if (Get-ConfigValue "disable_teredo" $true) {
    Write-Status "Disabling Teredo tunneling..." "Info"

    if (-not $Script:DryRun) {
        try {
            netsh interface teredo set state disabled | Out-Null
            Write-Status "Teredo disabled" "Success"
        } catch {
            Write-Status "Failed to disable Teredo: $_" "Warning"
        }
    } else {
        Write-Status "[DRY RUN] Would disable Teredo" "Info"
    }
}

# =============================================================================
# PERFORMANCE TWEAKS
# =============================================================================

# Disable Fullscreen Optimizations
if (Get-ConfigValue "disable_fullscreen_optimizations" $true) {
    Write-Status "Disabling fullscreen optimizations..." "Info"

    Set-RegistryValue -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_FSEBehaviorMode" -Value 2
    Set-RegistryValue -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_HonorUserFSEBehaviorMode" -Value 1
    Set-RegistryValue -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_FSEBehavior" -Value 2

    Write-Status "Fullscreen optimizations disabled" "Success"
}

# Set Services to Manual
if (Get-ConfigValue "set_services_manual" $true) {
    Write-Status "Setting non-essential services to manual..." "Info"

    $servicesToManual = @(
        "DiagTrack",           # Connected User Experiences and Telemetry
        "dmwappushservice",    # WAP Push Message Routing Service
        "MapsBroker",          # Downloaded Maps Manager
        "SharedAccess",        # Internet Connection Sharing
        "RemoteRegistry",      # Remote Registry
        "WMPNetworkSvc"        # Windows Media Player Network Sharing
        # Note: lfsvc (Geolocation) removed - needed for location services
    )

    if (-not $Script:DryRun) {
        foreach ($service in $servicesToManual) {
            try {
                $svc = Get-Service -Name $service -ErrorAction SilentlyContinue
                if ($svc) {
                    Set-Service -Name $service -StartupType Manual -ErrorAction SilentlyContinue
                }
            } catch {
                # Silently ignore service errors
            }
        }
        Write-Status "Non-essential services set to manual" "Success"
    } else {
        Write-Status "[DRY RUN] Would set services to manual: $($servicesToManual -join ', ')" "Info"
    }
}

# =============================================================================
# POWERSHELL TWEAKS
# =============================================================================

# Make PowerShell 7 the default terminal
if (Get-ConfigValue "powershell7_default_terminal" $true) {
    # Check if PowerShell 7 is installed
    $ps7Path = "$env:ProgramFiles\PowerShell\7\pwsh.exe"
    if (Test-Path $ps7Path) {
        Write-Status "Setting PowerShell 7 as default terminal..." "Info"

        # Set Windows Terminal default profile to PowerShell 7
        Set-RegistryValue -Path "HKCU:\Console\%%Startup" -Name "DelegationConsole" -Value "{574e775e-4f2a-5b96-ac1e-a2962a402336}" -Type "String"
        Set-RegistryValue -Path "HKCU:\Console\%%Startup" -Name "DelegationTerminal" -Value "{574e775e-4f2a-5b96-ac1e-a2962a402336}" -Type "String"

        Write-Status "PowerShell 7 set as default terminal" "Success"
    } else {
        Write-Status "PowerShell 7 not installed - skipping default terminal setting" "Warning"
    }
}

# Disable PowerShell 7 Telemetry
if (Get-ConfigValue "disable_powershell7_telemetry" $true) {
    Write-Status "Disabling PowerShell 7 telemetry..." "Info"

    # Set environment variable to disable PS7 telemetry
    if (-not $Script:DryRun) {
        [Environment]::SetEnvironmentVariable("POWERSHELL_TELEMETRY_OPTOUT", "1", "Machine")
    }

    Write-Status "PowerShell 7 telemetry disabled" "Success"
}

# =============================================================================
# PERSONALIZATION
# =============================================================================

# Set Desktop Wallpaper
$wallpaperPath = Get-ConfigValue "wallpaper_path" ""
if ($wallpaperPath) {
    Write-Status "Setting desktop wallpaper..." "Info"

    # Check if path is relative to private repo
    if (-not [System.IO.Path]::IsPathRooted($wallpaperPath)) {
        $wallpaperPath = Join-Path $Script:PrivateRoot $wallpaperPath
    }

    if (Test-Path $wallpaperPath) {
        if ($Script:DryRun) {
            Write-Status "[DRY RUN] Would set wallpaper to: $wallpaperPath" "Info"
        } else {
            try {
                # Copy to local location for persistence
                $localWallpaper = Join-Path $env:USERPROFILE "Pictures\bootible-wallpaper$([System.IO.Path]::GetExtension($wallpaperPath))"
                Copy-Item -Path $wallpaperPath -Destination $localWallpaper -Force

                # Set wallpaper style (2 = Stretch, 10 = Fill, 6 = Fit, 0 = Center, 22 = Span)
                $wallpaperStyle = Get-ConfigValue "wallpaper_style" "Fill"
                $styleValue = switch ($wallpaperStyle) {
                    "Stretch" { "2" }
                    "Fill" { "10" }
                    "Fit" { "6" }
                    "Center" { "0" }
                    "Tile" { "0" }
                    "Span" { "22" }
                    default { "10" }
                }
                $tileValue = if ($wallpaperStyle -eq "Tile") { "1" } else { "0" }

                # Try immediate registry + API approach (may work in some contexts)
                Set-RegistryValue -Path "HKCU:\Control Panel\Desktop" -Name "Wallpaper" -Value $localWallpaper -Type "String"
                Set-RegistryValue -Path "HKCU:\Control Panel\Desktop" -Name "WallpaperStyle" -Value $styleValue -Type "String"
                Set-RegistryValue -Path "HKCU:\Control Panel\Desktop" -Name "TileWallpaper" -Value $tileValue -Type "String"

                # Apply immediately using SystemParametersInfo API (works even when elevated)
                Add-Type -TypeDefinition @"
                    using System;
                    using System.Runtime.InteropServices;
                    public class Wallpaper {
                        [DllImport("user32.dll", CharSet = CharSet.Auto)]
                        public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
                    }
"@
                [Wallpaper]::SystemParametersInfo(0x0014, 0, $localWallpaper, 0x01 -bor 0x02) | Out-Null

                # Also add to UCPD keys for scheduled task fallback
                $Script:UcpdKeys += @(
                    @{ Path = "HKCU:\Control Panel\Desktop"; Name = "Wallpaper"; Value = $localWallpaper; Type = "String" },
                    @{ Path = "HKCU:\Control Panel\Desktop"; Name = "WallpaperStyle"; Value = $styleValue; Type = "String" },
                    @{ Path = "HKCU:\Control Panel\Desktop"; Name = "TileWallpaper"; Value = $tileValue; Type = "String" }
                )

                Write-Status "Wallpaper set: $(Split-Path $wallpaperPath -Leaf)" "Success"
                if (Get-Command Add-AppliedChange -ErrorAction SilentlyContinue) {
                    Add-AppliedChange "Wallpaper applied"
                }
            } catch {
                Write-Status "Failed to set wallpaper: $_" "Warning"
            }
        }
    } else {
        Write-Status "Wallpaper file not found: $wallpaperPath" "Warning"
    }
}

# Set Lock Screen Image
$lockscreenPath = Get-ConfigValue "lockscreen_path" ""
if ($lockscreenPath) {
    Write-Status "Setting lock screen image..." "Info"

    # Check if path is relative to private repo
    if (-not [System.IO.Path]::IsPathRooted($lockscreenPath)) {
        $lockscreenPath = Join-Path $Script:PrivateRoot $lockscreenPath
    }

    if (Test-Path $lockscreenPath) {
        if ($Script:DryRun) {
            Write-Status "[DRY RUN] Would set lock screen to: $lockscreenPath" "Info"
        } else {
            try {
                # Copy to local location
                $localLockscreen = Join-Path $env:USERPROFILE "Pictures\bootible-lockscreen$([System.IO.Path]::GetExtension($lockscreenPath))"
                Copy-Item -Path $lockscreenPath -Destination $localLockscreen -Force

                # Disable Windows Spotlight (use picture instead)
                Set-RegistryValue -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "RotatingLockScreenEnabled" -Value 0
                Set-RegistryValue -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "RotatingLockScreenOverlayEnabled" -Value 0
                Set-RegistryValue -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "SubscribedContent-338387Enabled" -Value 0

                # Copy to Windows lock screen location (works on Win 10/11)
                $windowsScreenPath = "C:\Windows\Web\Screen"
                if (Test-Path $windowsScreenPath) {
                    # Backup and replace default lock screen images
                    $imgFiles = @("img100.jpg", "img101.jpg", "img102.jpg", "img103.jpg", "img104.jpg", "img105.jpg")
                    foreach ($imgFile in $imgFiles) {
                        $targetPath = Join-Path $windowsScreenPath $imgFile
                        try {
                            # Take ownership and copy (requires admin)
                            if (Test-Path $targetPath) {
                                takeown /f $targetPath /a 2>$null | Out-Null
                                icacls $targetPath /grant Administrators:F 2>$null | Out-Null
                            }
                            Copy-Item -Path $lockscreenPath -Destination $targetPath -Force -ErrorAction SilentlyContinue
                        } catch {
                            # Silently continue - some files may be locked
                        }
                    }
                }

                # Set Creative lock screen preference to Picture (not Spotlight)
                # Try immediate approach (may work in some contexts)
                Set-RegistryValue -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Lock Screen\Creative" -Name "LockImageFlags" -Value 0
                Set-RegistryValue -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Lock Screen\Creative" -Name "CreativeId" -Value "" -Type "String"
                Set-RegistryValue -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Lock Screen\Creative" -Name "PortraitAssetPath" -Value $localLockscreen -Type "String"
                Set-RegistryValue -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Lock Screen\Creative" -Name "LandscapeAssetPath" -Value $localLockscreen -Type "String"
                Set-RegistryValue -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Lock Screen\Creative" -Name "HotspotImageFolderPath" -Value $localLockscreen -Type "String"

                # Also add to UCPD keys for scheduled task fallback
                $Script:UcpdKeys += @(
                    @{ Path = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager"; Name = "RotatingLockScreenEnabled"; Value = "0"; Type = "DWord" },
                    @{ Path = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager"; Name = "RotatingLockScreenOverlayEnabled"; Value = "0"; Type = "DWord" },
                    @{ Path = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager"; Name = "SubscribedContent-338387Enabled"; Value = "0"; Type = "DWord" },
                    @{ Path = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Lock Screen\Creative"; Name = "LockImageFlags"; Value = "0"; Type = "DWord" },
                    @{ Path = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Lock Screen\Creative"; Name = "CreativeId"; Value = ""; Type = "String" },
                    @{ Path = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Lock Screen\Creative"; Name = "PortraitAssetPath"; Value = $localLockscreen; Type = "String" },
                    @{ Path = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Lock Screen\Creative"; Name = "LandscapeAssetPath"; Value = $localLockscreen; Type = "String" },
                    @{ Path = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Lock Screen\Creative"; Name = "HotspotImageFolderPath"; Value = $localLockscreen; Type = "String" }
                )

                # Force Windows to refresh the lock screen settings
                RUNDLL32.EXE user32.dll,UpdatePerUserSystemParameters 1, True 2>$null

                Write-Status "Lock screen set: $(Split-Path $lockscreenPath -Leaf)" "Success"
                if (Get-Command Add-AppliedChange -ErrorAction SilentlyContinue) {
                    Add-AppliedChange "Lock screen image applied"
                }
            } catch {
                Write-Status "Failed to set lock screen: $_" "Warning"
            }
        }
    } else {
        Write-Status "Lock screen file not found: $lockscreenPath" "Warning"
    }
}

# =============================================================================
# DESKTOP CLEANUP
# =============================================================================

# Remove all desktop shortcuts (except Recycle Bin which isn't a shortcut)
if (Get-ConfigValue "clean_desktop_shortcuts" $true) {
    Write-Status "Cleaning desktop shortcuts..." "Info"

    $userDesktop = [Environment]::GetFolderPath('Desktop')
    $publicDesktop = "$env:PUBLIC\Desktop"

    if ($Script:DryRun) {
        $userShortcuts = Get-ChildItem -Path $userDesktop -Filter "*.lnk" -ErrorAction SilentlyContinue
        $publicShortcuts = Get-ChildItem -Path $publicDesktop -Filter "*.lnk" -ErrorAction SilentlyContinue
        $totalCount = ($userShortcuts.Count + $publicShortcuts.Count)
        Write-Status "[DRY RUN] Would remove $totalCount desktop shortcuts" "Info"
    } else {
        $removed = 0

        # Clean user desktop
        Get-ChildItem -Path $userDesktop -Filter "*.lnk" -ErrorAction SilentlyContinue | ForEach-Object {
            Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
            $removed++
        }

        # Clean public desktop (shared shortcuts)
        Get-ChildItem -Path $publicDesktop -Filter "*.lnk" -ErrorAction SilentlyContinue | ForEach-Object {
            Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
            $removed++
        }

        if ($removed -gt 0) {
            Write-Status "Removed $removed desktop shortcuts" "Success"
        } else {
            Write-Status "No desktop shortcuts to remove" "Info"
        }
    }
}

# =============================================================================
# APPLY UCPD-PROTECTED SETTINGS VIA SCHEDULED TASK
# =============================================================================
# Some HKCU registry keys are blocked by UCPD (User Control over Protected Data)
# when running in elevated context. Create a one-time scheduled task to apply
# these settings at next user logon in non-elevated context.

if ($Script:UcpdKeys.Count -gt 0) {
    if ($Script:DryRun) {
        Write-Status "[DRY RUN] Would create scheduled task to apply $($Script:UcpdKeys.Count) UCPD-protected settings at next logon" "Info"
    } else {
        $taskName = "Bootible-ApplyUserSettings"

        # Build PowerShell commands for each registry key
        $regCommands = $Script:UcpdKeys | ForEach-Object {
            $path = $_.Path
            $name = $_.Name
            $value = $_.Value
            $type = if ($_.Type -eq "String") { "String" } else { "DWord" }

            # Escape single quotes in paths/values
            $path = $path -replace "'", "''"
            $value = "$value" -replace "'", "''"

            "try { if (-not (Test-Path '$path')) { New-Item -Path '$path' -Force | Out-Null }; Set-ItemProperty -Path '$path' -Name '$name' -Value '$value' -Type $type -Force -ErrorAction Stop } catch { }"
        }

        $allCommands = $regCommands -join "; "
        # Refresh explorer after applying settings
        $allCommands += "; Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue"
        # Unregister the task itself after completion
        $allCommands += "; Start-Sleep -Seconds 2; Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false -ErrorAction SilentlyContinue"

        try {
            # Remove existing task if present
            Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

            $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command `"$allCommands`""
            $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
            $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
            $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

            Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
            Write-Status "Created scheduled task to apply $($Script:UcpdKeys.Count) user settings at next logon" "Info"
        } catch {
            Write-Status "Could not create scheduled task for user settings: $_" "Warning"
        }
    }
}

Write-Status "Debloat module complete" "Success"
