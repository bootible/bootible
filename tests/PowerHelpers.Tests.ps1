#Requires -Modules Pester

BeforeAll {
    $helpersPath = Join-Path $PSScriptRoot "../config/rog-ally/lib/power-helpers.ps1"
    . $helpersPath
}

Describe "Get-PowerConfigCommands" {
    It "Returns no commands for default config" {
        $result = @(Get-PowerConfigCommands -SleepMode "default" -HibernateAfterMinutes 0 -PowerButtonAction "")
        $result.Count | Should -Be 0
    }

    It "Enables hibernate and disables standby when sleep_mode is hibernate" {
        $result = @(Get-PowerConfigCommands -SleepMode "hibernate" -HibernateAfterMinutes 0 -PowerButtonAction "")
        ($result | ForEach-Object { $_ -join ' ' }) | Should -Contain "/hibernate on"
        ($result | ForEach-Object { $_ -join ' ' }) | Should -Contain "/change standby-timeout-ac 0"
        ($result | ForEach-Object { $_ -join ' ' }) | Should -Contain "/change standby-timeout-dc 0"
    }

    It "Adds hibernate timeouts when hibernate_after_minutes is set" {
        $result = @(Get-PowerConfigCommands -SleepMode "hibernate" -HibernateAfterMinutes 30 -PowerButtonAction "")
        ($result | ForEach-Object { $_ -join ' ' }) | Should -Contain "/change hibernate-timeout-ac 30"
        ($result | ForEach-Object { $_ -join ' ' }) | Should -Contain "/change hibernate-timeout-dc 30"
    }

    It "Maps power button to hibernate on AC and DC and activates the scheme" {
        $result = @(Get-PowerConfigCommands -SleepMode "default" -HibernateAfterMinutes 0 -PowerButtonAction "hibernate")
        ($result | ForEach-Object { $_ -join ' ' }) | Should -Contain "/setacvalueindex SCHEME_CURRENT SUB_BUTTONS PBUTTONACTION 2"
        ($result | ForEach-Object { $_ -join ' ' }) | Should -Contain "/setdcvalueindex SCHEME_CURRENT SUB_BUTTONS PBUTTONACTION 2"
        ($result | ForEach-Object { $_ -join ' ' })[-1] | Should -Be "/setactive SCHEME_CURRENT"
    }

    It "Maps sleep and shutdown button actions to powercfg indices 1 and 3" {
        $sleep = @(Get-PowerConfigCommands -SleepMode "default" -HibernateAfterMinutes 0 -PowerButtonAction "sleep")
        ($sleep | ForEach-Object { $_ -join ' ' }) | Should -Contain "/setacvalueindex SCHEME_CURRENT SUB_BUTTONS PBUTTONACTION 1"
        $shutdown = @(Get-PowerConfigCommands -SleepMode "default" -HibernateAfterMinutes 0 -PowerButtonAction "shutdown")
        ($shutdown | ForEach-Object { $_ -join ' ' }) | Should -Contain "/setacvalueindex SCHEME_CURRENT SUB_BUTTONS PBUTTONACTION 3"
    }

    It "Disables CPU boost on battery only and activates the scheme" {
        $result = @(Get-PowerConfigCommands -SleepMode "default" -HibernateAfterMinutes 0 -PowerButtonAction "" -DisableCpuBoostOnBattery $true)
        ($result | ForEach-Object { $_ -join ' ' }) | Should -Contain "/setdcvalueindex SCHEME_CURRENT SUB_PROCESSOR PERFBOOSTMODE 0"
        ($result | ForEach-Object { $_ -join ' ' }) -match "setacvalueindex.*PERFBOOSTMODE" | Should -BeNullOrEmpty
        ($result | ForEach-Object { $_ -join ' ' })[-1] | Should -Be "/setactive SCHEME_CURRENT"
    }

    It "Emits no boost commands when DisableCpuBoostOnBattery is false" {
        $result = @(Get-PowerConfigCommands -SleepMode "default" -HibernateAfterMinutes 0 -PowerButtonAction "" -DisableCpuBoostOnBattery $false)
        $result.Count | Should -Be 0
    }

    It "Activates the scheme once when both button action and boost-off are set" {
        $result = @(Get-PowerConfigCommands -SleepMode "default" -HibernateAfterMinutes 0 -PowerButtonAction "hibernate" -DisableCpuBoostOnBattery $true)
        $joined = $result | ForEach-Object { $_ -join ' ' }
        ($joined | Where-Object { $_ -eq "/setactive SCHEME_CURRENT" }).Count | Should -Be 1
        $joined[-1] | Should -Be "/setactive SCHEME_CURRENT"
    }

    It "Silently ignores an unknown sleep mode" {
        $result = @(Get-PowerConfigCommands -SleepMode "banana" -HibernateAfterMinutes 0 -PowerButtonAction "")
        $result.Count | Should -Be 0
    }

    It "Silently ignores negative hibernate_after_minutes" {
        $result = @(Get-PowerConfigCommands -SleepMode "hibernate" -HibernateAfterMinutes -5 -PowerButtonAction "")
        ($result | ForEach-Object { $_ -join ' ' }) | Should -Contain "/hibernate on"
        ($result | ForEach-Object { $_ -join ' ' }) -match "hibernate-timeout" | Should -BeNullOrEmpty
    }
}
