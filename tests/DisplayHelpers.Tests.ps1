#Requires -Modules Pester

BeforeAll {
    $helpersPath = Join-Path $PSScriptRoot "../config/rog-ally/lib/display-helpers.ps1"
    . $helpersPath
}

Describe "Resolve-DisplayPlan" {
    It "Returns empty plan when both hdr and refresh are unset" {
        $result = @(Resolve-DisplayPlan -ConfigureHdr "" -RefreshRate 0)
        $result.Count | Should -Be 0
    }

    It "Returns hdr-only plan when configure_hdr is on" {
        $result = @(Resolve-DisplayPlan -ConfigureHdr "on" -RefreshRate 0)
        $result.Count | Should -Be 1
        $result[0].Action | Should -Be "hdr"
        $result[0].Value  | Should -Be "on"
    }

    It "Returns hdr-only plan when configure_hdr is off" {
        $result = @(Resolve-DisplayPlan -ConfigureHdr "off" -RefreshRate 0)
        $result.Count | Should -Be 1
        $result[0].Action | Should -Be "hdr"
        $result[0].Value  | Should -Be "off"
    }

    It "Returns refresh-only plan when set_refresh_rate is positive" {
        $result = @(Resolve-DisplayPlan -ConfigureHdr "" -RefreshRate 120)
        $result.Count | Should -Be 1
        $result[0].Action | Should -Be "refresh"
        $result[0].Value  | Should -Be 120
    }

    It "Returns two-action plan with hdr before refresh when both are set" {
        $result = @(Resolve-DisplayPlan -ConfigureHdr "on" -RefreshRate 60)
        $result.Count | Should -Be 2
        $result[0].Action | Should -Be "hdr"
        $result[1].Action | Should -Be "refresh"
    }

    It "Excludes negative refresh rate from the plan" {
        $result = @(Resolve-DisplayPlan -ConfigureHdr "" -RefreshRate -1)
        $result.Count | Should -Be 0
    }

    It "Normalizes mixed-case hdr value to lowercase" {
        $result = @(Resolve-DisplayPlan -ConfigureHdr "On" -RefreshRate 0)
        $result.Count | Should -Be 1
        $result[0].Action | Should -Be "hdr"
        $result[0].Value  | Should -Be "on"
    }

    It "Normalises uppercase OFF to lowercase off" {
        $result = @(Resolve-DisplayPlan -ConfigureHdr "OFF" -RefreshRate 0)
        $result[0].Value | Should -Be "off"
    }
}
