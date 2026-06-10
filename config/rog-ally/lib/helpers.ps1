# Bootible Helper Functions
# ==========================
# Pure functions with no side effects, safe to import for testing.

function Merge-Configs {
    <#
    .SYNOPSIS
        Recursively merges two configuration hashtables.
    .DESCRIPTION
        Override values take precedence. Nested hashtables are merged recursively.
        Non-hashtable values (arrays, strings, etc.) are replaced entirely.
    #>
    param(
        [hashtable]$Base,
        [hashtable]$Override
    )

    $result = $Base.Clone()

    foreach ($key in $Override.Keys) {
        if ($result.ContainsKey($key) -and $result[$key] -is [hashtable] -and $Override[$key] -is [hashtable]) {
            $result[$key] = Merge-Configs $result[$key] $Override[$key]
        } else {
            $result[$key] = $Override[$key]
        }
    }

    return $result
}

function Get-ConfigValue {
    <#
    .SYNOPSIS
        Gets a value from a nested config using dot notation.
    .EXAMPLE
        Get-ConfigValue -Config $config -Key "nested.level1.value" -Default "fallback"
    #>
    param(
        [hashtable]$Config,
        [string]$Key,
        $Default = $null
    )

    $keys = $Key -split '\.'
    $value = $Config

    foreach ($k in $keys) {
        if ($value -is [hashtable] -and $value.ContainsKey($k)) {
            $value = $value[$k]
        } else {
            return $Default
        }
    }

    return $value
}

function Find-PrivateDeviceConfigs {
    <#
    .SYNOPSIS
        Discovers private device configs for a device type.
    .DESCRIPTION
        Looks for the device-instance layout first (private/device/<device>/<Instance>/config.yml),
        falling back to the legacy flat layout (private/<device>/config*.yml).
        Returns objects with Name and ConfigPath, sorted by name.
    #>
    param(
        [Parameter(Mandatory)][string]$PrivateRoot,
        [Parameter(Mandatory)][string]$Device
    )

    $results = @()

    $deviceDir = Join-Path $PrivateRoot (Join-Path "device" $Device)
    if (Test-Path $deviceDir) {
        foreach ($dir in (Get-ChildItem -Path $deviceDir -Directory -ErrorAction SilentlyContinue | Sort-Object Name)) {
            $configPath = Join-Path $dir.FullName "config.yml"
            if (Test-Path $configPath) {
                $results += [pscustomobject]@{ Name = $dir.Name; ConfigPath = $configPath }
            }
        }
        if ($results.Count -gt 0) {
            return $results
        }
    }

    $legacyDir = Join-Path $PrivateRoot $Device
    if (Test-Path $legacyDir) {
        foreach ($file in (Get-ChildItem -Path $legacyDir -Filter "config*.yml" -File -ErrorAction SilentlyContinue | Sort-Object BaseName)) {
            $results += [pscustomobject]@{ Name = $file.BaseName; ConfigPath = $file.FullName }
        }
    }

    return $results
}

function Convert-OrderedDictToHashtable {
    <#
    .SYNOPSIS
        Converts OrderedDictionary (from ConvertFrom-Yaml) to regular hashtable.
    .DESCRIPTION
        Recursively converts nested OrderedDictionary objects and arrays.
    #>
    param($OrderedDict)

    $hashtable = @{}
    foreach ($key in $OrderedDict.Keys) {
        $value = $OrderedDict[$key]
        if ($value -is [System.Collections.Specialized.OrderedDictionary]) {
            $hashtable[$key] = Convert-OrderedDictToHashtable $value
        } elseif ($value -is [System.Collections.IList] -and $value -isnot [string]) {
            $hashtable[$key] = @($value | ForEach-Object {
                if ($_ -is [System.Collections.Specialized.OrderedDictionary]) {
                    Convert-OrderedDictToHashtable $_
                } else {
                    $_
                }
            })
        } else {
            $hashtable[$key] = $value
        }
    }
    return $hashtable
}

function Get-SmartAppControlState {
    <#
    .SYNOPSIS
        Reads the Windows Smart App Control state.
    .DESCRIPTION
        SAC silently blocks Armoury Crate components on Ally-class devices.
        Returns: off | on | evaluation | unknown. SAC cannot be disabled
        programmatically - turning it off is a one-way user action, and
        re-enabling requires a Windows reset. Detection + guidance only.
    #>
    param(
        [scriptblock]$RegistryReader = {
            (Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy' -Name 'VerifiedAndReputablePolicyState' -ErrorAction Stop).VerifiedAndReputablePolicyState
        }
    )

    try {
        $value = & $RegistryReader
    } catch {
        return "unknown"
    }

    switch ($value) {
        0 { return "off" }
        1 { return "on" }
        2 { return "evaluation" }
        default { return "unknown" }
    }
}

function Write-SmartAppControlAdvice {
    <#
    .SYNOPSIS
        Emits user guidance for a Smart App Control state via Write-Status.
    .DESCRIPTION
        Single source of truth for SAC messaging shared by the validate and
        health modules. Expects a state string from Get-SmartAppControlState
        (off | on | evaluation | unknown). Requires Write-Status in scope.
    #>
    param(
        [Parameter(Mandatory)][string]$State
    )

    switch ($State) {
        "on" {
            Write-Status "Smart App Control is ON - it blocks Armoury Crate components (ROG Live Service, ACSetup)" "Warning"
            Write-Status "Turning SAC off is one-way (re-enabling requires a Windows reset). If you rely on Armoury Crate: Settings > Privacy & security > Windows Security > App & browser control" "Info"
        }
        "evaluation" {
            Write-Status "Smart App Control is in evaluation mode - it may switch ON by itself and break Armoury Crate" "Warning"
        }
        "off" {
            Write-Status "Smart App Control: off" "Success"
        }
        default {
            Write-Status "Smart App Control state could not be determined (key absent - SAC may not exist on this Windows build)" "Info"
        }
    }
}

function Get-ScaffoldDirectories {
    <#
    .SYNOPSIS
        Normalizes a list of candidate directory paths for scaffolding.
    .DESCRIPTION
        Pure function: the caller extracts the raw path strings from config
        and passes them in. Trims whitespace, skips empty or whitespace-only
        values, and skips paths that are not explicitly absolute. Relative
        paths are rejected because resolution is ambiguous under an elevated
        shell: the working directory may differ from the user's home
        directory, and silently creating directories in the wrong location
        is worse than skipping them. Deduplicates case-insensitively,
        preserving first occurrence. Emits each accepted path onto the pipeline.
    #>
    param(
        [string[]]$Paths
    )

    $seen = [System.Collections.Generic.HashSet[string]]::new(
        [System.StringComparer]::OrdinalIgnoreCase)

    foreach ($path in $Paths) {
        $val = ([string]$path).Trim()
        if ([string]::IsNullOrWhiteSpace($val)) { continue }
        # Require an explicit drive letter (D:\, D:/) or Unix absolute path (/).
        # IsPathRooted is intentionally excluded: on Windows it also accepts \Games
        # (drive-relative paths), which are ambiguous under an elevated shell.
        $isRooted = ($val -match '^[A-Za-z]:[\\\/]') -or ($val -match '^[\/]')
        if (-not $isRooted) { continue }
        if ($seen.Add($val)) {
            $val
        }
    }
}
