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

    # Parse config.yml top-level keys (no leading whitespace, not comments)
    $lines = Get-Content $Script:ConfigYmlPath
    $Script:ConfigTopKeys = @(
        $lines | Where-Object { $_ -match '^([a-z0-9_]+):' -and $_ -notmatch '^\s*#' } |
            ForEach-Object { if ($_ -match '^([a-z0-9_]+):') { $Matches[1] } }
    )

    # Build consumed-keys set.
    # Sources: modules/*.ps1, lib/*.ps1 (excl. config-validation.ps1), Run.ps1.
    # config-validation.ps1 excluded: references keys for type-checking only, not behavior.
    # Dead entries in that file are cleaned in this same commit.
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

        # (a) Get-ConfigValue "key" or 'key' — literal key
        $patternA = "Get-ConfigValue\s+$q([a-z0-9_]+)$q"
        [regex]::Matches($content, $patternA) |
            ForEach-Object { $null = $Script:ConsumedKeys.Add($_.Groups[1].Value) }

        # (b) Get-ConfigValue "root.sub" — structural block: consume root key
        $patternDot = "Get-ConfigValue\s+$q([a-z0-9_]+)\."
        [regex]::Matches($content, $patternDot) |
            ForEach-Object { $null = $Script:ConsumedKeys.Add($_.Groups[1].Value) }

        # (c) Config = "key" / 'key' — app-table dynamic consumption
        $patternConfig = "Config\s*=\s*$q([a-z0-9_]+)$q"
        [regex]::Matches($content, $patternConfig) |
            ForEach-Object { $null = $Script:ConsumedKeys.Add($_.Groups[1].Value) }
    }

    # Structural allowlist (intentionally empty — all structural keys are reached by the
    # literal scan: static_ip in base.ps1, package_managers in base.ps1,
    # password_managers in apps.ps1).
    $Script:Allowlist = @()

    # Parse Validate-ConfigSchema root keys from Run.ps1.
    # Lines of the form:  '  'some.key.path' = 'type'  '
    # Extract root key (before first '.') so dotted paths like static_ip.enabled
    # resolve to the top-level config.yml key.
    $runContent = Get-Content $Script:RunPs1Path -Raw
    $Script:SchemaRootKeys = @(
        [regex]::Matches($runContent, "(?m)^\s+'([a-z0-9_.]+)'\s*=\s*'[^']*'") |
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
