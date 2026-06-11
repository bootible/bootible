#Requires -Modules Pester

BeforeAll {
    $helpersPath = Join-Path $PSScriptRoot "../config/rog-ally/lib/helpers.ps1"
    . $helpersPath
}

Describe "Get-ScaffoldDirectories" {
    It "Returns both paths when both set" {
        $dirs = @(Get-ScaffoldDirectories -Paths @("D:\Games", "D:\Emulation\ROMs"))
        $dirs.Count | Should -Be 2
        $dirs | Should -Contain "D:\Games"
        $dirs | Should -Contain "D:\Emulation\ROMs"
    }

    It "Skips empty values" {
        $dirs = @(Get-ScaffoldDirectories -Paths @("D:\Games", ""))
        $dirs.Count | Should -Be 1
        $dirs[0] | Should -Be "D:\Games"
    }

    It "Returns empty for no input" {
        @(Get-ScaffoldDirectories -Paths @()).Count | Should -Be 0
    }

    It "Dedupes identical paths case-insensitively" {
        $dirs = @(Get-ScaffoldDirectories -Paths @("D:\Games", "d:\games"))
        $dirs.Count | Should -Be 1
    }

    It "Skips relative paths" {
        $dirs = @(Get-ScaffoldDirectories -Paths @("Games", "D:\ROMs"))
        $dirs.Count | Should -Be 1
        $dirs[0] | Should -Be "D:\ROMs"
    }

    It "Skips driveless-rooted paths like \Games (drive-relative on Windows)" {
        # Pins the cross-platform contract: \Games passes IsPathRooted on
        # Windows but is drive-relative (ambiguous) - it must be rejected on
        # every platform, same as a relative path.
        $dirs = @(Get-ScaffoldDirectories -Paths @("\Games", "D:\ROMs"))
        $dirs.Count | Should -Be 1
        $dirs[0] | Should -Be "D:\ROMs"
    }

    It "Skips forward-slash drive-relative paths like /Games" {
        # Production runtime is Windows-only: /Games is drive-relative there,
        # carrying the same ambiguity as \Games. No Unix-absolute allowance.
        $dirs = @(Get-ScaffoldDirectories -Paths @("/Games", "D:\ROMs"))
        $dirs.Count | Should -Be 1
        $dirs[0] | Should -Be "D:\ROMs"
    }

    It "Skips UNC paths like \\nas\games" {
        # Network shares are out of scaffolding scope - create them manually.
        $dirs = @(Get-ScaffoldDirectories -Paths @("\\nas\games", "D:\ROMs"))
        $dirs.Count | Should -Be 1
        $dirs[0] | Should -Be "D:\ROMs"
    }
}
