<#
.SYNOPSIS
    Write a Steam Deck / SteamOS install USB: flash the (already-decompressed)
    recovery image to the stick, then append a small exFAT "BOOTIBLE" partition
    carrying the bootible payload (provision.sh + config.json + README).

.DESCRIPTION
    Mirrors prepare-usb.ps1 (Windows) for the Linux/Deck carrier validated on real
    hardware (see docs/v2/linux). The app fetches the recovery image from the open
    CDN index (steamdeck-images.steamos.cloud/recovery/) as a .img.zip and unzips
    it natively (Windows handles zip), then passes the raw .img here via -ImagePath.
    This script:
      1. confirms the target USB,
      2. takes it offline + raw-writes the .img (block-level, like dd),
      3. appends an exFAT "BOOTIBLE" partition in the free space,
      4. copies the payload bundle onto it.

    Run elevated. Destructive — it erases the chosen disk.

.PARAMETER ImagePath
    Path to the decompressed SteamOS recovery .img (the app decompresses .img.bz2).

.PARAMETER DiskNumber
    Target USB disk number (Get-Disk). If omitted, USB disks are listed + prompted.

.PARAMETER BundleDir
    Folder with the bootible payload (the `bootible/` dir from buildDeckBundle).

.PARAMETER ProgressFile
    When set, append one NDJSON {pct,message,status} per step for the app to tail.

.EXAMPLE
    .\prepare-deck-usb.ps1 -ImagePath C:\temp\steamdeck-recovery.img -DiskNumber 5 -BundleDir C:\temp\bundle
#>
[CmdletBinding(SupportsShouldProcess, ConfirmImpact = "High")]
param(
    [Parameter(Mandatory = $true)][string]$ImagePath,
    [int]$DiskNumber = -1,
    [string]$BundleDir = $PSScriptRoot,
    [string]$ProgressFile,
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "  ! $msg" -ForegroundColor Yellow }

# Emit a progress line the app tails (NDJSON, UTF-8 no BOM) + echo to console.
function Send-Progress {
    param([int]$Pct, [string]$Message, [string]$Status = "running")
    Write-Step $Message
    if ($ProgressFile) {
        $line = @{ pct = $Pct; message = $Message; status = $Status } | ConvertTo-Json -Compress
        [System.IO.File]::AppendAllText($ProgressFile, $line + [Environment]::NewLine)
    }
}

trap {
    Send-Progress 100 "Failed: $($_.Exception.Message)" "error"
    break
}

# --- 1. Resolve target disk ----------------------------------------------------
if (-not (Test-Path $ImagePath)) { throw "Image not found: $ImagePath" }

if ($DiskNumber -lt 0) {
    $usb = Get-Disk | Where-Object { $_.BusType -eq "USB" }
    if (-not $usb) { throw "No USB disks found. Insert the stick and retry." }
    $usb | Format-Table Number, FriendlyName, @{n = "SizeGB"; e = { [math]::Round($_.Size / 1GB, 1) } }, BusType
    $DiskNumber = [int](Read-Host "Enter the target USB disk Number")
}

$disk = Get-Disk -Number $DiskNumber
if ($disk.BusType -ne "USB" -and -not $Force) {
    throw "Disk $DiskNumber is $($disk.BusType), not USB. Refusing without -Force (this ERASES the disk)."
}
$sizeGb = [math]::Round($disk.Size / 1GB, 1)
if (-not $Force -and -not $PSCmdlet.ShouldProcess("Disk $DiskNumber ($($disk.FriendlyName), $sizeGb GB)", "ERASE and write SteamOS")) {
    throw "Cancelled."
}

# --- 2. Flash the recovery image (raw, block-level) ----------------------------
Send-Progress 5 "Preparing disk $DiskNumber ($($disk.FriendlyName), $sizeGb GB)"
# Clear any existing layout, then take the disk offline so no volume locks the
# raw handle while we write the image's own partition table over it.
Clear-Disk -Number $DiskNumber -RemoveData -RemoveOEM -Confirm:$false -ErrorAction SilentlyContinue
Set-Disk -Number $DiskNumber -IsOffline $true
Set-Disk -Number $DiskNumber -IsReadOnly $false -ErrorAction SilentlyContinue

$imgLen = (Get-Item $ImagePath).Length
Send-Progress 8 ("Flashing recovery image ({0} GB) -- this takes a while" -f [math]::Round($imgLen / 1GB, 1))

$src = [System.IO.File]::OpenRead($ImagePath)
$dev = New-Object System.IO.FileStream("\\.\PhysicalDrive$DiskNumber", [System.IO.FileMode]::Open, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
try {
    $buf = New-Object byte[] (4 * 1024 * 1024)
    $written = [long]0
    $lastPct = -1
    while (($n = $src.Read($buf, 0, $buf.Length)) -gt 0) {
        $dev.Write($buf, 0, $n)
        $written += $n
        # map the flash onto the 8..70 band of the overall bar
        $pct = [int](8 + ($written / $imgLen) * 62)
        if ($pct -ne $lastPct) {
            $lastPct = $pct
            Send-Progress $pct ("Flashing recovery image -- {0} / {1} GB" -f [math]::Round($written / 1GB, 1), [math]::Round($imgLen / 1GB, 1))
        }
    }
    $dev.Flush()
}
finally {
    $dev.Dispose(); $src.Dispose()
}

# --- 3. Bring the disk back + append the BOOTIBLE payload partition -------------
Send-Progress 74 "Re-reading the new partition table"
Set-Disk -Number $DiskNumber -IsOffline $false
Start-Sleep -Seconds 3   # let Windows mount the flashed partitions

# The recovery image is small; create an exFAT partition in the free space for the
# payload. exFAT is readable by SteamOS recovery + installed SteamOS (validated).
Send-Progress 80 "Adding the BOOTIBLE payload partition (exFAT)"
$part = New-Partition -DiskNumber $DiskNumber -UseMaximumSize -AssignDriveLetter
Format-Volume -Partition $part -FileSystem exFAT -NewFileSystemLabel "BOOTIBLE" -Confirm:$false | Out-Null
$drive = "$($part.DriveLetter):"

# --- 4. Copy the payload bundle ------------------------------------------------
Send-Progress 90 "Copying the bootible payload"
$payload = if (Test-Path (Join-Path $BundleDir "bootible")) { $BundleDir } else { $BundleDir }
Copy-Item -Path (Join-Path $payload "*") -Destination "$drive\" -Recurse -Force

Send-Progress 100 "Done. Boot the Deck from this USB, run Reimage, then follow BOOTIBLE\bootible\README.txt." "done"
