# Bootible Display Helpers
# ========================
# Pure functions for display configuration planning. No side effects.
# All decision logic lives here so it can be unit-tested on Linux.

function Resolve-DisplayPlan {
    <#
    .SYNOPSIS
        Builds an ordered list of display actions from the config values.
    .DESCRIPTION
        Returns action objects on the pipeline (emit, not return-array).
        Each object has Action (hdr|refresh) and Value.
        Rules:
          - Empty/blank configure_hdr -> no HDR action emitted
          - 0 set_refresh_rate -> no refresh action emitted
          - Negative refresh -> excluded
          - Any positive refresh value is emitted; panel-mode validation
            happens at runtime in the module (EnumDisplaySettings)
          - HDR action always precedes refresh action
          - HDR value is normalised to lowercase
    #>
    param(
        [string]$ConfigureHdr = "",
        [int]$RefreshRate = 0
    )

    if ($ConfigureHdr -and $ConfigureHdr.Trim() -ne "") {
        Write-Output @{ Action = "hdr"; Value = $ConfigureHdr.Trim().ToLower() }
    }

    if ($RefreshRate -gt 0) {
        Write-Output @{ Action = "refresh"; Value = $RefreshRate }
    }
}
