#Requires -Modules Pester

BeforeAll {
    $helpersPath = Join-Path $PSScriptRoot "../config/rog-ally/lib/helpers.ps1"
    . $helpersPath
}

Describe "Get-ScaffoldDirectories" {
    It "Returns both paths when both keys set" {
        $config = @{ games_path = "D:\Games"; roms_path = "D:\Emulation\ROMs" }
        $dirs = @(Get-ScaffoldDirectories -Config $config)
        $dirs.Count | Should -Be 2
        $dirs | Should -Contain "D:\Games"
        $dirs | Should -Contain "D:\Emulation\ROMs"
    }

    It "Skips empty values" {
        $dirs = @(Get-ScaffoldDirectories -Config @{ games_path = "D:\Games"; roms_path = "" })
        $dirs.Count | Should -Be 1
        $dirs[0] | Should -Be "D:\Games"
    }

    It "Returns empty for missing keys" {
        @(Get-ScaffoldDirectories -Config @{}).Count | Should -Be 0
    }

    It "Dedupes identical paths case-insensitively" {
        $dirs = @(Get-ScaffoldDirectories -Config @{ games_path = "D:\Games"; roms_path = "d:\games" })
        $dirs.Count | Should -Be 1
    }

    It "Skips relative paths" {
        $dirs = @(Get-ScaffoldDirectories -Config @{ games_path = "Games"; roms_path = "D:\ROMs" })
        $dirs.Count | Should -Be 1
        $dirs[0] | Should -Be "D:\ROMs"
    }
}
