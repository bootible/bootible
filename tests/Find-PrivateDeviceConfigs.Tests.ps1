#Requires -Modules Pester

<#
.SYNOPSIS
    Pester tests for private config discovery (device-instance layout)

.DESCRIPTION
    Covers Find-PrivateDeviceConfigs, which locates private device configs in the
    device-instance layout (private/device/<device>/<Instance>/config.yml) with
    fallback to the legacy flat layout (private/<device>/config*.yml).
    Run with: Invoke-Pester -Path ./tests/
#>

BeforeAll {
    $helpersPath = Join-Path $PSScriptRoot "../config/rog-ally/lib/helpers.ps1"
    . $helpersPath

    function New-PrivateConfig {
        param([string]$Root, [string[]]$Segments)
        $path = $Root
        foreach ($segment in $Segments) {
            $path = Join-Path $path $segment
        }
        New-Item -ItemType Directory -Path (Split-Path -Parent $path) -Force | Out-Null
        Set-Content -Path $path -Value "hostname: test"
        return $path
    }
}

Describe "Find-PrivateDeviceConfigs" {
    It "Discovers instances in device-instance layout sorted by name" {
        $private = Join-Path $TestDrive "private-multi"
        New-PrivateConfig -Root $private -Segments @("device", "rog-ally", "Vixen", "config.yml")
        New-PrivateConfig -Root $private -Segments @("device", "rog-ally", "Vengeance", "config.yml")

        $result = @(Find-PrivateDeviceConfigs -PrivateRoot $private -Device "rog-ally")

        $result.Count | Should -Be 2
        $result[0].Name | Should -Be "Vengeance"
        $result[1].Name | Should -Be "Vixen"
        $result[0].ConfigPath | Should -Be (Join-Path $private (Join-Path "device" (Join-Path "rog-ally" (Join-Path "Vengeance" "config.yml"))))
    }

    It "Skips instance directories without a config.yml" {
        $private = Join-Path $TestDrive "private-partial"
        New-PrivateConfig -Root $private -Segments @("device", "rog-ally", "Vengeance", "config.yml")
        $emptyInstance = Join-Path $private (Join-Path "device" (Join-Path "rog-ally" "Images"))
        New-Item -ItemType Directory -Path $emptyInstance -Force | Out-Null

        $result = @(Find-PrivateDeviceConfigs -PrivateRoot $private -Device "rog-ally")

        $result.Count | Should -Be 1
        $result[0].Name | Should -Be "Vengeance"
    }

    It "Falls back to legacy flat layout when device-instance layout is absent" {
        $private = Join-Path $TestDrive "private-legacy"
        New-PrivateConfig -Root $private -Segments @("rog-ally", "config.yml")
        New-PrivateConfig -Root $private -Segments @("rog-ally", "config-vixen.yml")

        $result = @(Find-PrivateDeviceConfigs -PrivateRoot $private -Device "rog-ally")

        $result.Count | Should -Be 2
        $result[0].Name | Should -Be "config"
        $result[1].Name | Should -Be "config-vixen"
    }

    It "Prefers device-instance layout over legacy when both exist" {
        $private = Join-Path $TestDrive "private-both"
        New-PrivateConfig -Root $private -Segments @("device", "rog-ally", "Vengeance", "config.yml")
        New-PrivateConfig -Root $private -Segments @("rog-ally", "config.yml")

        $result = @(Find-PrivateDeviceConfigs -PrivateRoot $private -Device "rog-ally")

        $result.Count | Should -Be 1
        $result[0].Name | Should -Be "Vengeance"
    }

    It "Returns empty when private root does not exist" {
        $result = @(Find-PrivateDeviceConfigs -PrivateRoot (Join-Path $TestDrive "missing") -Device "rog-ally")

        $result.Count | Should -Be 0
    }

    It "Returns empty when device directory exists but holds no configs" {
        $private = Join-Path $TestDrive "private-empty"
        New-Item -ItemType Directory -Path (Join-Path $private (Join-Path "device" "rog-ally")) -Force | Out-Null

        $result = @(Find-PrivateDeviceConfigs -PrivateRoot $private -Device "rog-ally")

        $result.Count | Should -Be 0
    }
}
