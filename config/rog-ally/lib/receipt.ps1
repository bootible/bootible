# Bootible Receipt
# ================
# Pure markdown generation for the on-device "what did bootible do" file.

function New-BootibleReceipt {
    <#
    .SYNOPSIS
        Builds the markdown receipt written to the device Desktop after a real run.
    #>
    param(
        [Parameter(Mandatory)][string]$InstanceName,
        [Parameter(Mandatory)][string]$Version,
        [Parameter(Mandatory)][hashtable]$InstallResults,
        [string[]]$AppliedChanges = @(),
        [string]$FaqText = "",
        [datetime]$Timestamp = (Get-Date)
    )

    $lines = @()
    $lines += "# Your device was set up by bootible"
    $lines += ""
    $lines += "- **Configuration:** $InstanceName"
    $lines += "- **bootible version:** $Version"
    $lines += "- **Run completed:** $($Timestamp.ToString('yyyy-MM-dd HH:mm'))"
    $lines += ""
    $lines += "Re-running is always safe: open PowerShell and type ``bootible``. It re-applies your configuration and repairs anything Windows Update broke."
    $lines += ""

    $lines += "## Apps"
    $lines += ""
    $lines += "Attempted: $($InstallResults.Attempted) | Installed: $($InstallResults.Succeeded) | Skipped (already present): $($InstallResults.Skipped) | Failed: $($InstallResults.Failed)"
    $lines += ""
    foreach ($pkg in $InstallResults.Packages) {
        $suffix = if ($pkg.Message) { " - $($pkg.Message)" } else { "" }
        $lines += "- **$($pkg.Name)**: $($pkg.Status)$suffix"
    }
    $lines += ""

    if ($AppliedChanges.Count -gt 0) {
        $lines += "## Configuration changes"
        $lines += ""
        foreach ($change in $AppliedChanges) {
            $lines += "- $change"
        }
        $lines += ""
    }

    if ($FaqText) {
        $lines += $FaqText
        $lines += ""
    }

    return ($lines -join "`n")
}
