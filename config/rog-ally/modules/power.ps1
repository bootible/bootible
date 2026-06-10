# Power Module
# ============
# Sleep -> hibernate conversion for handhelds. Modern Standby drains
# 10-23% battery in 12h on Ally-class devices; hibernate does not.
# Firmware-level Modern Standby behavior (S0 wake sources) is NOT
# controllable from here - this module changes what Windows does on
# idle, lid, and power-button events.

if (-not (Get-Command Get-PowerConfigCommands -ErrorAction SilentlyContinue)) {
    Write-Status "Power helpers not loaded - skipping power module" "Warning"
    return
}

$sleepMode = Get-ConfigValue "sleep_mode" "default"
$hibernateAfter = Get-ConfigValue "hibernate_after_minutes" 0
$buttonAction = Get-ConfigValue "power_button_action" ""
$disableBoostDc = [bool](Get-ConfigValue "disable_cpu_boost_on_battery" $false)

$commands = @(Get-PowerConfigCommands -SleepMode $sleepMode -HibernateAfterMinutes $hibernateAfter -PowerButtonAction $buttonAction -DisableCpuBoostOnBattery $disableBoostDc)

if ($commands.Count -eq 0) {
    Write-Status "Power settings unchanged (sleep_mode: default)" "Info"
    return
}

if ($Script:DryRun) {
    foreach ($cmd in $commands) {
        Write-Status "[DRY RUN] Would run: powercfg $($cmd -join ' ')" "Info"
    }
    return
}

Write-Status "Applying power configuration (sleep_mode: $sleepMode)..." "Info"
$anyFailed = $false
foreach ($cmd in $commands) {
    $output = & powercfg @cmd
    if ($LASTEXITCODE -ne 0) {
        $anyFailed = $true
        Write-Status "powercfg $($cmd -join ' ') failed (exit $LASTEXITCODE): $output" "Warning"
    }
}
if ($anyFailed) {
    # Warnings above already tell the story - don't claim the change on the receipt
    Write-Status "Power configuration applied with errors (see warnings above)" "Warning"
} else {
    Write-Status "Power configuration applied" "Success"
    if (Get-Command Add-AppliedChange -ErrorAction SilentlyContinue) {
        Add-AppliedChange "Power: sleep_mode=$sleepMode, button=$buttonAction, boost_off_dc=$disableBoostDc"
    }
}
