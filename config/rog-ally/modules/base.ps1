# Base Module - Prerequisites and Setup
# =====================================
# This module sets up the foundation for everything else:
# - Configures hostname and static IP (if specified)
# - Verifies winget is working
# - Updates winget sources
# - Installs essential utilities
#
# Windows Note:
# Unlike SteamOS, Windows doesn't have an immutable filesystem.
# We use winget for package management - it's built into Windows 11
# and handles updates automatically.

# =============================================================================
# HOSTNAME CONFIGURATION
# =============================================================================
$desiredHostname = Get-ConfigValue "hostname" ""
if ($desiredHostname -and $desiredHostname -ne "") {
    $currentHostname = $env:COMPUTERNAME
    if ($currentHostname -ne $desiredHostname) {
        Write-Status "Setting hostname: $currentHostname -> $desiredHostname" "Info"
        try {
            Rename-Computer -NewName $desiredHostname -Force -ErrorAction Stop
            Write-Status "Hostname changed to '$desiredHostname' (restart required)" "Success"
            $Script:RequiresRestart = $true
        } catch {
            Write-Status "Failed to set hostname: $_" "Error"
        }
    } else {
        Write-Status "Hostname already set to '$desiredHostname'" "Success"
    }
}

# =============================================================================
# STATIC IP CONFIGURATION
# =============================================================================
$staticIpConfig = Get-ConfigValue "static_ip" @{}
$staticIpEnabled = $staticIpConfig.enabled -eq $true

$adapter = $staticIpConfig.adapter
if (-not $adapter) { $adapter = "Ethernet" }

if ($staticIpEnabled) {
    $address = $staticIpConfig.address
    $prefixLength = $staticIpConfig.prefix_length
    if (-not $prefixLength) { $prefixLength = 24 }
    $prefixLength = [int]$prefixLength  # Ensure it's an integer
    $gateway = $staticIpConfig.gateway
    $dnsServers = $staticIpConfig.dns | Where-Object { $_ -and $_ -ne "" }

    if ($address -and $gateway) {
        Write-Status "Network config: $address/$prefixLength gateway $gateway" "Info"
        Write-Status "Configuring static IP on '$adapter'..." "Info"
        try {
            # Get the network adapter
            $netAdapter = Get-NetAdapter -Name $adapter -ErrorAction Stop
            $interfaceIndex = $netAdapter.ifIndex

            # Check if already configured correctly
            $currentIP = Get-NetIPAddress -InterfaceIndex $interfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue
            if ($currentIP.IPAddress -eq $address) {
                Write-Status "Static IP already configured: $address" "Success"
            } else {
                # Remove existing IP configuration
                $netAdapter | Remove-NetIPAddress -Confirm:$false -ErrorAction SilentlyContinue
                $netAdapter | Remove-NetRoute -Confirm:$false -ErrorAction SilentlyContinue

                # Set static IP
                $null = $netAdapter | New-NetIPAddress -IPAddress $address -PrefixLength $prefixLength -DefaultGateway $gateway -ErrorAction Stop
                Write-Status "Static IP set: $address/$prefixLength (gateway: $gateway)" "Success"
            }

            # Set DNS servers
            if ($dnsServers -and $dnsServers.Count -gt 0) {
                Set-DnsClientServerAddress -InterfaceAlias $adapter -ServerAddresses $dnsServers -ErrorAction Stop
                Write-Status "DNS servers set: $($dnsServers -join ', ')" "Success"
            }
        } catch {
            Write-Status "Failed to configure static IP: $_" "Error"
            Write-Status "Attempting to restore DHCP..." "Warning"
            try {
                # Restore DHCP if static IP failed
                Set-NetIPInterface -InterfaceAlias $adapter -Dhcp Enabled -ErrorAction SilentlyContinue
                Set-DnsClientServerAddress -InterfaceAlias $adapter -ResetServerAddresses -ErrorAction SilentlyContinue
                Write-Status "DHCP restored on '$adapter'" "Info"
            } catch {
                Write-Status "Could not restore DHCP: $_" "Error"
            }
        }
    } else {
        Write-Status "Static IP enabled but missing required values (address, gateway)" "Warning"
    }
} else {
    # Reset to DHCP if static IP is disabled
    Write-Status "Ensuring DHCP is enabled on '$adapter'..." "Info"
    try {
        $netAdapter = Get-NetAdapter -Name $adapter -ErrorAction SilentlyContinue
        if ($netAdapter) {
            $currentConfig = Get-NetIPInterface -InterfaceAlias $adapter -AddressFamily IPv4 -ErrorAction SilentlyContinue
            if ($currentConfig -and $currentConfig.Dhcp -eq 'Disabled') {
                # Remove static IP configuration
                Remove-NetIPAddress -InterfaceAlias $adapter -Confirm:$false -ErrorAction SilentlyContinue
                Remove-NetRoute -InterfaceAlias $adapter -Confirm:$false -ErrorAction SilentlyContinue
                # Enable DHCP
                Set-NetIPInterface -InterfaceAlias $adapter -Dhcp Enabled -ErrorAction Stop
                Set-DnsClientServerAddress -InterfaceAlias $adapter -ResetServerAddresses -ErrorAction Stop
                Write-Status "DHCP enabled on '$adapter'" "Success"
            } else {
                Write-Status "DHCP already enabled on '$adapter'" "Success"
            }
        }
    } catch {
        Write-Status "Could not configure DHCP: $_" "Warning"
    }
}

# =============================================================================
# PACKAGE MANAGERS SETUP
# =============================================================================

# Chocolatey - install if enabled and not already present
$pkgManagers = Get-ConfigValue "package_managers" @{}
if ($pkgManagers.chocolatey -eq $true) {
    $chocoInstalled = Get-Command choco -ErrorAction SilentlyContinue
    if ($chocoInstalled) {
        Write-Status "Chocolatey already installed" "Success"
    } elseif ($Script:DryRun) {
        Write-Status "[DRY RUN] Would install Chocolatey" "Info"
    } else {
        Write-Status "Installing Chocolatey..." "Info"
        try {
            $prevEAP = $ErrorActionPreference
            $ErrorActionPreference = "Continue"
            try {
                [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
                Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1')) 2>&1 | Out-Null
            } finally {
                $ErrorActionPreference = $prevEAP
            }
            # Refresh PATH
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
            Write-Status "Chocolatey installed" "Success"
        } catch {
            Write-Status "Failed to install Chocolatey: $_" "Warning"
        }
    }
}

# Scoop - install if enabled and not already present
if ($pkgManagers.scoop -eq $true) {
    $scoopInstalled = Get-Command scoop -ErrorAction SilentlyContinue
    if ($scoopInstalled) {
        Write-Status "Scoop already installed" "Success"
    } elseif ($Script:DryRun) {
        Write-Status "[DRY RUN] Would install Scoop" "Info"
    } else {
        Write-Status "Installing Scoop..." "Info"
        try {
            Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression 2>&1 | Out-Null
            Write-Status "Scoop installed" "Success"
        } catch {
            Write-Status "Failed to install Scoop: $_" "Warning"
        }
    }
}

# Optimize winget settings (use wininet for faster downloads)
if (Get-ConfigValue "optimize_winget" $true) {
    $wingetSettingsPath = Join-Path $env:LOCALAPPDATA "Packages\Microsoft.DesktopAppInstaller_8wekyb3d8bbwe\LocalState\settings.json"
    $wingetSettingsDir = Split-Path $wingetSettingsPath -Parent

    if (Test-Path $wingetSettingsDir) {
        if ($Script:DryRun) {
            Write-Status "[DRY RUN] Would optimize winget settings (wininet downloader)" "Info"
        } else {
            try {
                # Read existing settings or create new (PS 5.1 compatible)
                $settingsJson = $null
                if (Test-Path $wingetSettingsPath) {
                    $settingsJson = Get-Content $wingetSettingsPath -Raw -ErrorAction SilentlyContinue
                }

                # Build new settings with wininet downloader
                # Simple approach: just write the network settings we need
                $newSettings = @'
{
    "network": {
        "downloader": "wininet"
    }
}
'@
                $newSettings | Set-Content $wingetSettingsPath -Force
                Write-Status "Winget optimized (using wininet downloader)" "Success"
            } catch {
                Write-Status "Could not optimize winget: $_" "Warning"
            }
        }
    }
}

# Update winget source (don't reset - it can delete the source on some systems)
Write-Status "Updating winget source..." "Info"
try {
    # winget outputs to stderr which triggers ErrorActionPreference=Stop
    # Temporarily allow stderr without throwing
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        Write-Host "    Updating package index..." -ForegroundColor Gray
        $null = winget source update --name winget --accept-source-agreements 2>&1

        # Verify source is working
        $testResult = winget search "Microsoft.PowerShell" --source winget --accept-source-agreements 2>&1 | Out-String
    } finally {
        $ErrorActionPreference = $prevEAP
    }

    if ($testResult -match "Microsoft.PowerShell") {
        Write-Status "Winget source updated and verified" "Success"
    } else {
        Write-Status "Winget source update completed" "Warning"
    }
} catch {
    Write-Status "Could not update winget source: $_" "Warning"
}

# Install essential utilities
$essentials = @(
    @{ Id = "7zip.7zip"; Name = "7-Zip"; Condition = (Get-ConfigValue "install_7zip" $true) },
    @{ Id = "voidtools.Everything"; Name = "Everything Search"; Condition = (Get-ConfigValue "install_everything" $true) },
    @{ Id = "Microsoft.PowerToys"; Name = "PowerToys"; Condition = (Get-ConfigValue "install_powertoys" $true) }
)

foreach ($app in $essentials) {
    if ($app.Condition) {
        Install-WingetPackage -PackageId $app.Id -Name $app.Name
    }
}

# Ensure Windows Terminal is available (usually pre-installed on Win11)
$terminalInstalled = Get-AppxPackage -Name "Microsoft.WindowsTerminal" -ErrorAction SilentlyContinue
if (-not $terminalInstalled) {
    Write-Status "Installing Windows Terminal..." "Info"
    try {
        winget install --id Microsoft.WindowsTerminal --accept-source-agreements --accept-package-agreements --silent
        Write-Status "Windows Terminal installed" "Success"
    } catch {
        Write-Status "Could not install Windows Terminal" "Warning"
    }
}

# Check for Windows updates (informational only)
Write-Status "Checking Windows Update status..." "Info"
try {
    $updateSession = New-Object -ComObject Microsoft.Update.Session
    $updateSearcher = $updateSession.CreateUpdateSearcher()
    $pendingUpdates = $updateSearcher.Search("IsInstalled=0").Updates.Count
    if ($pendingUpdates -gt 0) {
        Write-Status "$pendingUpdates Windows update(s) pending - consider updating" "Warning"
    } else {
        Write-Status "Windows is up to date" "Success"
    }
} catch {
    Write-Status "Could not check Windows Update status" "Warning"
}

# Directory scaffolding
# ---------------------
# Creates the configured games/ROMs directories. Steam library registration
# is deliberately NOT automated (editing libraryfolders.vdf is unreliable -
# Steam overwrites it); add the folder in Steam > Settings > Storage.

if (Get-Command Get-ScaffoldDirectories -ErrorAction SilentlyContinue) {
    $requestedPaths = @((Get-ConfigValue "games_path" ""), (Get-ConfigValue "roms_path" "")) |
        Where-Object { $_ -and $_.Trim() }
    $scaffoldDirs = @(Get-ScaffoldDirectories -Paths $requestedPaths)
    # Make every filtered path visible: warn for entries the rooting contract
    # rejects (same regex as Get-ScaffoldDirectories). Case-duplicate drops
    # are intentional dedupe, not rejections - they do not warn.
    foreach ($requested in $requestedPaths) {
        if ($requested.Trim() -notmatch '^[A-Za-z]:[\\\/]') {
            Write-Status "Skipping '$requested' - only absolute drive-letter paths (e.g. D:\Games) are scaffolded" "Warning"
        }
    }
    foreach ($dir in $scaffoldDirs) {
        if (Test-Path $dir) {
            Write-Status "Directory exists: $dir" "Info"
        } elseif ($Script:DryRun) {
            Write-Status "[DRY RUN] Would create directory: $dir" "Info"
        } else {
            try {
                New-Item -ItemType Directory -Path $dir -Force | Out-Null
                Write-Status "Created directory: $dir" "Success"
                if (Get-Command Add-AppliedChange -ErrorAction SilentlyContinue) {
                    Add-AppliedChange "Created directory: $dir"
                }
            } catch {
                Write-Status "Could not create ${dir}: $_" "Warning"
            }
        }
    }
}

Write-Status "Base setup complete" "Success"
