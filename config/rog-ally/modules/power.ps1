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

$commands = @(Get-PowerConfigCommands -SleepMode $sleepMode -HibernateAfterMinutes $hibernateAfter -PowerButtonAction $buttonAction)

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
foreach ($cmd in $commands) {
    $output = & powercfg @cmd
    if ($LASTEXITCODE -ne 0) {
        Write-Status "powercfg $($cmd -join ' ') failed (exit $LASTEXITCODE): $output" "Warning"
    }
}
Write-Status "Power configuration applied" "Success"
