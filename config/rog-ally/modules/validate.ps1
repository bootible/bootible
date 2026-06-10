# Validate Module - Pre-flight Package Source Validation
# ======================================================
# Tests all winget package IDs before installation.
# Only runs during dry run mode.

if (-not $Script:DryRun) {
    return
}

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  PACKAGE SOURCE VALIDATION" -ForegroundColor White
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Testing all package sources..." -ForegroundColor Gray
Write-Host ""

# All winget packages used by bootible
$wingetPackages = @(
    # Base/Utilities
    @{ Id = "7zip.7zip"; Name = "7-Zip" },
    @{ Id = "voidtools.Everything"; Name = "Everything Search" },
    @{ Id = "Microsoft.PowerToys"; Name = "PowerToys" },
    @{ Id = "Microsoft.WindowsTerminal"; Name = "Windows Terminal" },
    @{ Id = "Microsoft.PowerShell"; Name = "PowerShell 7" },

    # Communication
    @{ Id = "Discord.Discord"; Name = "Discord" },
    @{ Id = "OpenWhisperSystems.Signal"; Name = "Signal" },

    # Media
    @{ Id = "VideoLAN.VLC"; Name = "VLC" },

    # Browsers
    @{ Id = "Mozilla.Firefox"; Name = "Firefox" },
    @{ Id = "Google.Chrome"; Name = "Chrome" },
    @{ Id = "Microsoft.Edge"; Name = "Edge" },

    # Productivity
    @{ Id = "OBSProject.OBSStudio"; Name = "OBS Studio" },
    @{ Id = "Microsoft.VisualStudioCode"; Name = "VS Code" },

    # Password Managers
    @{ Id = "AgileBits.1Password"; Name = "1Password" },
    @{ Id = "Bitwarden.Bitwarden"; Name = "Bitwarden" },
    @{ Id = "KeePassXCTeam.KeePassXC"; Name = "KeePassXC" },

    # Gaming Platforms
    @{ Id = "Valve.Steam"; Name = "Steam" },
    @{ Id = "GOG.Galaxy"; Name = "GOG Galaxy" },
    @{ Id = "EpicGames.EpicGamesLauncher"; Name = "Epic Games" },
    @{ Id = "ElectronicArts.EADesktop"; Name = "EA App" },
    @{ Id = "Ubisoft.Connect"; Name = "Ubisoft Connect" },
    @{ Id = "Amazon.Games"; Name = "Amazon Games" },
    @{ Id = "Playnite.Playnite"; Name = "Playnite" },

    # Gaming Utilities
    @{ Id = "Ryochan7.DS4Windows"; Name = "DS4Windows" },
    @{ Id = "NexusMods.Vortex"; Name = "Vortex Mod Manager" },

    # Streaming
    @{ Id = "MoonlightGameStreamingProject.Moonlight"; Name = "Moonlight" },
    @{ Id = "Parsec.Parsec"; Name = "Parsec" },
    @{ Id = "Valve.SteamLink"; Name = "Steam Link" },
    @{ Id = "Streetpea.Chiaki-ng"; Name = "Chiaki-ng" },
    @{ Id = "NVIDIA.GeForceNow"; Name = "GeForce NOW" },

    # Remote Access
    @{ Id = "Tailscale.Tailscale"; Name = "Tailscale" },
    @{ Id = "Proton.ProtonVPN"; Name = "ProtonVPN" },
    @{ Id = "RustDesk.RustDesk"; Name = "RustDesk" },
    @{ Id = "AnyDesk.AnyDesk"; Name = "AnyDesk" },

    # ROG Ally Tools
    @{ Id = "BenjaminLSR.HandheldCompanion"; Name = "Handheld Companion" },
    @{ Id = "Guru3D.RTSS"; Name = "RTSS" },
    @{ Id = "REALiX.HWiNFO"; Name = "HWiNFO" },
    @{ Id = "CPUID.CPU-Z"; Name = "CPU-Z" },
    @{ Id = "TechPowerUp.GPU-Z"; Name = "GPU-Z" },

    # Development
    @{ Id = "Git.Git"; Name = "Git" },
    @{ Id = "Python.Python.3.12"; Name = "Python 3.12" },
    @{ Id = "OpenJS.NodeJS.LTS"; Name = "Node.js LTS" },
    @{ Id = "EclipseAdoptium.Temurin.21.JDK"; Name = "Java Temurin 21" },

    # System Utilities
    @{ Id = "RevoUninstaller.RevoUninstaller"; Name = "Revo Uninstaller" },
    @{ Id = "Piriform.CCleaner"; Name = "CCleaner" },
    @{ Id = "AntibodySoftware.WizTree"; Name = "WizTree" },
    @{ Id = "Easeware.DriverEasy"; Name = "DriverEasy" },

    # Runtimes
    @{ Id = "Microsoft.DotNet.Runtime.8"; Name = ".NET Runtime 8" },
    @{ Id = "Microsoft.DotNet.DesktopRuntime.8"; Name = ".NET Desktop Runtime 8" },
    @{ Id = "Microsoft.VCRedist.2015+.x64"; Name = "VC++ 2015-2022 x64" },
    @{ Id = "Microsoft.VCRedist.2015+.x86"; Name = "VC++ 2015-2022 x86" },
    @{ Id = "Microsoft.DirectX"; Name = "DirectX Runtime" }
)

# Microsoft Store packages (tested separately)
$storePackages = @(
    @{ Id = "9MV0B5HZVK9Z"; Name = "Xbox App" }
)

$found = @()
$notFound = @()

# Suppress winget stderr
$prevEAP = $ErrorActionPreference
$ErrorActionPreference = "Continue"

# Test winget packages
foreach ($pkg in $wingetPackages) {
    Write-Host "  $($pkg.Name)... " -NoNewline
    $result = winget show --id $pkg.Id --accept-source-agreements 2>&1 | Out-String

    if ($LASTEXITCODE -eq 0 -and $result -match "Found") {
        Write-Host "OK" -ForegroundColor Green
        $found += $pkg
    } else {
        Write-Host "NOT FOUND" -ForegroundColor Red
        $notFound += $pkg
    }
}

# Test msstore packages
foreach ($pkg in $storePackages) {
    Write-Host "  $($pkg.Name)... " -NoNewline
    $result = winget show --id $pkg.Id --source msstore --accept-source-agreements 2>&1 | Out-String

    if ($LASTEXITCODE -eq 0 -and $result -match "Found") {
        Write-Host "OK (msstore)" -ForegroundColor Green
        $found += $pkg
    } else {
        Write-Host "NOT FOUND" -ForegroundColor Red
        $notFound += $pkg
    }
}

$ErrorActionPreference = $prevEAP

# Summary
Write-Host ""
$total = $wingetPackages.Count + $storePackages.Count
if ($notFound.Count -eq 0) {
    Write-Status "All $total packages validated successfully" "Success"
} else {
    Write-Status "Validated: $($found.Count)/$total packages" "Warning"
    Write-Host ""
    Write-Host "  Packages not found in sources:" -ForegroundColor Yellow
    foreach ($pkg in $notFound) {
        Write-Host "    - $($pkg.Id) ($($pkg.Name))" -ForegroundColor Red
    }
    Write-Host ""
    Write-Status "Some packages may fail to install. Consider updating package IDs." "Warning"
}

Write-Host ""

# Smart App Control breaks Armoury Crate components silently
if (Get-Command Write-SmartAppControlAdvice -ErrorAction SilentlyContinue) {
    Write-SmartAppControlAdvice -State (Get-SmartAppControlState)
}
