#Requires -Modules Pester

BeforeAll {
    $helpersPath = Join-Path $PSScriptRoot "../config/rog-ally/lib/helpers.ps1"
    . $helpersPath
}

Describe "Get-SmartAppControlState" {
    It "Maps registry value 0 to off" {
        Get-SmartAppControlState -RegistryReader { 0 } | Should -Be "off"
    }

    It "Maps registry value 1 to on" {
        Get-SmartAppControlState -RegistryReader { 1 } | Should -Be "on"
    }

    It "Maps registry value 2 to evaluation" {
        Get-SmartAppControlState -RegistryReader { 2 } | Should -Be "evaluation"
    }

    It "Returns unknown when the registry read fails" {
        Get-SmartAppControlState -RegistryReader { throw "no such key" } | Should -Be "unknown"
    }

    It "Returns unknown for unrecognized values" {
        Get-SmartAppControlState -RegistryReader { 99 } | Should -Be "unknown"
    }
}
