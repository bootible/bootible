# Bootible State Snapshot
# =======================
# Known-good state capture + drift detection. The snapshot lives in the
# private repo at device/<platform>/<Instance>/state.json so it syncs
# with the device's config. Driver drift is REPORT-ONLY (no rollback).

function Compare-StateSnapshot {
    <#
    .SYNOPSIS
        Diffs expected (snapshot) state against actual (live) state.
    .DESCRIPTION
        Returns one object per drifted key: Key, Expected, Actual.
        Keys only present in Actual are ignored - new state is not drift.
    #>
    param(
        [Parameter(Mandatory)][hashtable]$Expected,
        [Parameter(Mandatory)][hashtable]$Actual
    )

    foreach ($key in $Expected.Keys) {
        $expectedValue = $Expected[$key]
        $actualValue = if ($Actual.ContainsKey($key)) { $Actual[$key] } else { $null }
        if ("$expectedValue" -ne "$actualValue") {
            [pscustomobject]@{ Key = $key; Expected = $expectedValue; Actual = $actualValue }
        }
    }
}

function Save-StateSnapshot {
    param(
        [Parameter(Mandatory)][hashtable]$Snapshot,
        [Parameter(Mandatory)][string]$Path
    )
    $parent = Split-Path -Parent $Path
    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    $Snapshot | ConvertTo-Json -Depth 5 | Set-Content -Path $Path -Encoding UTF8
}

function Read-StateSnapshot {
    param([Parameter(Mandatory)][string]$Path)
    if (-not (Test-Path $Path)) {
        return $null
    }
    try {
        $json = Get-Content -Path $Path -Raw -Encoding UTF8 | ConvertFrom-Json
        $hashtable = @{}
        foreach ($prop in $json.PSObject.Properties) {
            $hashtable[$prop.Name] = $prop.Value
        }
        return $hashtable
    } catch {
        return $null
    }
}

function Get-LiveState {
    <#
    .SYNOPSIS
        Gathers the live system state matching snapshot keys. Windows-only;
        each probe is independently fault-tolerant.
    #>
    param([hashtable]$Config)

    $state = @{}

    try {
        $prevEAP = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            $hibernateOut = (& powercfg /availablesleepstates 2>&1) -join " "
            $state['hibernate_enabled'] = $hibernateOut -match 'Hibernate'
        } finally {
            $ErrorActionPreference = $prevEAP
        }
    } catch { }

    try {
        $gameBar = Get-AppxPackage -Name 'Microsoft.XboxGamingOverlay' -ErrorAction SilentlyContinue
        $state['gamebar_present'] = [bool]$gameBar
    } catch { }

    try {
        $gpu = Get-CimInstance Win32_VideoController -ErrorAction Stop | Select-Object -First 1
        $state['gpu_driver'] = $gpu.DriverVersion
    } catch { }

    try {
        if ($Config -and $Config.ContainsKey('wallpaper_path') -and $Config['wallpaper_path']) {
            $current = (Get-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name WallPaper -ErrorAction Stop).WallPaper
            $state['wallpaper_set'] = [bool]$current
        }
    } catch { }

    try {
        $sshd = Get-Service -Name sshd -ErrorAction SilentlyContinue
        $state['sshd_running'] = ($null -ne $sshd -and $sshd.Status -eq 'Running')
    } catch { }

    return $state
}
