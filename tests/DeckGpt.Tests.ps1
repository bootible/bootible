#Requires -Modules Pester

BeforeAll {
    . (Join-Path $PSScriptRoot "../packages/app/resources/deck-gpt.ps1")

    $script:S = 512
    $script:ImgSectors = 8192          # 4 MiB "recovery image"
    $script:DiskSectors = 409600       # 200 MiB "USB stick"
    $script:EspType = [Guid]'C12A7328-F81F-11D2-BA4B-00A0C93EC93B'
    $script:LinuxType = [Guid]'0FC63DAF-8483-4772-8E79-3D69D8477DE4'

    # Build a self-consistent GPT image (MBR, primary + backup at the IMAGE end,
    # two partitions) and write it at the start of a disk-sized file.
    function New-TestDisk([string]$Path) {
        $img = New-Object byte[] ($ImgSectors * $S)
        # Protective MBR.
        $img[446 + 4] = 0xEE
        [Array]::Copy([BitConverter]::GetBytes([uint32]1), 0, $img, 446 + 8, 4)
        [Array]::Copy([BitConverter]::GetBytes([uint32]($ImgSectors - 1)), 0, $img, 446 + 12, 4)
        $img[510] = 0x55; $img[511] = 0xAA

        $entries = New-Object byte[] (128 * 128)
        $parts = @(
            @{ Type = $EspType; Start = 2048; End = 4095; Name = 'esp' },
            @{ Type = $LinuxType; Start = 4096; End = $ImgSectors - 34; Name = 'rootfs' }
        )
        for ($i = 0; $i -lt $parts.Count; $i++) {
            $o = $i * 128
            [Array]::Copy($parts[$i].Type.ToByteArray(), 0, $entries, $o, 16)
            [Array]::Copy([Guid]::NewGuid().ToByteArray(), 0, $entries, $o + 16, 16)
            [Array]::Copy([BitConverter]::GetBytes([uint64]$parts[$i].Start), 0, $entries, $o + 32, 8)
            [Array]::Copy([BitConverter]::GetBytes([uint64]$parts[$i].End), 0, $entries, $o + 40, 8)
            $n = [Text.Encoding]::Unicode.GetBytes($parts[$i].Name)
            [Array]::Copy($n, 0, $entries, $o + 56, $n.Length)
        }
        $crcE = Get-Crc32 -Bytes $entries

        $hdr = New-Object byte[] $S
        [Array]::Copy([Text.Encoding]::ASCII.GetBytes('EFI PART'), 0, $hdr, 0, 8)
        [Array]::Copy([BitConverter]::GetBytes([uint32]0x00010000), 0, $hdr, 8, 4)
        [Array]::Copy([BitConverter]::GetBytes([uint32]92), 0, $hdr, 12, 4)
        [Array]::Copy([BitConverter]::GetBytes([uint64]1), 0, $hdr, 24, 8)
        [Array]::Copy([BitConverter]::GetBytes([uint64]($ImgSectors - 1)), 0, $hdr, 32, 8)
        [Array]::Copy([BitConverter]::GetBytes([uint64]34), 0, $hdr, 40, 8)
        [Array]::Copy([BitConverter]::GetBytes([uint64]($ImgSectors - 34)), 0, $hdr, 48, 8)
        [Array]::Copy([Guid]::NewGuid().ToByteArray(), 0, $hdr, 56, 16)
        [Array]::Copy([BitConverter]::GetBytes([uint64]2), 0, $hdr, 72, 8)
        [Array]::Copy([BitConverter]::GetBytes([uint32]128), 0, $hdr, 80, 4)
        [Array]::Copy([BitConverter]::GetBytes([uint32]128), 0, $hdr, 84, 4)
        [Array]::Copy([BitConverter]::GetBytes([uint32]$crcE), 0, $hdr, 88, 4)
        Update-GptHeaderCrc $hdr

        $bak = [byte[]]$hdr.Clone()
        [Array]::Copy([BitConverter]::GetBytes([uint64]($ImgSectors - 1)), 0, $bak, 24, 8)
        [Array]::Copy([BitConverter]::GetBytes([uint64]1), 0, $bak, 32, 8)
        [Array]::Copy([BitConverter]::GetBytes([uint64]($ImgSectors - 33)), 0, $bak, 72, 8)
        Update-GptHeaderCrc $bak

        [Array]::Copy($hdr, 0, $img, 1 * $S, $S)
        [Array]::Copy($entries, 0, $img, 2 * $S, $entries.Length)
        [Array]::Copy($entries, 0, $img, ($ImgSectors - 33) * $S, $entries.Length)
        [Array]::Copy($bak, 0, $img, ($ImgSectors - 1) * $S, $S)
        # Marker inside the rootfs partition, to prove data is untouched.
        [Array]::Copy([Text.Encoding]::ASCII.GetBytes('STEAMOS-DATA'), 0, $img, 5000 * $S, 12)

        $fs = [System.IO.File]::Create($Path)
        try { $fs.Write($img, 0, $img.Length); $fs.SetLength([int64]$DiskSectors * $S) } finally { $fs.Dispose() }
        return , $entries
    }

    function Read-At([string]$Path, [uint64]$Lba, [int]$Count) {
        $fs = [System.IO.File]::OpenRead($Path)
        try { return , (Read-Sectors $fs $Lba $Count $S) } finally { $fs.Dispose() }
    }

    function Invoke-OnFile([string]$Path, [uint64]$Sectors = $DiskSectors) {
        $fs = [System.IO.File]::Open($Path, 'Open', 'ReadWrite')
        try { return Invoke-GptRelocation -Stream $fs -DiskSectors $Sectors } finally { $fs.Dispose() }
    }
}

Describe "Get-Crc32" {
    It "matches the standard CRC-32 check value" {
        Get-Crc32 -Bytes ([Text.Encoding]::ASCII.GetBytes('123456789')) | Should -Be ([uint32]3421780262)   # 0xCBF43926
    }
}

Describe "Invoke-GptRelocation" {
    BeforeEach {
        $script:Path = Join-Path $TestDrive "disk-$([Guid]::NewGuid()).img"
        $script:OrigEntries = New-TestDisk $Path
        $script:Plan = Invoke-OnFile $Path
        $script:N = [uint64]$DiskSectors
    }

    It "points the primary header at a backup on the disk's last sector" {
        $h = Read-GptHeader (Read-At $Path 1 1)
        $h.AlternateLba | Should -Be ($N - 1)
        $h.LastUsableLba | Should -Be ($N - 34)
    }

    It "writes a valid backup header + entry array at the disk end" {
        $b = Read-GptHeader (Read-At $Path ($N - 1) 1)
        $b.MyLba | Should -Be ($N - 1)
        $b.AlternateLba | Should -Be 1
        $b.EntriesLba | Should -Be ($N - 33)
        $backupEntries = Read-At $Path ($N - 33) 32
        Get-Crc32 -Bytes $backupEntries | Should -Be $b.EntriesCrc
        $primaryEntries = Read-At $Path 2 32
        [Convert]::ToBase64String($backupEntries) | Should -Be ([Convert]::ToBase64String($primaryEntries))
    }

    It "leaves the image's partitions + data untouched" {
        $e = Read-At $Path 2 32
        [Convert]::ToBase64String($e, 0, 256) | Should -Be ([Convert]::ToBase64String($OrigEntries, 0, 256))
        $d = Read-At $Path 5000 1
        [Text.Encoding]::ASCII.GetString($d, 0, 12) | Should -Be 'STEAMOS-DATA'
    }

    It "adds a 1 MiB-aligned BOOTIBLE Basic Data partition filling the free space" {
        $e = Read-At $Path 2 32
        $o = 2 * 128
        ([Guid]::new([byte[]]$e[$o..($o + 15)])) | Should -Be ([Guid]'EBD0A0A2-B9E5-4433-87C0-68B6B72699C7')
        $start = [BitConverter]::ToUInt64($e, $o + 32)
        $end = [BitConverter]::ToUInt64($e, $o + 40)
        ($start % 2048) | Should -Be 0
        $start | Should -BeGreaterThan ($ImgSectors - 1)
        $end | Should -Be ($N - 34)
        [Text.Encoding]::Unicode.GetString($e, $o + 56, 16) | Should -Be 'BOOTIBLE'
        $Plan.PartitionStartLba | Should -Be $start
    }

    It "zeroes the stale backup header the image left behind" {
        $old = Read-At $Path ($ImgSectors - 1) 1
        ($old | Measure-Object -Sum).Sum | Should -Be 0
    }

    It "stretches the protective MBR to the disk" {
        $m = Read-At $Path 0 1
        [BitConverter]::ToUInt32($m, 446 + 12) | Should -Be ($N - 1)
        $m[510] | Should -Be 0x55
    }

    It "refuses a second run without writing (no free space left)" {
        $before = [Convert]::ToBase64String((Read-At $Path 0 34))
        { Invoke-OnFile $Path } | Should -Throw "*Not enough free space*"
        [Convert]::ToBase64String((Read-At $Path 0 34)) | Should -Be $before
    }
}

Describe "Get-GptRelocationPlan guards" {
    BeforeAll {
        $script:P2 = Join-Path $TestDrive "guard.img"
        [void](New-TestDisk $P2)
        $script:Mbr = Read-At $P2 0 1
        $script:Hdr = Read-At $P2 1 1
        $script:Ent = Read-At $P2 2 32
    }

    It "rejects a disk smaller than the image" {
        { Get-GptRelocationPlan -Mbr $Mbr -PrimaryHeader $Hdr -Entries $Ent -DiskSectors 4096 } | Should -Throw "*larger than the target disk*"
    }

    It "rejects a disk with too little free space for the payload" {
        { Get-GptRelocationPlan -Mbr $Mbr -PrimaryHeader $Hdr -Entries $Ent -DiskSectors ($ImgSectors + 2048) } | Should -Throw "*Not enough free space*"
    }

    It "rejects a corrupted header" {
        $bad = [byte[]]$Hdr.Clone(); $bad[40] = $bad[40] -bxor 0xFF
        { Get-GptRelocationPlan -Mbr $Mbr -PrimaryHeader $bad -Entries $Ent -DiskSectors $DiskSectors } | Should -Throw "*CRC mismatch*"
    }

    It "rejects a corrupted entry array" {
        $bad = [byte[]]$Ent.Clone(); $bad[40] = $bad[40] -bxor 0xFF
        { Get-GptRelocationPlan -Mbr $Mbr -PrimaryHeader $Hdr -Entries $bad -DiskSectors $DiskSectors } | Should -Throw "*entry array CRC*"
    }
}
