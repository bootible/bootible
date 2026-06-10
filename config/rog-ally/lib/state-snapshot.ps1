# Bootible State Snapshot
# =======================
# Known-good state capture + drift detection. The snapshot is local to the
# device under the private repo clone (device/<platform>/<Instance>/state.json)
# and intentionally NOT pushed - a fresh install starts a new baseline rather
# than screaming drift on every key. Driver drift is REPORT-ONLY (no rollback).

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

function Get-VerifiedRepairs {
    <#
    .SYNOPSIS
        Splits pre-run drift into repaired vs unrepaired using post-run state.
    .DESCRIPTION
        A drifted key counts as repaired only when the post-run value equals
        the snapshot's expected value. gpu_driver is excluded by callers
        (report-only). Returns @{ Repaired = [object[]]; Unrepaired = [object[]] }.
    #>
    param(
        [Parameter(Mandatory)][AllowEmptyCollection()][object[]]$PreDrift,
        [Parameter(Mandatory)][hashtable]$Expected,
        [Parameter(Mandatory)][hashtable]$PostState
    )

    $repaired = @()
    $unrepaired = @()
    foreach ($item in $PreDrift) {
        $post = if ($PostState.ContainsKey($item.Key)) { $PostState[$item.Key] } else { $null }
        if ("$post" -eq "$($Expected[$item.Key])") {
            $repaired += $item
        } else {
            $unrepaired += $item
        }
    }
    return @{ Repaired = $repaired; Unrepaired = $unrepaired }
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
        $raw = Get-Content -Path $Path -Raw -Encoding UTF8
        if ([string]::IsNullOrWhiteSpace($raw)) {
            return $null
        }
        $json = $raw | ConvertFrom-Json
        $hashtable = @{}
        foreach ($prop in $json.PSObject.Properties) {
            $hashtable[$prop.Name] = $prop.Value
        }
        if ($hashtable.Count -eq 0) {
            return $null
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
        # Registry read instead of powercfg output parsing - locale-independent
        $hibernateValue = (Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Power' -Name HibernateEnabled -ErrorAction Stop).HibernateEnabled
        $state['hibernate_enabled'] = ($hibernateValue -eq 1)
    } catch { }

    try {
        $gameBar = Get-AppxPackage -Name 'Microsoft.XboxGamingOverlay' -ErrorAction SilentlyContinue
        $state['gamebar_present'] = [bool]$gameBar
    } catch { }

    try {
        # Filter to physical PCI adapters - streaming tools install virtual
        # displays that would otherwise flap this probe
        $gpu = Get-CimInstance Win32_VideoController -ErrorAction Stop |
            Where-Object { $_.PNPDeviceID -like 'PCI\*' } |
            Select-Object -First 1
        if ($gpu) {
            $state['gpu_driver'] = $gpu.DriverVersion
        }
    } catch { }

    try {
        if ($Config -and $Config.ContainsKey('wallpaper_path') -and $Config['wallpaper_path']) {
            # Store the actual registry value so replacement (not just unset)
            # is detected as drift
            $current = (Get-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name WallPaper -ErrorAction Stop).WallPaper
            $state['wallpaper_value'] = $current
        }
    } catch { }

    try {
        $sshd = Get-Service -Name sshd -ErrorAction SilentlyContinue
        $state['sshd_running'] = ($null -ne $sshd -and $sshd.Status -eq 'Running')
    } catch { }

    return $state
}
