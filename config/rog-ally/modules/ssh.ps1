# SSH Setup Module - Windows OpenSSH Server Configuration
# ========================================================
# Based on proven setup from known-working configuration.
# Configures SSH server with proper permissions for admin users.

if (-not (Get-ConfigValue "install_ssh" $false)) {
    Write-Status "SSH module disabled in config" "Info"
    return
}

# Get config values
$AuthorizedKeyFiles = Get-ConfigValue "ssh_authorized_keys" @()
$PrivateRepoPath = $Script:PrivateRoot
$enableSshServer = Get-ConfigValue "ssh_server_enable" $false

if (-not $enableSshServer) {
    Write-Status "SSH server disabled in config" "Info"
    return
}

Write-Host "=== SSH Setup ===" -ForegroundColor Cyan

# Enable TLS 1.2 from default (SSL3, TLS)
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Ssl3 -bor [Net.SecurityProtocolType]::Tls -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls12

if ($Script:DryRun) {
    Write-Host "[DRY RUN] Would configure SSH server" -ForegroundColor Yellow
    Write-Host "[DRY RUN] Would import keys: $($AuthorizedKeyFiles -join ', ')" -ForegroundColor Yellow
    return
}

# Enable TLS1.2 permanently
Set-ItemProperty -Path 'HKLM:\SOFTWARE\Wow6432Node\Microsoft\.NetFramework\v4.0.30319' -Name 'SchUseStrongCrypto' -Value '1' -Type DWord -Force
Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\.NetFramework\v4.0.30319' -Name 'SchUseStrongCrypto' -Value '1' -Type DWord -Force

# Install Nuget (required for some PowerShell modules)
$nuget = Get-PackageProvider -Name NuGet -ErrorAction SilentlyContinue
if (-not $nuget) {
    Write-Host "Installing NuGet package provider..." -ForegroundColor Gray
    Install-PackageProvider -Name NuGet -Force | Out-Null
}
Set-PSRepository -InstallationPolicy Trusted -Name PSGallery

# =============================================================================
# INSTALL OPENSSH
# =============================================================================

Write-Host "Checking OpenSSH installation..." -ForegroundColor Gray

[bool]$isSSHClientInstalled = Get-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0 | Where-Object { $_.State -eq 'Installed' } | Measure-Object | Select-Object -ExpandProperty Count
[bool]$isSSHServerInstalled = Get-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0 | Where-Object { $_.State -eq 'Installed' } | Measure-Object | Select-Object -ExpandProperty Count

if (-not($isSSHClientInstalled)) {
    Write-Host "Installing OpenSSH Client..." -ForegroundColor Gray
    Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0 | Out-Null
    Write-Host "[OK] OpenSSH Client installed" -ForegroundColor Green
}

if (-not($isSSHServerInstalled)) {
    Write-Host "Installing OpenSSH Server..." -ForegroundColor Gray
    Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0 | Out-Null
    Write-Host "[OK] OpenSSH Server installed" -ForegroundColor Green
}

# Configure SSH service
if (Get-Service sshd -ErrorAction SilentlyContinue) {
    # Set PowerShell as default shell for SSH
    New-ItemProperty -Path "HKLM:\SOFTWARE\OpenSSH" -Name DefaultShell -Value "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -PropertyType String -Force | Out-Null
    Set-Service -Name sshd -StartupType 'Automatic'
    Set-Service -Name ssh-agent -StartupType 'Automatic'

    $sshd = Get-Service sshd
    $sshdWasRunning = ($sshd.Status -eq 'Running')
    if (-not $sshdWasRunning) {
        Start-Service sshd
    }

    $agent = Get-Service ssh-agent
    if ($agent.Status -ne 'Running') {
        Start-Service ssh-agent
    }

    Write-Host "[OK] SSH services configured and running" -ForegroundColor Green
    # Only claim the change on the receipt when this run actually started sshd
    if (-not $sshdWasRunning -and (Get-Command Add-AppliedChange -ErrorAction SilentlyContinue)) {
        Add-AppliedChange "SSH server enabled on port 22"
    }
} else {
    Write-Host "[!] sshd service not found - restart may be required" -ForegroundColor Yellow
}

# =============================================================================
# IMPORT AUTHORIZED KEYS
# =============================================================================

Write-Host "Configuring authorized keys..." -ForegroundColor Gray

$ssh_admin_authorized_filepath = 'C:\ProgramData\ssh\administrators_authorized_keys'
$ssh_user_authorized_filepath = Join-Path $env:USERPROFILE ".ssh\authorized_keys"
$ssh_user_dir = Join-Path $env:USERPROFILE ".ssh"

# Build key list from private repo
$keysDirs = @(
    (Join-Path $PrivateRepoPath "ssh-keys"),
    (Join-Path $PrivateRepoPath "files\ssh-keys")
)

$pubkeys = @()
foreach ($keyFile in $AuthorizedKeyFiles) {
    $keyFound = $false
    foreach ($keysDir in $keysDirs) {
        $keyFilePath = Join-Path $keysDir $keyFile
        if (Test-Path $keyFilePath) {
            $keyContent = (Get-Content $keyFilePath -Raw).Trim()
            $pubkeys += $keyContent
            Write-Host "  Added key: $keyFile" -ForegroundColor Gray
            $keyFound = $true
            break
        }
    }
    if (-not $keyFound) {
        Write-Host "  [!] Key not found: $keyFile" -ForegroundColor Yellow
    }
}

if ($pubkeys.Count -eq 0) {
    Write-Host "[!] No authorized keys found to import" -ForegroundColor Yellow
} else {
    # Prepare key content
    $keyContent = $pubkeys -join "`n"

    # === ADMIN LOCATION ===
    # Write administrators_authorized_keys
    $keyContent | Out-File -Encoding ascii -FilePath $ssh_admin_authorized_filepath -Force

    # Fix owner and permissions (critical for Windows OpenSSH)
    # https://github.com/PowerShell/Win32-OpenSSH/wiki/Security-protection-of-various-files-in-Win32-OpenSSH
    Push-Location C:\ProgramData\ssh
    takeown /F administrators_authorized_keys /A | Out-Null
    icacls administrators_authorized_keys /inheritance:r | Out-Null
    icacls administrators_authorized_keys /grant SYSTEM:`(F`) | Out-Null
    icacls administrators_authorized_keys /grant BUILTIN\Administrators:`(F`) | Out-Null
    Pop-Location

    Write-Host "[OK] Admin authorized_keys configured: $ssh_admin_authorized_filepath" -ForegroundColor Green

    # === USER LOCATION ===
    # Ensure ~/.ssh directory exists
    if (-not (Test-Path $ssh_user_dir)) {
        New-Item -ItemType Directory -Path $ssh_user_dir -Force | Out-Null
    }

    # Write user authorized_keys
    $keyContent | Out-File -Encoding ascii -FilePath $ssh_user_authorized_filepath -Force

    # Fix permissions for user file
    icacls $ssh_user_authorized_filepath /inheritance:r | Out-Null
    icacls $ssh_user_authorized_filepath /grant "$($env:USERNAME):`(F`)" | Out-Null

    Write-Host "[OK] User authorized_keys configured: $ssh_user_authorized_filepath" -ForegroundColor Green

    Write-Host "[OK] Imported $($pubkeys.Count) authorized key(s)" -ForegroundColor Green
}

# =============================================================================
# CONFIGURE PSREMOTING OVER SSH (if PowerShell 7 is installed)
# =============================================================================

$sshd_config_filepath = 'C:\ProgramData\ssh\sshd_config'
if ((Test-Path $sshd_config_filepath) -And (Test-Path 'C:\Program Files\PowerShell\7')) {
    # Create symlink for shorter path (required for SSH subsystem)
    if (-not (Test-Path 'C:\pwsh')) {
        New-Item -ItemType SymbolicLink -Path C:\pwsh -Target 'C:\Program Files\PowerShell\7' -ErrorAction SilentlyContinue | Out-Null
    }

    $sshd_config = Get-Content -Path $sshd_config_filepath -Raw
    if ($sshd_config -notmatch 'Subsystem powershell') {
        $sshd_config -replace "^Subsystem.*sftp.*", "Subsystem sftp sftp-server.exe`nSubsystem powershell c:/pwsh/pwsh.exe -sshs -NoLogo" `
        | Set-Content -Path $sshd_config_filepath -Force
        Restart-Service sshd
        Write-Host "[OK] PSRemoting over SSH configured" -ForegroundColor Green
    }
}

# =============================================================================
# NETWORK PROFILE & FIREWALL
# =============================================================================

# Set network to Private (required for SSH to work properly)
$networkAdapter = "Wi-Fi"
$profile = Get-NetConnectionProfile -InterfaceAlias $networkAdapter -ErrorAction SilentlyContinue
if ($profile -and $profile.NetworkCategory -ne 'Private') {
    Set-NetConnectionProfile -InterfaceAlias $networkAdapter -NetworkCategory Private
    Write-Host "[OK] Network profile set to Private" -ForegroundColor Green
}

# Ensure SSH firewall rule exists
$existingSshRule = Get-NetFirewallRule -DisplayName "*SSH*" -ErrorAction SilentlyContinue |
    Where-Object { $_.Direction -eq "Inbound" -and $_.Enabled -eq 'True' }
if (-not $existingSshRule) {
    New-NetFirewallRule -DisplayName "Allow SSH" -Direction Inbound -Protocol TCP -LocalPort 22 -Action Allow | Out-Null
    Write-Host "[OK] SSH firewall rule created" -ForegroundColor Green
}

# Enable ICMPv4 (ping)
$existingIcmpRule = Get-NetFirewallRule -DisplayName "*ICMP*" -ErrorAction SilentlyContinue |
    Where-Object { $_.Direction -eq "Inbound" -and $_.Enabled -eq 'True' }
if (-not $existingIcmpRule) {
    New-NetFirewallRule -DisplayName "Allow ICMPv4-In" -Protocol ICMPv4 -IcmpType 8 -Direction Inbound -Action Allow | Out-Null
    Write-Host "[OK] ICMPv4 (ping) firewall rule created" -ForegroundColor Green
}

Write-Host "=== SSH Setup Complete ===" -ForegroundColor Green
