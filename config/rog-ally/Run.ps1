#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Bootible - ROG Ally X PowerShell Configuration
    ===============================================
    Automates the setup and configuration of an ASUS ROG Ally X running Windows.

.DESCRIPTION
    This script configures a ROG Ally X with gaming-focused software, utilities,
    and optimizations. It uses winget for package management and supports a
    private overlay for personal configurations.

.USAGE
    .\Run.ps1                    # Run with default config
    .\Run.ps1 -Tags base,apps    # Run specific modules only
    .\Run.ps1 -DryRun            # Preview changes without applying

.CONFIGURATION
    - Defaults: config.yml
    - Your settings: ../../private/device/rog-ally/<DeviceName>/config.yml
    - Shared scripts: ../../private/scripts/
    - Device images: ../../private/device/rog-ally/<DeviceName>/Images/

.NOTES
    Requires Windows 10/11 and PowerShell 5.1+
    Run as Administrator
#>

[CmdletBinding()]
param(
    [string]$ConfigFile = "",
    [string[]]$Tags = @(),
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# Roots and shared helpers are needed before transcript start so private
# device instances can be discovered (instance selection determines log path)
$Script:BootibleRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Script:DeviceRoot = $PSScriptRoot
$Script:PrivateRoot = Join-Path $Script:BootibleRoot "private"

$helpersPath = Join-Path $PSScriptRoot "lib/helpers.ps1"
if (Test-Path $helpersPath) {
    . $helpersPath
}
$validationPath = Join-Path $PSScriptRoot "lib/config-validation.ps1"
if (Test-Path $validationPath) {
    . $validationPath
}
$powerHelpersPath = Join-Path $PSScriptRoot "lib/power-helpers.ps1"
if (Test-Path $powerHelpersPath) {
    . $powerHelpersPath
}

# Select the private config to merge later. When -ConfigFile is passed (ally.ps1
# bootstrap), the instance was already chosen. Otherwise (bootible re-run),
# discover instances in the private repo and prompt if there are several.
$Script:SelectedInstance = ""
$Script:SelectedPrivateConfig = ""
if (-not $ConfigFile) {
    $instances = @(Find-PrivateDeviceConfigs -PrivateRoot $Script:PrivateRoot -Device "rog-ally")

    if ($instances.Count -eq 1) {
        $Script:SelectedPrivateConfig = $instances[0].ConfigPath
    } elseif ($instances.Count -gt 1) {
        Write-Host ""
        Write-Host "Multiple configurations found:" -ForegroundColor Cyan
        Write-Host ""
        for ($i = 0; $i -lt $instances.Count; $i++) {
            $num = $i + 1
            Write-Host "  " -NoNewline
            Write-Host "$num" -ForegroundColor Yellow -NoNewline
            Write-Host ") $($instances[$i].Name)"
        }
        Write-Host ""

        while (-not $Script:SelectedPrivateConfig) {
            $selection = Read-Host "Select configuration [1-$($instances.Count)]"
            if ($selection -match '^\d+$') {
                $idx = [int]$selection - 1
                if ($idx -ge 0 -and $idx -lt $instances.Count) {
                    $Script:SelectedPrivateConfig = $instances[$idx].ConfigPath
                    Write-Host ""
                    Write-Host "Selected: $($instances[$idx].Name)" -ForegroundColor Green
                }
            }
            if (-not $Script:SelectedPrivateConfig) {
                Write-Host "Invalid selection. Please enter a number between 1 and $($instances.Count)" -ForegroundColor Red
            }
        }
    }
}

# Extract instance name from the chosen config path (device-instance layout only,
# e.g. private/device/rog-ally/Vengeance/config.yml -> Vengeance)
$instanceSource = if ($ConfigFile) { $ConfigFile } else { $Script:SelectedPrivateConfig }
if ($instanceSource -and $instanceSource -match 'device[/\\]rog-ally[/\\]([^/\\]+)[/\\]config\.yml$') {
    $Script:SelectedInstance = $matches[1]
}

# Check if transcript already running (from ally.ps1 bootstrap)
if ($env:BOOTIBLE_TRANSCRIPT -and (Test-Path $env:BOOTIBLE_TRANSCRIPT)) {
    # Transcript already running from ally.ps1 - add spacer
    $Script:TranscriptFile = $env:BOOTIBLE_TRANSCRIPT
    $Script:TranscriptInherited = $true
    Write-Host ""
    Write-Host "===============================================================" -ForegroundColor Cyan
    Write-Host "  CONFIGURATION PHASE" -ForegroundColor White
    Write-Host "===============================================================" -ForegroundColor Cyan
    Write-Host ""
} else {
    # Start new transcript (running via bootible command directly)
    $Script:TranscriptInherited = $false
    $privatePath = $Script:PrivateRoot
    $suffix = if ($DryRun) { "_dryrun" } else { "_run" }
    $hostname = $env:COMPUTERNAME.ToLower()
    $logFileName = "$(Get-Date -Format 'yyyy-MM-dd_HHmmss')_${hostname}$suffix.log"

    if ((Test-Path $privatePath) -and $Script:SelectedInstance) {
        # Use device instance Logs folder
        $logsPath = Join-Path $privatePath "device\rog-ally\$($Script:SelectedInstance)\Logs"
        if (-not (Test-Path $logsPath)) {
            New-Item -ItemType Directory -Path $logsPath -Force | Out-Null
        }
        $Script:TranscriptFile = Join-Path $logsPath $logFileName
    } else {
        $Script:TranscriptFile = Join-Path $env:TEMP "bootible_$logFileName"
    }

    try {
        Start-Transcript -Path $Script:TranscriptFile -Force | Out-Null
    } catch {
        # Transcript failed to start, continue without it
    }
}

$Script:Config = @{}

# Installation result tracking
# Tracks attempted/succeeded/failed/skipped counts and per-package details
$Script:InstallResults = @{
    Attempted = 0
    Succeeded = 0
    Failed    = 0
    Skipped   = 0
    Packages  = @()
}

function Add-InstallResult {
    <#
    .SYNOPSIS
        Records the result of a package installation attempt.
    .PARAMETER PackageId
        The winget package ID (e.g., "Microsoft.PowerShell")
    .PARAMETER Name
        Display name of the package
    .PARAMETER Status
        Result status: "succeeded", "failed", or "skipped"
    .PARAMETER Source
        Installation source used (e.g., "winget", "msstore", "direct")
    .PARAMETER Message
        Optional message with additional details
    #>
    param(
        [Parameter(Mandatory)]
        [string]$PackageId,
        [Parameter(Mandatory)]
        [string]$Name,
        [Parameter(Mandatory)]
        [ValidateSet("succeeded", "failed", "skipped")]
        [string]$Status,
        [string]$Source = "",
        [string]$Message = ""
    )

    $Script:InstallResults.Attempted++

    switch ($Status) {
        "succeeded" { $Script:InstallResults.Succeeded++ }
        "failed"    { $Script:InstallResults.Failed++ }
        "skipped"   { $Script:InstallResults.Skipped++ }
    }

    $Script:InstallResults.Packages += @{
        PackageId = $PackageId
        Name      = $Name
        Status    = $Status
        Source    = $Source
        Message   = $Message
        Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    }
}

function Get-InstallResults {
    <#
    .SYNOPSIS
        Returns the installation results summary and package details.
    .PARAMETER SummaryOnly
        If set, returns only the counts (Attempted/Succeeded/Failed/Skipped)
    #>
    param(
        [switch]$SummaryOnly
    )

    if ($SummaryOnly) {
        return @{
            Attempted = $Script:InstallResults.Attempted
            Succeeded = $Script:InstallResults.Succeeded
            Failed    = $Script:InstallResults.Failed
            Skipped   = $Script:InstallResults.Skipped
        }
    }

    return $Script:InstallResults
}

function Write-Summary {
    <#
    .SYNOPSIS
        Outputs a formatted summary of installation results at end of run.
    .DESCRIPTION
        Displays: X installed, Y failed, Z skipped
        Lists failed packages with their error messages.
    #>
    $results = Get-InstallResults

    # Skip if no packages were processed
    if ($results.Attempted -eq 0) {
        return
    }

    Write-Host ""
    Write-Host "=================================================================" -ForegroundColor Blue
    Write-Host "  INSTALLATION SUMMARY" -ForegroundColor White
    Write-Host "=================================================================" -ForegroundColor Blue
    Write-Host ""

    # Summary line: X installed, Y failed, Z skipped
    $summaryParts = @()

    if ($results.Succeeded -gt 0) {
        $summaryParts += "$($results.Succeeded) installed"
    }
    if ($results.Failed -gt 0) {
        $summaryParts += "$($results.Failed) failed"
    }
    if ($results.Skipped -gt 0) {
        $summaryParts += "$($results.Skipped) skipped"
    }

    $summaryText = $summaryParts -join ", "
    $summaryColor = if ($results.Failed -gt 0) { "Yellow" } else { "Green" }

    Write-Host "  $summaryText" -ForegroundColor $summaryColor
    Write-Host ""

    # List failed packages with error messages
    $failedPackages = $results.Packages | Where-Object { $_.Status -eq "failed" }

    if ($failedPackages.Count -gt 0) {
        Write-Host "  Failed packages:" -ForegroundColor Red
        Write-Host ""

        foreach ($pkg in $failedPackages) {
            Write-Host "    [X] " -ForegroundColor Red -NoNewline
            Write-Host "$($pkg.Name)" -ForegroundColor White -NoNewline
            Write-Host " ($($pkg.PackageId))" -ForegroundColor Gray

            if ($pkg.Message) {
                Write-Host "        $($pkg.Message)" -ForegroundColor Yellow
            }
        }
        Write-Host ""
    }
}

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

function Write-Status {
    param([string]$Message, [string]$Type = "Info")
    $colors = @{
        "Info" = "Cyan"
        "Success" = "Green"
        "Warning" = "Yellow"
        "Error" = "Red"
    }
    $symbols = @{
        "Info" = "->"
        "Success" = "[OK]"
        "Warning" = "[!]"
        "Error" = "[X]"
    }
    Write-Host "$($symbols[$Type]) " -ForegroundColor $colors[$Type] -NoNewline
    Write-Host $Message
}

function Write-Header {
    param([string]$Title)
    Write-Host ""
    Write-Host "=================================================================" -ForegroundColor Blue
    Write-Host "  $Title" -ForegroundColor White
    Write-Host "=================================================================" -ForegroundColor Blue
    Write-Host ""
}

$Script:JsonLogEnabled = $false
$Script:JsonLogEntries = @()
$Script:JsonLogPath = $null
$Script:CurrentModule = $null

function Get-CurrentModuleName {
    if ($Script:CurrentModule) {
        return $Script:CurrentModule
    }
    return "main"
}

function Initialize-JsonLogging {
    $Script:JsonLogEnabled = $false
    $Script:JsonLogEntries = @()
    $Script:JsonLogPath = $null

    try {
        $logDir = Join-Path $env:USERPROFILE ".bootible\logs"
        if (-not (Test-Path $logDir)) {
            New-Item -ItemType Directory -Path $logDir -Force | Out-Null
        }

        $dateStamp = Get-Date -Format "yyyyMMdd"
        $Script:JsonLogPath = Join-Path $logDir "run-$dateStamp.json"

        if (Test-Path $Script:JsonLogPath) {
            try {
                $existing = Get-Content $Script:JsonLogPath -Raw | ConvertFrom-Json
                if ($existing) {
                    $Script:JsonLogEntries = @($existing)
                }
            } catch {
                $Script:JsonLogEntries = @()
            }
        }

        $Script:JsonLogEnabled = $true
    } catch {
        $Script:JsonLogEnabled = $false
    }
}

function Add-JsonLogEntry {
    param(
        [string]$Module,
        [string]$Action,
        [string]$Result,
        [double]$DurationMs
    )

    if (-not $Script:JsonLogEnabled) {
        return
    }

    $entry = [ordered]@{
        timestamp = (Get-Date).ToString("o")
        module = if ($Module) { $Module } else { "main" }
        action = $Action
        result = $Result
        duration_ms = [math]::Round($DurationMs, 2)
    }

    $Script:JsonLogEntries += $entry
}

function Write-JsonLog {
    if (-not $Script:JsonLogEnabled -or -not $Script:JsonLogPath) {
        return
    }

    try {
        $payload = $Script:JsonLogEntries | ConvertTo-Json -Depth 6
        $payload | Out-File -FilePath $Script:JsonLogPath -Encoding utf8
        Write-Status "JSON log saved: $Script:JsonLogPath" "Info"
    } catch {
        Write-Status "Failed to write JSON log: $_" "Warning"
    }
}

function Test-WingetInstalled {
    try {
        $null = Get-Command winget -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

function Install-Winget {
    Write-Status "Installing winget..." "Info"

    # Try to install via Microsoft Store
    try {
        Add-AppxPackage -RegisterByFamilyName -MainPackage Microsoft.DesktopAppInstaller_8wekyb3d8bbwe
        Write-Status "Winget installed via Microsoft Store" "Success"
        return $true
    } catch {
        Write-Status "Could not install winget automatically. Please install from Microsoft Store." "Error"
        return $false
    }
}

function Initialize-WingetSources {
    <#
    .SYNOPSIS
        Ensures winget sources are healthy before any package operations.
        Resets, updates, and verifies sources. Reports source list to output.
    #>
    Write-Header "WINGET SOURCE INITIALIZATION"

    # winget outputs to stderr which triggers ErrorActionPreference=Stop
    # Temporarily allow stderr without throwing
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    # Step 1: Reset sources to clean state
    Write-Status "Resetting winget sources..." "Info"
    $resetResult = winget source reset --force 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        Write-Status "Source reset warning: $resetResult" "Warning"
    } else {
        Write-Status "Sources reset successfully" "Success"
    }

    # Step 2: Update sources
    Write-Status "Updating winget sources..." "Info"
    $updateResult = winget source update 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        Write-Status "Source update warning: $updateResult" "Warning"
    } else {
        Write-Status "Sources updated successfully" "Success"
    }

    # Step 3: List and verify sources
    Write-Status "Verifying winget sources..." "Info"
    $sourceList = winget source list 2>&1 | Out-String

    # Check if winget source exists
    $hasWingetSource = $sourceList -match "winget"
    $hasMsStoreSource = $sourceList -match "msstore"

    # If winget source missing, add it explicitly
    if (-not $hasWingetSource) {
        Write-Status "Winget source missing - adding explicitly..." "Warning"
        $addResult = winget source add --name winget --arg "https://cdn.winget.microsoft.com/cache" --type "Microsoft.PreIndexed.Package" 2>&1 | Out-String
        if ($LASTEXITCODE -ne 0) {
            Write-Status "Failed to add winget source: $addResult" "Error"
        } else {
            Write-Status "Winget source added successfully" "Success"
            $hasWingetSource = $true
        }
        # Refresh source list
        $sourceList = winget source list 2>&1 | Out-String
    }

    # Restore ErrorActionPreference now that winget calls are done
    $ErrorActionPreference = $prevEAP

    # Display source status
    Write-Host ""
    Write-Host "  Available Sources:" -ForegroundColor Cyan
    Write-Host "  ------------------" -ForegroundColor Cyan
    foreach ($line in ($sourceList -split "`n")) {
        if ($line -match "^\s*\w") {
            Write-Host "  $line" -ForegroundColor White
        }
    }
    Write-Host ""

    # Report source availability
    if ($hasWingetSource) {
        Write-Status "Primary source (winget) available" "Success"
    } else {
        Write-Status "Primary source (winget) NOT available" "Error"
    }

    if ($hasMsStoreSource) {
        Write-Status "Fallback source (msstore) available" "Success"
    } else {
        Write-Status "Fallback source (msstore) NOT available" "Warning"
    }

    # Store source availability in script scope for Install-WingetPackage
    $Script:HasWingetSource = $hasWingetSource
    $Script:HasMsStoreSource = $hasMsStoreSource

    Write-Host ""
    return $hasWingetSource -or $hasMsStoreSource
}

function Get-ConfigValue {
    param(
        [string]$Key,
        $Default = $null
    )

    $keys = $Key -split '\.'
    $value = $Script:Config

    foreach ($k in $keys) {
        if ($value -is [hashtable] -and $value.ContainsKey($k)) {
            $value = $value[$k]
        } else {
            return $Default
        }
    }

    return $value
}

function Validate-ConfigSchema {
    <#
    .SYNOPSIS
        Validates config.yml against expected types.
        Reports ALL errors before failing. Catches misconfigurations early.
    #>
    param([hashtable]$Config)

    $errors = @()

    # Schema definition: path => expected type
    # Types: 'string', 'int', 'bool', 'list', 'hashtable', 'enum:val1,val2,...'
    $schema = @{
        # System
        'hostname' = 'string'
        'create_restore_point' = 'bool'

        # Static IP
        'static_ip.enabled' = 'bool'
        'static_ip.adapter' = 'string'
        'static_ip.address' = 'string'
        'static_ip.prefix_length' = 'int'
        'static_ip.gateway' = 'string'
        'static_ip.dns' = 'list'

        # Package managers
        'package_managers.winget' = 'bool'
        'package_managers.chocolatey' = 'bool'
        'package_managers.scoop' = 'bool'

        # Top-level install flags
        'install_apps' = 'bool'
        'install_gaming' = 'bool'
        'install_streaming' = 'bool'
        'install_remote_access' = 'bool'
        'install_ssh' = 'bool'
        'install_emulation' = 'bool'
        'install_rog_ally' = 'bool'
        'install_optimization' = 'bool'
        'install_debloat' = 'bool'
        'install_dev_tools' = 'bool'
        'install_system_utilities' = 'bool'
        'install_runtimes' = 'bool'

        # App install flags
        'install_discord' = 'bool'
        'install_signal' = 'bool'
        'install_spotify' = 'bool'
        'install_vlc' = 'bool'
        'install_firefox' = 'bool'
        'install_chrome' = 'bool'
        'install_edge' = 'bool'
        'install_obs' = 'bool'
        'install_vscode' = 'bool'
        'install_powertoys' = 'bool'
        'install_7zip' = 'bool'
        'install_everything' = 'bool'
        'install_windows_terminal' = 'bool'
        'install_powershell7' = 'bool'

        # Password manager
        'password_manager' = 'enum:1password,bitwarden,keepassxc,none'

        # Gaming
        'install_steam' = 'bool'
        'install_gog_galaxy' = 'bool'
        'install_epic_launcher' = 'bool'
        'install_ea_app' = 'bool'
        'install_ubisoft_connect' = 'bool'
        'install_battle_net' = 'bool'
        'install_amazon_games' = 'bool'
        'install_playnite' = 'bool'
        'install_launchbox' = 'bool'
        'install_ds4windows' = 'bool'
        'install_hidmanager' = 'bool'
        'install_nexus_mods' = 'bool'
        'install_reshade' = 'bool'

        # Streaming
        'install_moonlight' = 'bool'
        'install_parsec' = 'bool'
        'install_steam_link' = 'bool'
        'install_chiaki' = 'bool'
        'install_greenlight' = 'bool'
        'install_xbox_app' = 'bool'
        'install_geforcenow' = 'bool'

        # Remote access
        'install_tailscale' = 'bool'
        'install_protonvpn' = 'bool'
        'install_anydesk' = 'bool'
        'install_rustdesk' = 'bool'
        'install_parsec_remote' = 'bool'

        # SSH
        'ssh_server_enable' = 'bool'
        'ssh_import_authorized_keys' = 'bool'
        'ssh_authorized_keys' = 'list'
        'ssh_key_name' = 'string'
        'ssh_generate_key' = 'bool'
        'ssh_add_to_github' = 'bool'
        'ssh_save_to_private' = 'bool'
        'ssh_configure_git' = 'bool'

        # Emulation
        'install_emudeck' = 'bool'
        'install_retroarch' = 'bool'
        'install_emulationstation' = 'bool'
        'install_dolphin' = 'bool'
        'install_pcsx2' = 'bool'
        'install_rpcs3' = 'bool'
        'install_yuzu' = 'bool'
        'install_ryujinx' = 'bool'
        'install_cemu' = 'bool'
        'install_duckstation' = 'bool'
        'install_ppsspp' = 'bool'

        # ROG Ally specific
        'install_armoury_crate' = 'bool'
        'install_myasus' = 'bool'
        'install_handheld_companion' = 'bool'
        'install_rtss' = 'bool'
        'install_hwinfo' = 'bool'
        'install_msi_afterburner' = 'bool'
        'install_ghelper' = 'bool'
        'install_cpuz' = 'bool'
        'install_gpuz' = 'bool'
        'configure_power_plans' = 'bool'

        # Optimization
        'disable_xbox_game_bar' = 'bool'
        'disable_game_dvr' = 'bool'
        'disable_tips' = 'bool'
        'disable_cortana' = 'bool'
        'enable_game_mode' = 'bool'
        'enable_hardware_gpu_scheduling' = 'bool'
        'disable_fullscreen_optimizations' = 'bool'
        'disable_core_isolation' = 'bool'
        'disable_vm_platform' = 'bool'
        'disable_bitlocker' = 'bool'
        'disable_amd_varibright' = 'bool'
        'steam_disable_guide_focus' = 'bool'
        'steam_start_big_picture' = 'bool'
        'configure_hdr' = 'bool'
        'set_refresh_rate' = 'int'
        'enable_storage_sense' = 'bool'
        'compact_os' = 'bool'
        'run_disk_cleanup' = 'bool'
        'force_time_sync' = 'bool'
        'generate_battery_report' = 'bool'

        # Paths
        'user_home' = 'string'
        'games_path' = 'string'
        'roms_path' = 'string'
        'bios_path' = 'string'

        # Debloat
        'disable_telemetry' = 'bool'
        'disable_activity_history' = 'bool'
        'disable_location_tracking' = 'bool'
        'disable_copilot' = 'bool'
        'disable_lockscreen_junk' = 'bool'
        'classic_right_click_menu' = 'bool'
        'disable_bing_search' = 'bool'
        'show_file_extensions' = 'bool'
        'show_hidden_files' = 'bool'
        'clean_desktop_shortcuts' = 'bool'
        'wallpaper_path' = 'string'
        'wallpaper_style' = 'enum:Fill,Fit,Stretch,Center,Tile,Span'
        'lockscreen_path' = 'string'
        'debloat_edge' = 'bool'
        'disable_edge' = 'bool'
        'prefer_ipv4' = 'bool'
        'disable_teredo' = 'bool'
        'set_services_manual' = 'bool'
        'powershell7_default_terminal' = 'bool'
        'disable_powershell7_telemetry' = 'bool'

        # Power & sleep
        'sleep_mode' = 'enum:default,hibernate'
        'hibernate_after_minutes' = 'int'
        'power_button_action' = 'enum:,sleep,hibernate,shutdown'

        # Development
        'install_git' = 'bool'
        'install_python' = 'bool'
        'install_nodejs' = 'bool'
        'install_java' = 'bool'

        # System utilities
        'install_revo_uninstaller' = 'bool'
        'install_ccleaner' = 'bool'
        'install_wiztree' = 'bool'
        'install_drivereasy' = 'bool'

        # Runtimes
        'install_dotnet_runtime' = 'bool'
        'install_dotnet_desktop' = 'bool'
        'install_vcredist' = 'bool'
        'install_directx' = 'bool'
    }

    # Helper to get nested value
    function Get-NestedValue {
        param([hashtable]$Obj, [string]$Path)
        $keys = $Path -split '\.'
        $current = $Obj
        foreach ($key in $keys) {
            if ($null -eq $current) { return $null }
            if ($current -is [hashtable] -and $current.ContainsKey($key)) {
                $current = $current[$key]
            } else {
                return $null
            }
        }
        return $current
    }

    # Validate each schema entry
    foreach ($entry in $schema.GetEnumerator()) {
        $path = $entry.Key
        $expectedType = $entry.Value
        $value = Get-NestedValue -Obj $Config -Path $path

        # Skip if value not present (optional fields)
        if ($null -eq $value) { continue }

        $valid = $false
        $actualType = ""

        switch -Regex ($expectedType) {
            '^string$' {
                $valid = $value -is [string]
                $actualType = $value.GetType().Name
            }
            '^int$' {
                $valid = $value -is [int] -or $value -is [long] -or ($value -is [string] -and $value -match '^\d+$')
                $actualType = $value.GetType().Name
            }
            '^bool$' {
                $valid = $value -is [bool]
                $actualType = $value.GetType().Name
            }
            '^list$' {
                $valid = $value -is [array] -or $value -is [System.Collections.ArrayList] -or $value -is [System.Collections.Generic.List[object]]
                $actualType = $value.GetType().Name
            }
            '^hashtable$' {
                $valid = $value -is [hashtable] -or $value -is [System.Collections.Specialized.OrderedDictionary]
                $actualType = $value.GetType().Name
            }
            '^enum:(.+)$' {
                $allowedValues = $Matches[1] -split ','
                $valid = $value -in $allowedValues
                $actualType = "value '$value'"
                if (-not $valid) {
                    $errors += "  - $path : expected one of [$($allowedValues -join ', ')], got $actualType"
                    continue
                }
            }
        }

        if (-not $valid -and $expectedType -notmatch '^enum:') {
            $errors += "  - $path : expected $expectedType, got $actualType (value: $value)"
        }
    }

    return $errors
}

function Ensure-YamlModule {
    <#
    .SYNOPSIS
        Ensures the powershell-yaml module is installed for proper YAML parsing.
    .DESCRIPTION
        For offline environments, pre-install the module:
        Install-Module -Name powershell-yaml -Scope CurrentUser
    #>
    if (-not (Get-Module -ListAvailable -Name powershell-yaml)) {
        Write-Status "Installing powershell-yaml module..." "Info"
        try {
            # Check for network connectivity first (use TCP on 443, ICMP often blocked)
            $galleryHost = "www.powershellgallery.com"
            $canReachGallery = (Test-NetConnection -ComputerName $galleryHost -Port 443 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue).TcpTestSucceeded
            if (-not $canReachGallery) {
                Write-Status "Cannot reach PowerShell Gallery (offline or blocked)" "Warning"
                Write-Host ""
                Write-Host "  To use Bootible offline, pre-install the YAML module:" -ForegroundColor Yellow
                Write-Host "    Install-Module -Name powershell-yaml -Scope CurrentUser" -ForegroundColor Cyan
                Write-Host ""
                Write-Host "  Or on another machine, save it for transfer:" -ForegroundColor Yellow
                Write-Host "    Save-Module -Name powershell-yaml -Path C:\Modules" -ForegroundColor Cyan
                Write-Host ""
                return $false
            }

            Install-Module -Name powershell-yaml -Force -Scope CurrentUser -AllowClobber -ErrorAction Stop
            Write-Status "powershell-yaml module installed" "Success"
        } catch {
            Write-Status "Failed to install powershell-yaml: $($_.Exception.Message)" "Error"
            Write-Host ""
            Write-Host "  Manual installation:" -ForegroundColor Yellow
            Write-Host "    Install-Module -Name powershell-yaml -Scope CurrentUser" -ForegroundColor Cyan
            Write-Host ""
            return $false
        }
    }

    try {
        Import-Module powershell-yaml -ErrorAction Stop
        return $true
    } catch {
        Write-Status "Failed to import powershell-yaml: $($_.Exception.Message)" "Error"
        return $false
    }
}

function Import-YamlConfig {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        return @{}
    }

    $content = Get-Content $Path -Raw

    # Use powershell-yaml for proper YAML parsing
    try {
        $config = ConvertFrom-Yaml $content -ErrorAction Stop

        # ConvertFrom-Yaml returns OrderedDictionary, convert to hashtable for consistency
        if ($config -is [System.Collections.Specialized.OrderedDictionary]) {
            $config = Convert-OrderedDictToHashtable $config
        }

        return $config
    } catch {
        Write-Status "YAML parse error in ${Path}: $($_.Exception.Message)" "Error"
        throw "Failed to parse YAML config: $Path"
    }
}

# Note: Convert-OrderedDictToHashtable and Merge-Configs are imported from lib/helpers.ps1

function Install-WingetPackage {
    param(
        [string]$PackageId,
        [string]$Name,
        [switch]$Force,
        [int]$TimeoutSeconds = 300  # 5 minute timeout per source (larger packages like VLC need more time)
    )

    $operationStart = Get-Date
    $logAction = "install:$Name"
    $logModule = Get-CurrentModuleName
    $completeLog = {
        param([string]$Result)
        $durationMs = ((Get-Date) - $operationStart).TotalMilliseconds
        Add-JsonLogEntry -Module $logModule -Action $logAction -Result $Result -DurationMs $durationMs
    }

    # Check if already installed first (even in DryRun)
    try {
        # Check both sources for existing installation
        $installed = winget list --id $PackageId --accept-source-agreements 2>$null
        if ($installed -match $PackageId) {
            Write-Status "$Name already installed - skipping" "Success"
            & $completeLog "skipped"
            return $true
        }
    } catch {
        # winget list failed, continue with install attempt
    }

    if ($Script:DryRun) {
        # Validate package exists (check winget first, then msstore)
        Write-Host "    Validating $PackageId..." -ForegroundColor Gray -NoNewline

        $foundInWinget = $false
        $foundInMsStore = $false

        # winget outputs to stderr which triggers ErrorActionPreference=Stop
        # Temporarily allow stderr without throwing
        $prevEAP = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            if ($Script:HasWingetSource) {
                $showResult = winget show --id $PackageId --source winget --accept-source-agreements 2>&1 | Out-String
                if ($LASTEXITCODE -eq 0 -and $showResult -match "Found") {
                    $foundInWinget = $true
                }
            }

            if (-not $foundInWinget -and $Script:HasMsStoreSource) {
                $showResult = winget show --id $PackageId --source msstore --accept-source-agreements 2>&1 | Out-String
                if ($LASTEXITCODE -eq 0 -and $showResult -match "Found") {
                    $foundInMsStore = $true
                }
            }
        } finally {
            $ErrorActionPreference = $prevEAP
        }

        if ($foundInWinget) {
            Write-Host " OK (winget)" -ForegroundColor Green
            Write-Status "[DRY RUN] Would install: $Name ($PackageId) from winget" "Info"
            & $completeLog "dry_run"
            return $true
        } elseif ($foundInMsStore) {
            Write-Host " OK (msstore)" -ForegroundColor Yellow
            Write-Status "[DRY RUN] Would install: $Name ($PackageId) from msstore (fallback)" "Info"
            & $completeLog "dry_run"
            return $true
        } else {
            Write-Host " NOT FOUND" -ForegroundColor Red
            Write-Status "[DRY RUN] Package not found in any source: $PackageId" "Warning"
            & $completeLog "not_found"
            return $false
        }
    }

    Write-Status "Installing $Name..." "Info"

    # Helper function to run winget with timeout
    $runWingetWithTimeout = {
        param($PackageId, $Source, $TimeoutSeconds)

        $job = Start-Job -ScriptBlock {
            param($id, $src)
            $result = winget install --id $id --source $src --accept-source-agreements --accept-package-agreements --silent 2>&1
            @{ ExitCode = $LASTEXITCODE; Output = $result }
        } -ArgumentList $PackageId, $Source

        $completed = Wait-Job $job -Timeout $TimeoutSeconds

        if ($completed) {
            $jobResult = Receive-Job $job
            Remove-Job $job -Force
            return $jobResult
        } else {
            # Timeout - kill the job and any winget processes it spawned
            Stop-Job $job -ErrorAction SilentlyContinue
            Remove-Job $job -Force -ErrorAction SilentlyContinue
            # Kill any hanging winget processes
            Get-Process -Name "winget" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
            return @{ ExitCode = -1; Output = "Timeout after $TimeoutSeconds seconds"; TimedOut = $true }
        }
    }

    # Try winget source first
    if ($Script:HasWingetSource) {
        Write-Host "    Trying winget source (${TimeoutSeconds}s timeout)..." -ForegroundColor Gray
        $result = & $runWingetWithTimeout $PackageId "winget" $TimeoutSeconds

        if ($result.TimedOut) {
            Write-Host "    Winget timed out after ${TimeoutSeconds}s" -ForegroundColor Yellow
        } elseif ($result.ExitCode -eq 0) {
            Write-Status "$Name installed (winget)" "Success"
            & $completeLog "success"
            return $true
        } else {
            Write-Host "    Winget source failed (exit code $($result.ExitCode))" -ForegroundColor Yellow
        }
    }

    # Fallback to msstore
    if ($Script:HasMsStoreSource) {
        Write-Host "    Falling back to msstore (${TimeoutSeconds}s timeout)..." -ForegroundColor Yellow
        $result = & $runWingetWithTimeout $PackageId "msstore" $TimeoutSeconds

        if ($result.TimedOut) {
            Write-Host "    msstore timed out after ${TimeoutSeconds}s" -ForegroundColor Red
        } elseif ($result.ExitCode -eq 0) {
            Write-Status "$Name installed (msstore fallback)" "Success"
            & $completeLog "success"
            return $true
        } else {
            Write-Host "    msstore also failed (exit code $($result.ExitCode))" -ForegroundColor Red
        }
    }

    # Both sources failed - show error details
    Write-Status "Failed to install $Name from all sources" "Warning"
    if ($result.Output -and -not $result.TimedOut) {
        $errorLines = $result.Output | Where-Object { $_ -match "error|fail|not found|applicable" } | Select-Object -First 3
        foreach ($line in $errorLines) {
            Write-Host "    $line" -ForegroundColor Yellow
        }
    }
    & $completeLog "failed"
    return $false
}

function Install-DirectDownload {
    <#
    .SYNOPSIS
        Downloads and runs an installer directly from a URL.
        Use as fallback when winget fails.
    .PARAMETER Name
        Display name of the application
    .PARAMETER Url
        Direct download URL for the installer
    .PARAMETER InstallerArgs
        Arguments to pass to the installer (default: /S for silent)
    .PARAMETER InstallerType
        Type of installer: "exe", "msi", or "auto" (default: auto-detect from URL)
    .PARAMETER PostInstall
        ScriptBlock to run after successful installation
    #>
    param(
        [string]$Name,
        [string]$Url,
        [string]$InstallerArgs = "/S",
        [string]$InstallerType = "auto",
        [scriptblock]$PostInstall = $null
    )

    $operationStart = Get-Date
    $logAction = "download-install:$Name"
    $logModule = Get-CurrentModuleName
    $completeLog = {
        param([string]$Result)
        $durationMs = ((Get-Date) - $operationStart).TotalMilliseconds
        Add-JsonLogEntry -Module $logModule -Action $logAction -Result $Result -DurationMs $durationMs
    }

    if ($Script:DryRun) {
        Write-Status "[DRY RUN] Would download and install: $Name" "Info"
        Write-Host "    URL: $Url" -ForegroundColor Gray
        & $completeLog "dry_run"
        return $true
    }

    Write-Status "Downloading $Name..." "Info"
    Write-Host "    URL: $Url" -ForegroundColor Gray

    # Determine file extension
    $extension = ".exe"
    if ($InstallerType -eq "msi") {
        $extension = ".msi"
    } elseif ($InstallerType -eq "auto" -and $Url -match "\.msi(\?|$)") {
        $extension = ".msi"
    }

    $tempFile = Join-Path $env:TEMP "$($Name -replace '[^a-zA-Z0-9]', '_')_Setup$extension"

    try {
        # Download with progress
        $ProgressPreference = 'SilentlyContinue'
        Invoke-WebRequest -Uri $Url -OutFile $tempFile -UseBasicParsing -ErrorAction Stop
        $ProgressPreference = 'Continue'

        if (-not (Test-Path $tempFile)) {
            throw "Download failed - file not created"
        }

        $fileSize = (Get-Item $tempFile).Length / 1MB
        Write-Host "    Downloaded: $([math]::Round($fileSize, 1)) MB" -ForegroundColor Gray

        Write-Status "Installing $Name..." "Info"

        # Run installer based on type
        if ($extension -eq ".msi") {
            $process = Start-Process -FilePath "msiexec.exe" -ArgumentList "/i `"$tempFile`" /qn /norestart" -Wait -PassThru -ErrorAction Stop
        } else {
            # Handle different installer argument formats
            if ($InstallerArgs) {
                $process = Start-Process -FilePath $tempFile -ArgumentList $InstallerArgs -Wait -PassThru -ErrorAction Stop
            } else {
                $process = Start-Process -FilePath $tempFile -Wait -PassThru -ErrorAction Stop
            }
        }

        if ($process.ExitCode -eq 0 -or $process.ExitCode -eq 3010) {
            Write-Status "$Name installed successfully" "Success"

            # Run post-install script if provided
            if ($PostInstall) {
                try {
                    & $PostInstall
                } catch {
                    Write-Status "Post-install script warning: $_" "Warning"
                }
            }

            & $completeLog "success"
            return $true
        } else {
            Write-Status "$Name installer exited with code: $($process.ExitCode)" "Warning"
            & $completeLog "failed"
            return $false
        }
    } catch {
        Write-Status "Failed to download/install $Name : $_" "Error"
        & $completeLog "failed"
        return $false
    } finally {
        # Cleanup
        if (Test-Path $tempFile) {
            Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
        }
    }
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

Write-Host ""
Write-Host "+------------------------------------------------------------+" -ForegroundColor Cyan
Write-Host "|                      Bootible                              |" -ForegroundColor White
Write-Host "|             ROG Ally X Configuration                       |" -ForegroundColor Gray
Write-Host "+------------------------------------------------------------+" -ForegroundColor Cyan
Write-Host ""

# Verify running on Windows
if ($env:OS -ne "Windows_NT") {
    Write-Status "This script is designed for Windows" "Error"
    exit 1
}

# Verify admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Status "Please run as Administrator" "Error"
    exit 1
}

Write-Status "Running as Administrator" "Success"

# Check/install winget
if (-not (Test-WingetInstalled)) {
    Write-Status "Winget not found" "Warning"
    if (-not (Install-Winget)) {
        exit 1
    }
}
Write-Status "Winget available" "Success"

# Initialize and verify winget sources
if (-not (Initialize-WingetSources)) {
    Write-Status "No package sources available - cannot continue" "Error"
    exit 1
}

# Ensure YAML module is available for config parsing
if (-not (Ensure-YamlModule)) {
    Write-Status "Cannot parse YAML configs without powershell-yaml module" "Error"
    exit 1
}
Write-Status "YAML parser ready" "Success"

# Load configuration
# Always start with defaults, then merge overlays on top
# Priority: -ConfigFile > private repo selection > local ~/.config > defaults
$defaultConfig = Join-Path $Script:DeviceRoot "config.yml"
$localConfig = Join-Path $env:USERPROFILE ".config\bootible\rog-ally\config.yml"

# Always load defaults first
if (Test-Path $defaultConfig) {
    $Script:Config = Import-YamlConfig $defaultConfig
    Write-Status "Loaded default config" "Info"
}

if ($ConfigFile -and (Test-Path $ConfigFile)) {
    # Merge specified config file on top of defaults
    $customSettings = Import-YamlConfig $ConfigFile
    $Script:Config = Merge-Configs $Script:Config $customSettings
    Write-Status "Merged config: $(Split-Path $ConfigFile -Leaf)" "Info"
} else {
    # Merge local config if exists (~/.config/bootible/rog-ally/config.yml)
    if (Test-Path $localConfig) {
        $localSettings = Import-YamlConfig $localConfig
        $Script:Config = Merge-Configs $Script:Config $localSettings
        Write-Status "Merged local config: $localConfig" "Info"
    }

    # Merge the private config selected during instance discovery (top of script)
    if ($Script:SelectedPrivateConfig -and (Test-Path $Script:SelectedPrivateConfig)) {
        $privateSettings = Import-YamlConfig $Script:SelectedPrivateConfig
        $Script:Config = Merge-Configs $Script:Config $privateSettings
        $configLabel = if ($Script:SelectedInstance) { $Script:SelectedInstance } else { Split-Path $Script:SelectedPrivateConfig -Leaf }
        Write-Status "Merged private config: $configLabel" "Info"
    }
}

if (Get-Command Validate-Config -ErrorAction SilentlyContinue) {
    $validation = Validate-Config

    foreach ($warning in $validation.Warnings) {
        Write-Status $warning "Warning"
    }

    if (-not $validation.Valid) {
        foreach ($validationError in $validation.Errors) {
            Write-Status $validationError "Error"
        }
        Write-Status "Config validation failed" "Error"
        exit 1
    }
}

$Script:DryRun = $DryRun

# Validate configuration schema
# -----------------------------
# Validates all config values against expected types. Reports ALL errors before failing.
Write-Header "CONFIGURATION VALIDATION"
$validationErrors = Validate-ConfigSchema -Config $Script:Config
if ($validationErrors.Count -gt 0) {
    Write-Status "Configuration errors found:" "Error"
    Write-Host ""
    foreach ($err in $validationErrors) {
        Write-Host $err -ForegroundColor Red
    }
    Write-Host ""
    Write-Status "Fix the above errors in your config.yml before continuing." "Error"
    exit 1
} else {
    Write-Status "Configuration schema valid" "Success"
}

Initialize-JsonLogging
if ($Script:JsonLogEnabled) {
    Write-Status "JSON logging enabled" "Info"
}

# Create System Restore Point
# ---------------------------
# Creates a restore point before making changes (unless disabled or dry run)

if (Get-ConfigValue "create_restore_point" $true) {
    if (-not $Script:DryRun) {
        Write-Status "Creating System Restore Point..." "Info"
        try {
            # Enable System Restore on C: if not already enabled
            Enable-ComputerRestore -Drive "C:\" -ErrorAction SilentlyContinue

            # Create restore point
            Checkpoint-Computer -Description "Bootible Pre-Setup $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -RestorePointType "MODIFY_SETTINGS" -ErrorAction Stop
            Write-Status "Restore point created" "Success"
        } catch {
            if ($_.Exception.Message -match "1058") {
                Write-Status "System Restore service not running - skipping restore point" "Warning"
            } elseif ($_.Exception.Message -match "already been created") {
                Write-Status "Restore point already exists (limit: 1 per 24 hours)" "Info"
            } else {
                Write-Status "Could not create restore point: $($_.Exception.Message)" "Warning"
            }
        }
    } else {
        Write-Status "[DRY RUN] Would create System Restore Point" "Info"
    }
}

# Load and run modules
$modulesPath = Join-Path $Script:DeviceRoot "modules"

$moduleOrder = @(
    "validate",       # Validate package sources first (dry run only)
    "base",
    "apps",           # Install apps first so debloat can configure them
    "gaming",
    "streaming",
    "remote_access",
    "ssh",            # SSH keys after remote_access
    "emulation",
    "rog_ally",
    "optimization",   # Optimization after all installs
    "power",          # Power/sleep settings after optimization
    "debloat",        # Debloat last (configures installed apps like PS7)
    "health"          # Post-install checks
)

foreach ($moduleName in $moduleOrder) {
    $modulePath = Join-Path $modulesPath "$moduleName.ps1"

    # Skip if tags specified and this module not in tags
    if ($Tags.Count -gt 0 -and $moduleName -notin $Tags) {
        continue
    }

    if (Test-Path $modulePath) {
        $Script:CurrentModule = $moduleName
        Write-Header $moduleName.ToUpper()
        . $modulePath
        $Script:CurrentModule = $null
    }
}

# Display installation summary
Write-Summary

# Gather system information for summary
function Get-NetworkSummary {
    try {
        # Get the default network adapter (the one with a default gateway)
        $defaultAdapter = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue |
            Sort-Object RouteMetric |
            Select-Object -First 1

        if ($defaultAdapter) {
            $adapter = Get-NetAdapter -InterfaceIndex $defaultAdapter.InterfaceIndex -ErrorAction SilentlyContinue
            $ipConfig = Get-NetIPAddress -InterfaceIndex $defaultAdapter.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue |
                Select-Object -First 1
            $dhcpEnabled = (Get-NetIPInterface -InterfaceIndex $defaultAdapter.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue).Dhcp -eq 'Enabled'

            return @{
                IPAddress = $ipConfig.IPAddress
                IPType = if ($dhcpEnabled) { "DHCP" } else { "Static" }
                MACAddress = $adapter.MacAddress
                Interface = $adapter.Name
            }
        }
    } catch {
        # Silently handle errors
    }

    return @{
        IPAddress = "Unknown"
        IPType = "Unknown"
        MACAddress = "Unknown"
        Interface = "Unknown"
    }
}

$networkInfo = Get-NetworkSummary

# Complete
Write-Host ""
if ($Script:DryRun) {
    Write-Host "+------------------------------------------------------------+" -ForegroundColor Yellow
    Write-Host "|                   DRY RUN COMPLETE                         |" -ForegroundColor White
    Write-Host "+------------------------------------------------------------+" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "No changes were made. Run without -DryRun to apply changes." -ForegroundColor Yellow
} else {
    Write-Host "+------------------------------------------------------------+" -ForegroundColor Green
    Write-Host "|                   Setup Complete!                          |" -ForegroundColor White
    Write-Host "+------------------------------------------------------------+" -ForegroundColor Green
}

Write-Host ""
Write-Host "System Information:" -ForegroundColor Cyan
Write-Host "  Hostname:    $env:COMPUTERNAME"
Write-Host "  IP Address:  $($networkInfo.IPAddress)"
Write-Host "  IP Type:     $($networkInfo.IPType)"
Write-Host "  MAC Address: $($networkInfo.MACAddress)"
Write-Host "  Interface:   $($networkInfo.Interface)"
Write-Host ""

if (-not $Script:DryRun) {
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  - Restart your device to apply all changes"
    Write-Host "  - Configure Armoury Crate for performance profiles"
    Write-Host "  - Set up game streaming apps (Moonlight, Chiaki, etc.)"
    Write-Host "  - Check README for additional configuration"
    Write-Host ""
}

Write-JsonLog

# Handle transcript and log push
# If transcript was inherited from ally.ps1, let ally.ps1 handle stop/push
# If we started our own transcript, we handle stop/push
if (-not $Script:TranscriptInherited) {
    # Stop transcript
    try { Stop-Transcript | Out-Null } catch { }

    # Wait for transcript file to fully flush to disk
    Start-Sleep -Seconds 2

    $privatePath = Join-Path $Script:BootibleRoot "private"
    if ((Test-Path $privatePath) -and $Script:TranscriptFile -and (Test-Path $Script:TranscriptFile)) {
        $logFileName = Split-Path -Leaf $Script:TranscriptFile
        $logType = if ($Script:DryRun) { "Dry run" } else { "Run" }
        Write-Host "[OK] $logType log saved: $logFileName" -ForegroundColor Green

        # Push to git
        $gitExe = Get-Command git -ErrorAction SilentlyContinue
        if ($gitExe) {
            Push-Location $privatePath
            $prevEAP = $ErrorActionPreference
            $ErrorActionPreference = "Continue"
            try {
                $runType = if ($Script:DryRun) { "dry run" } else { "run" }

                # Build log path based on whether we have a selected instance
                if ($Script:SelectedInstance) {
                    $logRelPath = "device/rog-ally/$($Script:SelectedInstance)/Logs/$logFileName"
                    $logGlobPath = "device/rog-ally/$($Script:SelectedInstance)/Logs/*.log"
                    $instanceName = $Script:SelectedInstance
                } else {
                    # Fallback if no instance (shouldn't happen normally)
                    $logRelPath = "device/rog-ally"
                    $logGlobPath = "device/rog-ally/**/*.log"
                    $instanceName = "rog-ally"
                }

                # Verify log file exists before attempting git operations
                if (-not (Test-Path $logRelPath)) {
                    Write-Host "[!] Log file not found: $logRelPath" -ForegroundColor Yellow
                } else {
                    # Stage all log files (including any from failed previous runs)
                    & git add $logGlobPath 2>$null

                    # Check if there's anything to commit
                    $stagedFiles = & git diff --cached --name-only 2>$null
                    if ($stagedFiles) {
                        # Commit with output captured to verify success
                        $commitOutput = & git commit -m "log: $instanceName $runType $(Get-Date -Format 'yyyy-MM-dd HH:mm')" 2>&1

                        # Verify commit actually happened by checking if files are still staged
                        $stillStaged = & git diff --cached --name-only 2>$null
                        if (-not $stillStaged) {
                            # Commit succeeded, now push
                            cmd /c "git push 2>nul"
                            if ($LASTEXITCODE -ne 0) {
                                # Check if SSH rewrite is configured
                                $sshConfig = git config --global --get url."git@github.com:".insteadOf 2>$null
                                if ($sshConfig) {
                                    Write-Host "[!] SSH push failed, retrying with HTTPS..." -ForegroundColor Yellow
                                    git config --global --unset url."git@github.com:".insteadOf 2>$null
                                    cmd /c "git push 2>nul"
                                }
                            }

                            if ($LASTEXITCODE -eq 0) {
                                Write-Host "[OK] Log pushed to private repo" -ForegroundColor Green
                            } else {
                                Write-Host "[!] Commit saved locally, push failed" -ForegroundColor Yellow
                            }
                        } else {
                            Write-Host "[!] Commit failed: $commitOutput" -ForegroundColor Yellow
                        }
                    } else {
                        Write-Host "[OK] Log saved (no changes to push)" -ForegroundColor Gray
                    }
                }
            } finally {
                $ErrorActionPreference = $prevEAP
                Pop-Location
            }
        }
    } elseif ($Script:TranscriptFile -and (Test-Path $Script:TranscriptFile)) {
        # Temp file - clean up
        Remove-Item $Script:TranscriptFile -Force -ErrorAction SilentlyContinue
    }
}
