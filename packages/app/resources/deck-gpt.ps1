<#
.SYNOPSIS
    GPT surgery for the Steam Deck reimage USB (dot-sourced by prepare-deck-usb.ps1).

.DESCRIPTION
    Raw-writing the small SteamOS recovery .img onto a larger stick leaves the GPT
    describing the IMAGE, not the disk: the backup header sits at the image's last
    sector and LastUsableLBA stops there. Windows treats that table as corrupt, so
    New-Partition re-initialises it and wipes the SteamOS partitions (the reason
    Path B never booted).

    This file fixes the table in place, on the raw handle, before Windows rescans:
      * backup entries + header moved to the real end of the disk,
      * LastUsableLBA extended,
      * a "BOOTIBLE" Basic Data partition entry added in the freed space,
      * the protective MBR resized,
      * the stale backup header at the old image end zeroed.
    The SteamOS partitions themselves are never touched.

    Pure functions (Get-GptRelocationPlan) take byte arrays so they are unit-tested
    without a disk; Invoke-GptRelocation applies a plan to any seekable Stream.
    Windows PowerShell 5.1 compatible (the elevated writer runs powershell.exe).
#>

$script:GptBasicDataType = [Guid]'EBD0A0A2-B9E5-4433-87C0-68B6B72699C7'

# Hex literals like 0xFFFFFFFF parse as int32 -1 in PowerShell, so the CRC
# constants are spelled as typed uint32 values.
$script:Crc32Poly = [uint32]3988292384     # 0xEDB88320 (reflected IEEE 802.3)
$script:Crc32Mask = [uint32]::MaxValue
$script:Crc32Table = $null
function Get-Crc32 {
    param([byte[]]$Bytes, [int]$Offset = 0, [int]$Count = -1)
    if ($Count -lt 0) { $Count = $Bytes.Length - $Offset }
    if (-not $script:Crc32Table) {
        $t = New-Object 'uint32[]' 256
        for ($i = 0; $i -lt 256; $i++) {
            [uint32]$c = $i
            for ($k = 0; $k -lt 8; $k++) {
                if ($c -band 1) { $c = [uint32]($script:Crc32Poly -bxor ($c -shr 1)) } else { $c = [uint32]($c -shr 1) }
            }
            $t[$i] = $c
        }
        $script:Crc32Table = $t
    }
    [uint32]$crc = $script:Crc32Mask
    $table = $script:Crc32Table
    $end = $Offset + $Count
    for ($i = $Offset; $i -lt $end; $i++) {
        $crc = [uint32]($table[($crc -bxor $Bytes[$i]) -band 0xFF] -bxor ($crc -shr 8))
    }
    return [uint32]($crc -bxor $script:Crc32Mask)
}

function Set-UInt64At([byte[]]$Buf, [int]$Off, [uint64]$Value) {
    [Array]::Copy([BitConverter]::GetBytes($Value), 0, $Buf, $Off, 8)
}
function Set-UInt32At([byte[]]$Buf, [int]$Off, [uint32]$Value) {
    [Array]::Copy([BitConverter]::GetBytes($Value), 0, $Buf, $Off, 4)
}

# Recompute a GPT header's CRC32 (field at 16 is zeroed while hashing).
function Update-GptHeaderCrc([byte[]]$Header) {
    $size = [BitConverter]::ToUInt32($Header, 12)
    Set-UInt32At $Header 16 0
    Set-UInt32At $Header 16 (Get-Crc32 -Bytes $Header -Offset 0 -Count $size)
}

<#
.SYNOPSIS
    Parse a GPT header sector. Throws if the signature or header CRC is wrong.
#>
function Read-GptHeader {
    param([byte[]]$Sector)
    $sig = [Text.Encoding]::ASCII.GetString($Sector, 0, 8)
    if ($sig -ne 'EFI PART') { throw "No GPT header found (signature '$sig')." }
    $size = [BitConverter]::ToUInt32($Sector, 12)
    $copy = [byte[]]$Sector.Clone()
    $stored = [BitConverter]::ToUInt32($Sector, 16)
    Set-UInt32At $copy 16 0
    if ((Get-Crc32 -Bytes $copy -Offset 0 -Count $size) -ne $stored) { throw "GPT header CRC mismatch." }
    [pscustomobject]@{
        HeaderSize     = $size
        MyLba          = [BitConverter]::ToUInt64($Sector, 24)
        AlternateLba   = [BitConverter]::ToUInt64($Sector, 32)
        FirstUsableLba = [BitConverter]::ToUInt64($Sector, 40)
        LastUsableLba  = [BitConverter]::ToUInt64($Sector, 48)
        EntriesLba     = [BitConverter]::ToUInt64($Sector, 72)
        EntryCount     = [BitConverter]::ToUInt32($Sector, 80)
        EntrySize      = [BitConverter]::ToUInt32($Sector, 84)
        EntriesCrc     = [BitConverter]::ToUInt32($Sector, 88)
    }
}

<#
.SYNOPSIS
    Pure planner: given the image's MBR, primary header and entry array plus the
    real disk size, return the sector writes that make the GPT span the disk and
    add a BOOTIBLE partition. Nothing is written here.

.OUTPUTS
    @{ Writes = @(@{Lba; Bytes}...); PartitionStartLba; PartitionEndLba }
#>
function Get-GptRelocationPlan {
    param(
        [Parameter(Mandatory)][byte[]]$Mbr,
        [Parameter(Mandatory)][byte[]]$PrimaryHeader,
        [Parameter(Mandatory)][byte[]]$Entries,
        [Parameter(Mandatory)][uint64]$DiskSectors,
        [int]$SectorSize = 512,
        [string]$Label = 'BOOTIBLE',
        [Guid]$PartitionGuid = [Guid]::NewGuid(),
        [uint64]$MinPartitionSectors = 131072   # 64 MiB at 512 B
    )
    $h = Read-GptHeader $PrimaryHeader
    if ($h.MyLba -ne 1) { throw "Primary GPT header is not at LBA 1." }
    $arrayBytes = [int]($h.EntryCount * $h.EntrySize)
    if ($Entries.Length -lt $arrayBytes) { throw "Entry array truncated." }
    if ((Get-Crc32 -Bytes $Entries -Offset 0 -Count $arrayBytes) -ne $h.EntriesCrc) { throw "GPT entry array CRC mismatch." }

    $entrySectors = [uint64][math]::Ceiling($arrayBytes / $SectorSize)
    $backupHeaderLba = $DiskSectors - 1
    $backupEntriesLba = $backupHeaderLba - $entrySectors
    $lastUsable = $backupEntriesLba - 1
    if ($h.AlternateLba -gt $backupHeaderLba) { throw "Image is larger than the target disk." }

    # Find the highest used LBA and a free slot.
    $maxEnd = [uint64]0
    $freeSlot = -1
    for ($i = 0; $i -lt $h.EntryCount; $i++) {
        $o = $i * $h.EntrySize
        $isEmpty = $true
        for ($b = 0; $b -lt 16; $b++) { if ($Entries[$o + $b] -ne 0) { $isEmpty = $false; break } }
        if ($isEmpty) { if ($freeSlot -lt 0) { $freeSlot = $i }; continue }
        $end = [BitConverter]::ToUInt64($Entries, $o + 40)
        if ($end -gt $maxEnd) { $maxEnd = $end }
    }
    if ($freeSlot -lt 0) { throw "No free GPT entry for the BOOTIBLE partition." }
    # The old backup structures sit just past the image; start beyond them, 1 MiB aligned.
    $floor = [math]::Max([double]$maxEnd, [double]$h.AlternateLba) + 1
    $align = [uint64](1048576 / $SectorSize)
    $start = [uint64]([math]::Ceiling($floor / $align) * $align)
    if ($start -gt $lastUsable -or ($lastUsable - $start + 1) -lt $MinPartitionSectors) {
        throw "Not enough free space on the disk for the BOOTIBLE partition."
    }

    # New entry array.
    $newEntries = New-Object byte[] ($entrySectors * $SectorSize)
    [Array]::Copy($Entries, 0, $newEntries, 0, $arrayBytes)
    $o = $freeSlot * $h.EntrySize
    [Array]::Copy($script:GptBasicDataType.ToByteArray(), 0, $newEntries, $o, 16)
    [Array]::Copy($PartitionGuid.ToByteArray(), 0, $newEntries, $o + 16, 16)
    Set-UInt64At $newEntries ($o + 32) $start
    Set-UInt64At $newEntries ($o + 40) $lastUsable
    Set-UInt64At $newEntries ($o + 48) 0
    $name = [Text.Encoding]::Unicode.GetBytes($Label)
    [Array]::Copy($name, 0, $newEntries, $o + 56, [math]::Min($name.Length, 72))
    $entriesCrc = Get-Crc32 -Bytes $newEntries -Offset 0 -Count $arrayBytes

    # Primary header.
    $primary = [byte[]]$PrimaryHeader.Clone()
    Set-UInt64At $primary 32 $backupHeaderLba
    Set-UInt64At $primary 48 $lastUsable
    Set-UInt32At $primary 88 $entriesCrc
    Update-GptHeaderCrc $primary

    # Backup header: mirror of primary with the LBAs swapped.
    $backup = [byte[]]$primary.Clone()
    Set-UInt64At $backup 24 $backupHeaderLba
    Set-UInt64At $backup 32 1
    Set-UInt64At $backup 72 $backupEntriesLba
    Update-GptHeaderCrc $backup

    $writes = New-Object System.Collections.ArrayList

    # Zero the stale backup header + entries the image left at its end.
    if ($h.AlternateLba -ne $backupHeaderLba) {
        $staleFirst = $h.AlternateLba - $entrySectors
        [void]$writes.Add(@{ Lba = $staleFirst; Bytes = (New-Object byte[] (($entrySectors + 1) * $SectorSize)) })
    }

    # Protective MBR: stretch the 0xEE record to the disk (capped at 32 bits).
    $mbr = [byte[]]$Mbr.Clone()
    if ($mbr[446 + 4] -eq 0xEE) {
        $size = [math]::Min([double]($DiskSectors - 1), [double][uint32]::MaxValue)
        Set-UInt32At $mbr (446 + 12) ([uint32]$size)
        [void]$writes.Add(@{ Lba = [uint64]0; Bytes = $mbr })
    }

    [void]$writes.Add(@{ Lba = $h.EntriesLba; Bytes = $newEntries })
    [void]$writes.Add(@{ Lba = $backupEntriesLba; Bytes = $newEntries })
    [void]$writes.Add(@{ Lba = $backupHeaderLba; Bytes = $backup })
    # Primary header last: until it lands, the old (consistent) primary still describes the image.
    [void]$writes.Add(@{ Lba = [uint64]1; Bytes = $primary })

    @{ Writes = $writes.ToArray(); PartitionStartLba = $start; PartitionEndLba = $lastUsable; PartitionGuid = $PartitionGuid }
}

function Read-Sectors([System.IO.Stream]$Stream, [uint64]$Lba, [int]$Count, [int]$SectorSize) {
    $buf = New-Object byte[] ($Count * $SectorSize)
    [void]$Stream.Seek([int64]($Lba * $SectorSize), [System.IO.SeekOrigin]::Begin)
    $read = 0
    while ($read -lt $buf.Length) {
        $n = $Stream.Read($buf, $read, $buf.Length - $read)
        if ($n -le 0) { throw "Short read at LBA $Lba." }
        $read += $n
    }
    return , $buf
}

<#
.SYNOPSIS
    Read the GPT the image left on $Stream, plan the relocation, and write it.
    $Stream must be readable, writable and seekable (a raw \\.\PhysicalDriveN
    handle or a plain file in tests). Returns the plan.
#>
function Invoke-GptRelocation {
    param(
        [Parameter(Mandatory)][System.IO.Stream]$Stream,
        [Parameter(Mandatory)][uint64]$DiskSectors,
        [int]$SectorSize = 512,
        [string]$Label = 'BOOTIBLE'
    )
    $mbr = Read-Sectors $Stream 0 1 $SectorSize
    $hdrSector = Read-Sectors $Stream 1 1 $SectorSize
    $h = Read-GptHeader $hdrSector
    $entrySectors = [int][math]::Ceiling(($h.EntryCount * $h.EntrySize) / $SectorSize)
    $entries = Read-Sectors $Stream $h.EntriesLba $entrySectors $SectorSize
    $plan = Get-GptRelocationPlan -Mbr $mbr -PrimaryHeader $hdrSector -Entries $entries `
        -DiskSectors $DiskSectors -SectorSize $SectorSize -Label $Label
    foreach ($w in $plan.Writes) {
        [void]$Stream.Seek([int64]($w.Lba * $SectorSize), [System.IO.SeekOrigin]::Begin)
        $Stream.Write($w.Bytes, 0, $w.Bytes.Length)
    }
    $Stream.Flush()
    return $plan
}
