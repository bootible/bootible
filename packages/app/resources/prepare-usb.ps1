#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Build a bootible zero-touch install USB for the ROG Ally.

.DESCRIPTION
    Resolves a Windows 11 ISO (an existing one, or downloaded from Microsoft via
    Fido), fetches the MediaTek MT7922 WiFi driver, formats a USB stick you
    select, lays down the Windows installer, and copies the bootible bundle
    (autounattend.xml + bootstrap + config + WiFi) onto it.

    SAFETY: this ERASES the chosen USB. It only ever lists removable USB disks,
    never auto-picks, and requires you to type ERASE to confirm. Supports
    -WhatIf to print the plan without touching anything.

    HARDWARE-GATED: this performs real disk + media operations that can only be
    validated by building a stick and booting an Ally — it is not unit-tested.

    KNOWN FOLLOW-UP: Windows 11 25H2's "ConX" setup path can drop oobeSystem
    passes from answer files. If you hit that, build with Rufus 4.14 (handles it)
    or inject winpeshl.ini into boot.wim — not yet automated here.

.PARAMETER BundleDir
    Folder the app wrote the bundle into (autounattend.xml + sources/$OEM$/...).

.PARAMETER IsoPath
    Path to an existing Windows 11 ISO. If omitted, Fido downloads one.

.PARAMETER DriverPath
    Folder containing the extracted MT7922 driver (.inf/.sys). If omitted, the
    Microsoft Update Catalog is searched (best-effort) by DriverQuery.

.PARAMETER DiskNumber
    Target USB disk number. If omitted, you're shown the list and prompted.

.EXAMPLE
    .\prepare-usb.ps1 -BundleDir C:\temp\bundle -IsoPath D:\Win11.iso
#>
[CmdletBinding(SupportsShouldProcess, ConfirmImpact = "High")]
param(
    [Parameter(Mandatory)][string]$BundleDir,
    [string]$IsoPath,
    [string]$DriverPath,
    [int]$DiskNumber = -1,
    [string]$DriverQuery = "MediaTek Wi-Fi 6E MT7922",
    [switch]$Force
)

$ErrorActionPreference = "Stop"
# robocopy/dism/format return non-zero success codes; don't let PS 7.4+ treat
# those native exit codes as terminating errors.
$PSNativeCommandUseErrorActionPreference = $false

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "  ! $msg" -ForegroundColor Yellow }

# --- 1. Windows ISO -------------------------------------------------------
function Resolve-WindowsIso {
    if ($IsoPath -and (Test-Path $IsoPath)) {
        Write-Step "Using provided ISO: $IsoPath"
        return (Resolve-Path $IsoPath).Path
    }
    Write-Step "Downloading a Windows 11 ISO from Microsoft (Fido)..."
    $fido = Join-Path $env:TEMP "Fido.ps1"
    Invoke-WebRequest "https://github.com/pbatard/Fido/raw/master/Fido.ps1" -OutFile $fido
    # Fido prints a genuine microsoft.com download URL for the chosen edition.
    $url = & $fido -Win "11" -Ed "Home/Pro" -Lang "English International" -Arch "x64" -GetUrl
    if (-not $url) { throw "Fido did not return a download URL. Re-run with -IsoPath pointing at an ISO you downloaded yourself." }
    $iso = Join-Path $env:TEMP "Win11.iso"
    Write-Step "Fetching ISO (this is several GB)..."
    Start-BitsTransfer -Source $url -Destination $iso
    return $iso
}

# --- 2. MT7922 WiFi driver -------------------------------------------------
function Resolve-Driver {
    if ($DriverPath -and (Test-Path $DriverPath)) {
        Write-Step "Using provided driver: $DriverPath"
        return (Resolve-Path $DriverPath).Path
    }
    Write-Step "Searching the Microsoft Update Catalog for: $DriverQuery"
    $dest = Join-Path $env:TEMP "bootible-mt7922"
    try {
        $search = Invoke-WebRequest "https://www.catalog.update.microsoft.com/Search.aspx?q=$([uri]::EscapeDataString($DriverQuery))" -UseBasicParsing
        $id = ([regex]::Match($search.Content, 'updateIDs=.*?"([0-9a-f-]{36})"')).Groups[1].Value
        if (-not $id) { $id = ([regex]::Match($search.Content, '([0-9a-f-]{36})_link')).Groups[1].Value }
        if (-not $id) { throw "no catalog result parsed" }
        $body = "updateIDs=[{`"size`":0,`"updateID`":`"$id`"}]"
        $dl = Invoke-WebRequest "https://www.catalog.update.microsoft.com/DownloadDialog.aspx" -Method Post -Body $body -UseBasicParsing
        $cabUrl = ([regex]::Match($dl.Content, "(https?://[^']*\.(cab|msu))")).Groups[1].Value
        if (-not $cabUrl) { throw "no download URL parsed" }
        New-Item -ItemType Directory -Force -Path $dest | Out-Null
        $cab = Join-Path $dest "driver.cab"
        Start-BitsTransfer -Source $cabUrl -Destination $cab
        & expand.exe $cab -F:* $dest | Out-Null
        return $dest
    } catch {
        throw "Could not fetch the driver from the catalog ($_). Download the MT7922 / RZ616 (PCI\VEN_14C3&DEV_0616) driver yourself and pass it with -DriverPath."
    }
}

# --- 3. Pick + confirm the USB --------------------------------------------
function Select-UsbDisk {
    $disks = Get-Disk | Where-Object { $_.BusType -eq "USB" }
    if (-not $disks) { throw "No removable USB disk found. Plug one in." }

    Write-Host ""
    Write-Host "Removable USB disks:" -ForegroundColor White
    $disks | Format-Table Number, FriendlyName,
        @{ n = "SizeGB"; e = { [math]::Round($_.Size / 1GB, 1) } }, PartitionStyle | Out-Host

    if ($DiskNumber -lt 0) { $DiskNumber = [int](Read-Host "Enter the USB disk Number to ERASE") }
    $disk = $disks | Where-Object Number -EQ $DiskNumber
    if (-not $disk) { throw "Disk $DiskNumber is not in the removable-USB list above — refusing to touch it." }

    $label = "disk $DiskNumber ($($disk.FriendlyName), $([math]::Round($disk.Size / 1GB, 1)) GB)"
    if (-not $Force) {
        if ((Read-Host "This ERASES $label. Type ERASE to continue") -ne "ERASE") { throw "Aborted." }
    }
    return $disk
}

# --- 4. Format the USB (GPT + FAT32 for UEFI) ------------------------------
function Format-UsbDisk($disk) {
    if (-not $PSCmdlet.ShouldProcess("disk $($disk.Number) ($($disk.FriendlyName))", "ERASE and format")) {
        return $null
    }
    Write-Step "Erasing and formatting disk $($disk.Number)..."
    Clear-Disk -Number $disk.Number -RemoveData -RemoveOEM -Confirm:$false
    Initialize-Disk -Number $disk.Number -PartitionStyle GPT -Confirm:$false
    # FAT32 is required for UEFI boot; Windows caps FAT32 volumes at 32 GB, which
    # is ample for install media (install.wim is split below to dodge FAT32's
    # 4 GB file limit).
    $sizeBytes = [math]::Min($disk.Size, 32GB)
    $part = New-Partition -DiskNumber $disk.Number -Size $sizeBytes -AssignDriveLetter
    Format-Volume -Partition $part -FileSystem FAT32 -NewFileSystemLabel "BOOTIBLE" -Confirm:$false | Out-Null
    return "$($part.DriveLetter):"
}

# --- 5. Lay down Windows media (split install.wim onto FAT32) ---------------
function Copy-WindowsMedia($iso, $usb) {
    Write-Step "Mounting ISO and copying Windows media..."
    $mount = Mount-DiskImage -ImagePath $iso -PassThru
    try {
        $src = ($mount | Get-Volume).DriveLetter + ":"
        # everything except install.wim (too big for FAT32)
        robocopy "$src\" "$usb\" /E /XF install.wim /NFL /NDL /NJH /NJS | Out-Null
        $wim = "$src\sources\install.wim"
        if (Test-Path $wim) {
            Write-Step "Splitting install.wim under the FAT32 4 GB limit..."
            & dism.exe /Split-Image /ImageFile:"$wim" /SWMFile:"$usb\sources\install.swm" /FileSize:3800 | Out-Null
        }
    } finally {
        Dismount-DiskImage -ImagePath $iso | Out-Null
    }
}

# --- 6. Stage driver + bundle ---------------------------------------------
function Copy-Driver($driverDir, $usb) {
    Write-Step 'Staging the WiFi driver into $WinPEDriver$\WiFi\...'
    $dest = Join-Path $usb '$WinPEDriver$\WiFi'
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Copy-Item "$driverDir\*" $dest -Recurse -Force
}

function Copy-Bundle($usb) {
    Write-Step "Copying the bootible bundle..."
    # Merges autounattend.xml to the root and sources/$OEM$/... into sources\.
    robocopy "$BundleDir" "$usb" /E /NFL /NDL /NJH /NJS | Out-Null
}

# --- main ------------------------------------------------------------------
if (-not (Test-Path $BundleDir)) { throw "BundleDir not found: $BundleDir" }

$iso = Resolve-WindowsIso
$driver = Resolve-Driver
$disk = Select-UsbDisk
$usb = Format-UsbDisk $disk
if (-not $usb) { Write-Warn "WhatIf: stopping before any writes."; return }

Copy-WindowsMedia $iso $usb
Copy-Driver $driver $usb
Copy-Bundle $usb

Write-Host ""
Write-Step "Done. Boot the Ally from $usb to wipe, install and configure it."
