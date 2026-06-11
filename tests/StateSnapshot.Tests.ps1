#Requires -Modules Pester

BeforeAll {
    $snapshotPath = Join-Path $PSScriptRoot "../config/rog-ally/lib/state-snapshot.ps1"
    . $snapshotPath
}

Describe "Compare-StateSnapshot" {
    It "Returns empty when states match" {
        $expected = @{ hibernate_enabled = $true; wallpaper_hash = "abc"; gpu_driver = "31.0.24027" }
        $actual   = @{ hibernate_enabled = $true; wallpaper_hash = "abc"; gpu_driver = "31.0.24027" }
        @(Compare-StateSnapshot -Expected $expected -Actual $actual).Count | Should -Be 0
    }

    It "Reports each drifted key with expected and actual values" {
        $expected = @{ hibernate_enabled = $true; wallpaper_hash = "abc" }
        $actual   = @{ hibernate_enabled = $false; wallpaper_hash = "abc" }
        $drift = @(Compare-StateSnapshot -Expected $expected -Actual $actual)
        $drift.Count | Should -Be 1
        $drift[0].Key | Should -Be "hibernate_enabled"
        $drift[0].Expected | Should -Be $true
        $drift[0].Actual | Should -Be $false
    }

    It "Reports keys missing from actual state" {
        $drift = @(Compare-StateSnapshot -Expected @{ ssh_running = $true } -Actual @{})
        $drift.Count | Should -Be 1
        $drift[0].Actual | Should -BeNullOrEmpty
    }

    It "Ignores keys present only in actual (new state is not drift)" {
        @(Compare-StateSnapshot -Expected @{} -Actual @{ extra = 1 }).Count | Should -Be 0
    }

    It "Reports hags_enabled drift" {
        $drift = @(Compare-StateSnapshot -Expected @{ hags_enabled = $true } -Actual @{ hags_enabled = $false })
        $drift.Count | Should -Be 1
        $drift[0].Key | Should -Be "hags_enabled"
    }
}

Describe "Get-VerifiedRepairs" {
    It "Classifies all drift as repaired when post-state matches expected" {
        $pre = @([pscustomobject]@{ Key = "hibernate_enabled"; Expected = $true; Actual = $false })
        $expected = @{ hibernate_enabled = $true }
        $post = @{ hibernate_enabled = $true }

        $result = Get-VerifiedRepairs -PreDrift $pre -Expected $expected -PostState $post

        @($result.Repaired).Count | Should -Be 1
        $result.Repaired[0].Key | Should -Be "hibernate_enabled"
        @($result.Unrepaired).Count | Should -Be 0
    }

    It "Splits mixed outcomes into repaired and unrepaired" {
        $pre = @(
            [pscustomobject]@{ Key = "hibernate_enabled"; Expected = $true; Actual = $false },
            [pscustomobject]@{ Key = "sshd_running"; Expected = $true; Actual = $false }
        )
        $expected = @{ hibernate_enabled = $true; sshd_running = $true }
        $post = @{ hibernate_enabled = $true; sshd_running = $false }

        $result = Get-VerifiedRepairs -PreDrift $pre -Expected $expected -PostState $post

        @($result.Repaired).Count | Should -Be 1
        $result.Repaired[0].Key | Should -Be "hibernate_enabled"
        @($result.Unrepaired).Count | Should -Be 1
        $result.Unrepaired[0].Key | Should -Be "sshd_running"
    }

    It "Treats a key absent from post-state as unrepaired" {
        $pre = @([pscustomobject]@{ Key = "sshd_running"; Expected = $true; Actual = $false })
        $expected = @{ sshd_running = $true }

        $result = Get-VerifiedRepairs -PreDrift $pre -Expected $expected -PostState @{}

        @($result.Repaired).Count | Should -Be 0
        @($result.Unrepaired).Count | Should -Be 1
        $result.Unrepaired[0].Key | Should -Be "sshd_running"
    }
}

Describe "Snapshot serialization" {
    It "Round-trips a snapshot through JSON" {
        $snapshot = @{ hibernate_enabled = $true; gpu_driver = "31.0.24027"; packages = @("Steam", "Discord") }
        $file = Join-Path $TestDrive "state.json"

        Save-StateSnapshot -Snapshot $snapshot -Path $file
        $loaded = Read-StateSnapshot -Path $file

        $loaded.hibernate_enabled | Should -Be $true
        $loaded.gpu_driver | Should -Be "31.0.24027"
        @($loaded.packages).Count | Should -Be 2
    }

    It "Read returns null for a missing file" {
        Read-StateSnapshot -Path (Join-Path $TestDrive "missing.json") | Should -BeNullOrEmpty
    }

    It "Read returns null for an empty or whitespace-only file" {
        $file = Join-Path $TestDrive "blank.json"
        Set-Content -Path $file -Value "   "
        Read-StateSnapshot -Path $file | Should -Be $null
    }

    It "Read returns null for an empty JSON object" {
        $file = Join-Path $TestDrive "empty-object.json"
        Set-Content -Path $file -Value "{}"
        Read-StateSnapshot -Path $file | Should -Be $null
    }
}
