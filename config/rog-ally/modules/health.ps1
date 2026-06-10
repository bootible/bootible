# Health Checks Module - Post-install Validation
# ==============================================
# Verifies key apps, registry settings, and services after install.

if (-not (Get-ConfigValue "post_install_health_checks" $true)) {
    Write-Status "Health checks disabled in config" "Info"
    return
}

if ($Script:DryRun) {
    Write-Status "[DRY RUN] Skipping post-install health checks" "Info"
    return
}

$script:HealthFailures = @()

function New-HealthResult {
    param(
        [bool]$Success,
        [string]$Detail = ""
    )

    return @{
        Success = $Success
        Detail = $Detail
    }
}

function Invoke-HealthCheck {
    param(
        [string]$Name,
        [scriptblock]$Check,
        [string]$ActionHint = ""
    )

    $start = Get-Date
    $success = $false
    $detail = ""

    try {
        $result = & $Check
        if ($result -is [hashtable]) {
            $success = [bool]$result.Success
            $detail = $result.Detail
        } else {
            $success = [bool]$result
        }
    } catch {
        $success = $false
        $detail = $_.Exception.Message
    }

    $durationMs = ((Get-Date) - $start).TotalMilliseconds
    $resultLabel = if ($success) { "OK" } else { "FAILED" }
    $statusType = if ($success) { "Success" } else { "Error" }

    Write-Status "${Name}: $resultLabel" $statusType

    if (-not $success) {
        if ($detail) {
            Write-Host "  Details: $detail" -ForegroundColor Yellow
        }
        if ($ActionHint) {
            Write-Host "  Action: $ActionHint" -ForegroundColor Yellow
        }
        $script:HealthFailures += $Name
    }

    $resultValue = if ($success) { "success" } else { "failed" }
    Add-JsonLogEntry -Module (Get-CurrentModuleName) -Action "health:$Name" -Result $resultValue -DurationMs $durationMs
}

function Test-CommandExecution {
    param(
        [string]$Command,
        [string[]]$Arguments
    )

    $commandInfo = Get-Command $Command -ErrorAction SilentlyContinue
    if (-not $commandInfo) {
        return New-HealthResult -Success $false -Detail "Command not found in PATH"
    }

    try {
        $output = & $commandInfo.Source @Arguments 2>&1 | Select-Object -First 1
        if ($LASTEXITCODE -eq 0) {
            return New-HealthResult -Success $true -Detail ($output -join " ")
        }
        return New-HealthResult -Success $false -Detail "Exit code $LASTEXITCODE"
    } catch {
        return New-HealthResult -Success $false -Detail $_.Exception.Message
    }
}

function Test-GuiAppLaunch {
    param(
        [string]$Name,
        [string[]]$Paths,
        [string]$ProcessName,
        [string]$Arguments = ""
    )

    $exePath = $Paths | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
    if (-not $exePath) {
        return New-HealthResult -Success $false -Detail "Executable not found"
    }

    $existing = $null
    if ($ProcessName) {
        $existing = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue
    }

    if ($existing) {
        return New-HealthResult -Success $true -Detail "Process already running"
    }

    try {
        if ($Arguments) {
            $process = Start-Process -FilePath $exePath -ArgumentList $Arguments -PassThru -ErrorAction Stop
        } else {
            $process = Start-Process -FilePath $exePath -PassThru -ErrorAction Stop
        }

        Start-Sleep -Seconds 5
        $runningById = Get-Process -Id $process.Id -ErrorAction SilentlyContinue
        if ($runningById) {
            Stop-Process -Id $process.Id -ErrorAction SilentlyContinue
            return New-HealthResult -Success $true -Detail "Process started"
        }

        if ($ProcessName) {
            $runningByName = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue
            if ($runningByName) {
                return New-HealthResult -Success $true -Detail "Process started"
            }
        }

        return New-HealthResult -Success $false -Detail "Process exited before check"
    } catch {
        return New-HealthResult -Success $false -Detail $_.Exception.Message
    }
}

function Test-RegistryValue {
    param(
        [string]$Path,
        [string]$Name,
        $Expected
    )

    try {
        if (-not (Test-Path $Path)) {
            return New-HealthResult -Success $false -Detail "Registry path missing"
        }

        $value = (Get-ItemProperty -Path $Path -Name $Name -ErrorAction SilentlyContinue).$Name
        if ($null -eq $value) {
            return New-HealthResult -Success $false -Detail "Registry value missing"
        }

        if ($value -eq $Expected) {
            return New-HealthResult -Success $true -Detail "$Name=$value"
        }

        return New-HealthResult -Success $false -Detail "$Name=$value (expected $Expected)"
    } catch {
        return New-HealthResult -Success $false -Detail $_.Exception.Message
    }
}

function Test-ServiceStatus {
    param(
        [string]$Name,
        [string]$ExpectedStatus = "Running",
        [string]$ExpectedStartMode = ""
    )

    $service = Get-Service -Name $Name -ErrorAction SilentlyContinue
    if (-not $service) {
        return New-HealthResult -Success $false -Detail "Service not found"
    }

    $statusOk = $service.Status -eq $ExpectedStatus
    $startModeOk = $true
    $startMode = ""

    if ($ExpectedStartMode) {
        $cim = Get-CimInstance -ClassName Win32_Service -Filter "Name='$Name'" -ErrorAction SilentlyContinue
        if ($cim) {
            $startMode = $cim.StartMode
            $startModeOk = $startMode -eq $ExpectedStartMode
        } else {
            $startModeOk = $false
        }
    }

    if ($statusOk -and $startModeOk) {
        $detail = if ($ExpectedStartMode) { "Status=$($service.Status), StartMode=$startMode" } else { "Status=$($service.Status)" }
        return New-HealthResult -Success $true -Detail $detail
    }

    $detailParts = @("Status=$($service.Status)")
    if ($ExpectedStartMode) {
        $detailParts += "StartMode=$startMode (expected $ExpectedStartMode)"
    }
    return New-HealthResult -Success $false -Detail ($detailParts -join "; ")
}

# =============================================================================
# APP LAUNCH CHECKS
# =============================================================================

if (Get-ConfigValue "install_steam" $false) {
    $steamPaths = @(
        "${env:ProgramFiles(x86)}\Steam\Steam.exe",
        "$env:ProgramFiles\Steam\Steam.exe"
    )
    Invoke-HealthCheck -Name "Steam launch" -ActionHint "Reinstall Steam or launch it once manually to finish setup" -Check {
        Test-GuiAppLaunch -Name "Steam" -Paths $steamPaths -ProcessName "steam" -Arguments "-silent"
    }
}

if (Get-ConfigValue "install_git" $false) {
    Invoke-HealthCheck -Name "Git CLI" -ActionHint "Reinstall Git or verify PATH includes Git\bin" -Check {
        Test-CommandExecution -Command "git" -Arguments @("--version")
    }
}

if (Get-ConfigValue "install_powershell7" $false) {
    Invoke-HealthCheck -Name "PowerShell 7" -ActionHint "Reinstall PowerShell 7 or verify pwsh.exe is in PATH" -Check {
        Test-CommandExecution -Command "pwsh" -Arguments @("-NoLogo", "-NoProfile", "-Command", '$PSVersionTable.PSVersion')
    }
}

# =============================================================================
# REGISTRY CHECKS
# =============================================================================

if (Get-ConfigValue "enable_game_mode" $true) {
    Invoke-HealthCheck -Name "Game Mode registry" -ActionHint "Re-run the optimization module to enable Game Mode" -Check {
        Test-RegistryValue -Path "HKCU:\Software\Microsoft\GameBar" -Name "AutoGameModeEnabled" -Expected 1
    }
}

if (Get-ConfigValue "enable_hardware_gpu_scheduling" $true) {
    Invoke-HealthCheck -Name "GPU scheduling registry" -ActionHint "Re-run the optimization module to enable GPU scheduling" -Check {
        Test-RegistryValue -Path "HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers" -Name "HwSchMode" -Expected 2
    }
}

if (Get-ConfigValue "enable_rdp" $false) {
    Invoke-HealthCheck -Name "RDP registry" -ActionHint "Toggle Remote Desktop in Settings to reapply" -Check {
        Test-RegistryValue -Path "HKLM:\System\CurrentControlSet\Control\Terminal Server" -Name "fDenyTSConnections" -Expected 0
    }

    Invoke-HealthCheck -Name "RDP firewall" -ActionHint "Enable the Remote Desktop firewall rules" -Check {
        $rules = Get-NetFirewallRule -DisplayGroup "Remote Desktop" -ErrorAction SilentlyContinue | Where-Object { $_.Enabled -eq 'True' }
        if ($rules) {
            return New-HealthResult -Success $true -Detail "Firewall rules enabled"
        }
        return New-HealthResult -Success $false -Detail "Remote Desktop firewall rules disabled"
    }
}

if (Get-ConfigValue "ssh_server_enable" $false) {
    Invoke-HealthCheck -Name "OpenSSH DefaultShell" -ActionHint "Re-run the SSH module to set DefaultShell" -Check {
        Test-RegistryValue -Path "HKLM:\SOFTWARE\OpenSSH" -Name "DefaultShell" -Expected "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
    }
}

if (Get-ConfigValue "force_time_sync" $true) {
    Invoke-HealthCheck -Name "Time sync registry" -ActionHint "Re-run the optimization module to reapply time sync" -Check {
        Test-RegistryValue -Path "HKLM:\SYSTEM\CurrentControlSet\Services\W32Time\Parameters" -Name "Type" -Expected "NTP"
    }
}

# =============================================================================
# SYSTEM STATE CHECKS
# =============================================================================

Write-SmartAppControlAdvice -State (Get-SmartAppControlState)

# =============================================================================
# SERVICE CHECKS
# =============================================================================

if (Get-ConfigValue "ssh_server_enable" $false) {
    Invoke-HealthCheck -Name "sshd service" -ActionHint "Start the sshd service and set StartupType to Automatic" -Check {
        Test-ServiceStatus -Name "sshd" -ExpectedStatus "Running" -ExpectedStartMode "Auto"
    }

    Invoke-HealthCheck -Name "ssh-agent service" -ActionHint "Start the ssh-agent service and set StartupType to Automatic" -Check {
        Test-ServiceStatus -Name "ssh-agent" -ExpectedStatus "Running" -ExpectedStartMode "Auto"
    }
}

if (Get-ConfigValue "force_time_sync" $true) {
    Invoke-HealthCheck -Name "Windows Time service" -ActionHint "Start the Windows Time service" -Check {
        Test-ServiceStatus -Name "W32Time" -ExpectedStatus "Running" -ExpectedStartMode "Auto"
    }
}

if ($script:HealthFailures.Count -gt 0) {
    $failedList = $script:HealthFailures -join ", "
    Write-Status "Health checks failed: $failedList" "Error"
    Write-Host "  Fix the issues above and re-run with -Tags health" -ForegroundColor Yellow
} else {
    Write-Status "All health checks passed" "Success"
}
