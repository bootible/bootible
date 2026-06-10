# Bootible Config Validation
# ===========================
# Validates configuration values on startup to catch misconfigurations early.

function Validate-Config {
    <#
    .SYNOPSIS
        Validates configuration values and returns errors/warnings.
    .DESCRIPTION
        Checks config values against expected types and constraints.
        Returns a hashtable with Errors, Warnings, and Valid status.
    .EXAMPLE
        $result = Validate-Config
        if (-not $result.Valid) {
            $result.Errors | ForEach-Object { Write-Error $_ }
        }
    #>
    param()

    $errors = @()
    $warnings = @()

    # Type validation rules: key => expected type
    $typeRules = @{
        'hostname' = 'string'
        'install_steam' = 'bool'
        'install_discord' = 'bool'
        'install_apps' = 'bool'
        'install_gaming' = 'bool'
        'install_streaming' = 'bool'
        'install_remote_access' = 'bool'
        'install_ssh' = 'bool'
        'install_emulation' = 'bool'
        'install_rog_ally' = 'bool'
        'install_optimization' = 'bool'
        'install_debloat' = 'bool'
        'install_dev_tools' = 'bool'
        'install_system_utilities' = 'bool'
        'install_runtimes' = 'bool'
        'create_restore_point' = 'bool'
        'post_install_health_checks' = 'bool'
        'package_managers.winget' = 'bool'
        'package_managers.chocolatey' = 'bool'
        'package_managers.scoop' = 'bool'
        'static_ip.enabled' = 'bool'
        'static_ip.prefix_length' = 'int'
        'static_ip.adapter' = 'string'
        'static_ip.address' = 'string'
        'static_ip.gateway' = 'string'
        'ssh_server_enable' = 'bool'
        'enable_game_mode' = 'bool'
        'enable_hardware_gpu_scheduling' = 'bool'
    }

    foreach ($key in $typeRules.Keys) {
        $value = Get-ConfigValue -Key $key -Default $null
        if ($null -ne $value) {
            $expectedType = $typeRules[$key]
            $valid = switch ($expectedType) {
                'string' { $value -is [string] }
                'int' { $value -is [int] -or $value -is [long] -or ($value -is [string] -and $value -match '^\d+$') }
                'bool' { $value -is [bool] -or $value -in @('true', 'false', $true, $false) }
            }
            if (-not $valid) {
                $errors += "Config '$key' should be $expectedType, got $($value.GetType().Name): '$value'"
            }
        }
    }

    # Static IP validation: if enabled, require address and gateway
    $staticIpEnabled = Get-ConfigValue -Key 'static_ip.enabled' -Default $false
    if ($staticIpEnabled -eq $true -or $staticIpEnabled -eq 'true') {
        $address = Get-ConfigValue -Key 'static_ip.address' -Default ''
        $gateway = Get-ConfigValue -Key 'static_ip.gateway' -Default ''

        if ([string]::IsNullOrWhiteSpace($address)) {
            $errors += "Static IP enabled but 'static_ip.address' is not set"
        }
        if ([string]::IsNullOrWhiteSpace($gateway)) {
            $errors += "Static IP enabled but 'static_ip.gateway' is not set"
        }
    }

    # Password managers validation
    $pwManagers = Get-ConfigValue -Key 'password_managers' -Default @()
    $validPwManagers = @('1password', 'bitwarden', 'keepassxc')
    foreach ($manager in $pwManagers) {
        if ($manager -notin $validPwManagers) {
            $warnings += "Unknown password manager '$manager', valid options: $($validPwManagers -join ', ')"
        }
    }

    return @{
        Errors = $errors
        Warnings = $warnings
        Valid = ($errors.Count -eq 0)
    }
}
