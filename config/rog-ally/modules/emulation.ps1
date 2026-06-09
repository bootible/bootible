# Emulation Module - EmuDeck Setup
# =================================
# EmuDeck handles all emulator installation and configuration.
# It downloads emulators, sets optimal settings, and organizes ROMs.
#
# If you have the EmuDeck EA (Patreon) installer in the private repo,
# it will use that. Otherwise, it downloads the public installer.

if (-not (Get-ConfigValue "install_emulation" $false)) {
    Write-Status "Emulation module disabled in config" "Info"
    return
}

# Check if EmuDeck is already installed
$emudeckInstalled = $false
$emudeckPaths = @(
    "$env:USERPROFILE\emudeck",
    "$env:USERPROFILE\EmuDeck",
    "$env:APPDATA\EmuDeck",
    "$env:LOCALAPPDATA\EmuDeck"
)

foreach ($path in $emudeckPaths) {
    if (Test-Path $path) {
        # Check for settings file or app as confirmation
        if ((Test-Path "$path\settings.sh") -or (Test-Path "$path\EmuDeck.exe") -or (Get-ChildItem $path -ErrorAction SilentlyContinue | Measure-Object).Count -gt 5) {
            $emudeckInstalled = $true
            Write-Status "EmuDeck already installed at: $path" "Success"
            break
        }
    }
}

if ($emudeckInstalled) {
    Write-Status "Skipping EmuDeck installer - already installed" "Info"
    Write-Status "Run the EmuDeck app to update or reconfigure" "Info"
    return
}

Write-Status "Setting up EmuDeck..." "Info"

# Check for private EA script first (shared scripts live at private/scripts/)
$privateScriptPath = Join-Path $Script:PrivateRoot "scripts\EmuDeck EA Windows.bat"
$localScriptPath = Join-Path $Script:DeviceRoot "scripts\EmuDeck EA Windows.bat"

$emudeckScript = $null
if (Test-Path $privateScriptPath) {
    $emudeckScript = $privateScriptPath
    Write-Status "Found EmuDeck EA (Patreon) script" "Success"
} elseif (Test-Path $localScriptPath) {
    $emudeckScript = $localScriptPath
    Write-Status "Found EmuDeck EA script in local files" "Success"
}

if ($Script:DryRun) {
    if ($emudeckScript) {
        Write-Status "[DRY RUN] Would run EmuDeck EA installer: $emudeckScript" "Info"
    } else {
        Write-Status "[DRY RUN] Would download and run EmuDeck public installer" "Info"
    }
} else {
    if ($emudeckScript) {
        Write-Status "Running EmuDeck EA installer..." "Info"
        try {
            Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "`"$emudeckScript`"" -Wait
            Write-Status "EmuDeck EA installer launched" "Success"
        } catch {
            Write-Status "Failed to run EmuDeck EA installer: $_" "Warning"
        }
    } else {
        Write-Status "Downloading EmuDeck public installer..." "Info"
        try {
            $installerUrl = "https://raw.githubusercontent.com/EmuDeck/emudeck-we/main/install.ps1"
            Invoke-Expression ((New-Object System.Net.WebClient).DownloadString($installerUrl))
            Write-Status "EmuDeck installer launched" "Success"
        } catch {
            Write-Status "Failed to download EmuDeck installer: $_" "Warning"
            Write-Status "Visit https://www.emudeck.com/ to download manually" "Info"
        }
    }
}

Write-Status "Run the EmuDeck app to configure emulators and set ROM paths" "Info"
Write-Status "Emulation setup complete" "Success"
