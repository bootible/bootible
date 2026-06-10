#Requires -Version 5.1
<#
.SYNOPSIS
    SchemaLiveness guard: every config.yml key must have a module consumer,
    and every Validate-ConfigSchema entry must correspond to a config.yml key.
#>

BeforeAll {
    $Script:ConfigYmlPath = Join-Path $PSScriptRoot '../config/rog-ally/config.yml'
    $Script:RunPs1Path    = Join-Path $PSScriptRoot '../config/rog-ally/Run.ps1'
    $Script:ModulesPath   = Join-Path $PSScriptRoot '../config/rog-ally/modules'
    $Script:LibPath       = Join-Path $PSScriptRoot '../config/rog-ally/lib'

    # Parse config.yml top-level keys. The anchor '^[a-z0-9_]+:' only matches
    # lines that start with a key character, so comment lines can never match.
    $lines = Get-Content $Script:ConfigYmlPath
    $Script:ConfigTopKeys = @(
        $lines | ForEach-Object { if ($_ -match '^([a-z0-9_]+):') { $Matches[1] } }
    )

    # Build consumed-keys set.
    # Sources: modules/*.ps1, lib/*.ps1 (excl. config-validation.ps1), Run.ps1.
    # config-validation.ps1 excluded: it references keys for type-checking only,
    # not behavior, so counting it would mask genuinely dead keys.
    #
    # Supported call forms (anything else is invisible to this scan -- fail-closed:
    # an unrecognized form makes its key look dead and fails the test):
    #   (a) Get-ConfigValue "key" / 'key'            -- positional literal
    #       Get-ConfigValue -Key "key" / -Key 'key'  -- named-parameter literal
    #   (b) Get-ConfigValue "root.sub"               -- structural block; root key consumed
    #   (c) Config = "key" / 'key'                   -- app-table entry, trusted as consumed
    #       without verifying that a loop actually reads $app.Config
    # Known limitation: variable-built keys (e.g. Get-ConfigValue $var) cannot be
    # detected; if one is ever introduced, add the key to $Script:Allowlist with a
    # justification comment.
    $sourceFiles = @(
        Get-ChildItem -Path $Script:ModulesPath -Filter '*.ps1' -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty FullName
        Get-ChildItem -Path $Script:LibPath -Filter '*.ps1' -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -ne 'config-validation.ps1' } |
            Select-Object -ExpandProperty FullName
        $Script:RunPs1Path
    )

    $Script:ConsumedKeys = [System.Collections.Generic.HashSet[string]]::new(
        [System.StringComparer]::OrdinalIgnoreCase
    )

    $q = '[''"]'  # character class matching ' or "

    foreach ($file in $sourceFiles) {
        if (-not (Test-Path $file)) { continue }
        $content = Get-Content $file -Raw

        # (a) positional or named-parameter literal key
        $patternA = "Get-ConfigValue\s+(?:-Key\s+)?$q([a-z0-9_]+)$q"
        [regex]::Matches($content, $patternA) |
            ForEach-Object { $null = $Script:ConsumedKeys.Add($_.Groups[1].Value) }

        # (b) structural block read: consume the root key
        $patternDot = "Get-ConfigValue\s+(?:-Key\s+)?$q([a-z0-9_]+)\."
        [regex]::Matches($content, $patternDot) |
            ForEach-Object { $null = $Script:ConsumedKeys.Add($_.Groups[1].Value) }

        # (c) app-table dynamic consumption
        $patternConfig = "Config\s*=\s*$q([a-z0-9_]+)$q"
        [regex]::Matches($content, $patternConfig) |
            ForEach-Object { $null = $Script:ConsumedKeys.Add($_.Groups[1].Value) }
    }

    # Allowlist for keys the scan cannot see (intentionally empty -- all structural
    # keys are reached by the literal scan: static_ip in base.ps1, package_managers
    # in base.ps1, password_managers in apps.ps1).
    $Script:Allowlist = @()

    # Parse Validate-ConfigSchema root keys, scoped to the function body so that
    # unrelated 'key' = 'value' hashtables elsewhere in Run.ps1 are not picked up.
    # The body runs from the function declaration to the first closing brace at
    # column 0. Entries may be single- or double-quoted. For dotted paths like
    # static_ip.enabled, take the root key (before the first '.') so it can be
    # checked against config.yml top-level keys.
    $runContent = Get-Content $Script:RunPs1Path -Raw
    $fnMatch = [regex]::Match($runContent, '(?sm)function Validate-ConfigSchema\b.*?^\}')
    if (-not $fnMatch.Success) {
        throw "Validate-ConfigSchema function not found in $Script:RunPs1Path"
    }
    $Script:SchemaRootKeys = @(
        [regex]::Matches($fnMatch.Value, '(?m)^\s+[''"]([a-z0-9_.]+)[''"]\s*=\s*[''"][^''"]*[''"]') |
            ForEach-Object { ($_.Groups[1].Value -split '\.')[0] } |
            Select-Object -Unique
    )
}

Describe "Every config key has a consumer" {
    It "has no dead keys (not consumed by any module or lib)" {
        $dead = @(
            $Script:ConfigTopKeys | Where-Object {
                $_ -notin $Script:ConsumedKeys -and $_ -notin $Script:Allowlist
            }
        )
        $dead | Should -BeNullOrEmpty -Because (
            "these config.yml keys have no consumer: $($dead -join ', ')"
        )
    }
}

Describe "Every schema key exists in config.yml" {
    It "has no schema-only keys absent from config.yml" {
        $missing = @(
            $Script:SchemaRootKeys | Where-Object { $_ -notin $Script:ConfigTopKeys }
        )
        $missing | Should -BeNullOrEmpty -Because (
            "these Validate-ConfigSchema keys are missing from config.yml: $($missing -join ', ')"
        )
    }
}
