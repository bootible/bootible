# Bootible Power Helpers
# ======================
# Pure functions producing powercfg argument lists. No side effects.

function Get-PowerConfigCommands {
    <#
    .SYNOPSIS
        Builds the list of powercfg argument arrays for the requested power config.
    .DESCRIPTION
        Returns an array of string arrays; each inner array is one powercfg invocation.
        PBUTTONACTION indices: 0=do nothing, 1=sleep, 2=hibernate, 3=shut down.
    #>
    param(
        [string]$SleepMode = "default",
        [int]$HibernateAfterMinutes = 0,
        [string]$PowerButtonAction = "",
        [bool]$DisableCpuBoostOnBattery = $false
    )

    $commands = @()
    $needsActivate = $false

    if ($SleepMode -eq "hibernate") {
        $commands += ,@("/hibernate", "on")
        $commands += ,@("/change", "standby-timeout-ac", "0")
        $commands += ,@("/change", "standby-timeout-dc", "0")
        if ($HibernateAfterMinutes -gt 0) {
            $commands += ,@("/change", "hibernate-timeout-ac", "$HibernateAfterMinutes")
            $commands += ,@("/change", "hibernate-timeout-dc", "$HibernateAfterMinutes")
        }
    }

    $buttonIndex = switch ($PowerButtonAction) {
        "sleep"     { "1" }
        "hibernate" { "2" }
        "shutdown"  { "3" }
        default     { $null }
    }
    if ($buttonIndex) {
        $commands += ,@("/setacvalueindex", "SCHEME_CURRENT", "SUB_BUTTONS", "PBUTTONACTION", $buttonIndex)
        $commands += ,@("/setdcvalueindex", "SCHEME_CURRENT", "SUB_BUTTONS", "PBUTTONACTION", $buttonIndex)
        $needsActivate = $true
    }

    if ($DisableCpuBoostOnBattery) {
        # PERFBOOSTMODE 0 = boost disabled. DC-only so plugged-in performance
        # is untouched; community guidance is boost-off on battery for thermals
        # and battery life on Ally-class APUs.
        $commands += ,@("/setdcvalueindex", "SCHEME_CURRENT", "SUB_PROCESSOR", "PERFBOOSTMODE", "0")
        $needsActivate = $true
    }

    if ($needsActivate) {
        $commands += ,@("/setactive", "SCHEME_CURRENT")
    }

    # Output each command array as a discrete pipeline item so callers can
    # use @(Get-PowerConfigCommands ...) to get a flat array of string arrays.
    foreach ($cmd in $commands) {
        Write-Output -NoEnumerate $cmd
    }
}
