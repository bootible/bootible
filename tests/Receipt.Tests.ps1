#Requires -Modules Pester

BeforeAll {
    $receiptPath = Join-Path $PSScriptRoot "../config/rog-ally/lib/receipt.ps1"
    . $receiptPath
}

Describe "New-BootibleReceipt" {
    BeforeEach {
        # Shape matches Add-InstallResult in Run.ps1: Name, Status (lowercase), PackageId, Source, Message
        $script:results = @{
            Attempted = 5; Succeeded = 3; Failed = 1; Skipped = 1
            Packages = @(
                @{ Name = "Steam"; Status = "succeeded"; Source = "winget" },
                @{ Name = "Discord"; Status = "succeeded"; Source = "winget" },
                @{ Name = "G-Helper"; Status = "succeeded"; Source = "direct" },
                @{ Name = "VLC"; Status = "failed"; Message = "winget source failure" },
                @{ Name = "7-Zip"; Status = "skipped" }
            )
        }
        $script:changes = @("Hibernate enabled (sleep_mode: hibernate)", "Wallpaper applied", "SSH server enabled on port 22")
    }

    It "Includes instance name and version in the header" {
        $md = New-BootibleReceipt -InstanceName "Vengeance" -Version "1.0.0" -InstallResults $results -AppliedChanges $changes -FaqText "## FAQ"
        $md | Should -Match "Vengeance"
        $md | Should -Match "1\.0\.0"
    }

    It "Lists installed, failed, and skipped packages with their status" {
        $md = New-BootibleReceipt -InstanceName "V" -Version "1.0.0" -InstallResults $results -AppliedChanges $changes -FaqText "## FAQ"
        $md | Should -Match "Steam"
        $md | Should -Match "VLC.*failed.*winget source failure"
        $md | Should -Match "7-Zip"
    }

    It "Lists applied configuration changes" {
        $md = New-BootibleReceipt -InstanceName "V" -Version "1.0.0" -InstallResults $results -AppliedChanges $changes -FaqText "## FAQ"
        $md | Should -Match "Hibernate enabled"
        $md | Should -Match "SSH server enabled"
    }

    It "Appends the FAQ text verbatim" {
        $md = New-BootibleReceipt -InstanceName "V" -Version "1.0.0" -InstallResults $results -AppliedChanges $changes -FaqText "## FAQ`nSAC guidance here"
        $md | Should -Match "SAC guidance here"
    }

    It "Handles empty results without throwing" {
        $empty = @{ Attempted = 0; Succeeded = 0; Failed = 0; Skipped = 0; Packages = @() }
        $md = New-BootibleReceipt -InstanceName "V" -Version "dev" -InstallResults $empty -AppliedChanges @() -FaqText ""
        $md | Should -Match "bootible"
    }

    It "Renders an injected timestamp" {
        $md = New-BootibleReceipt -InstanceName "V" -Version "1.0.0" -InstallResults $results -AppliedChanges @() -FaqText "" -Timestamp ([datetime]"2026-07-01 12:34")
        $md | Should -Match "2026-07-01 12:34"
    }
}
