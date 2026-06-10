<#
.SYNOPSIS
    Bootible - Universal Bootstrap Script (Windows)
    ================================================
    Detects your device and runs the appropriate configuration.

.DESCRIPTION
    Supported Devices:
    - ROG Ally X (Windows 11)
    - Other Windows gaming handhelds (Legion Go, etc.)

.USAGE
    # Preview what will happen (dry run - default):
    irm https://raw.githubusercontent.com/bootible/bootible/main/targets/ally.ps1 | iex

    # Run for real after reviewing:
    bootible

    # Or skip preview and run immediately:
    $env:BOOTIBLE_RUN = "1"
    irm https://raw.githubusercontent.com/bootible/bootible/main/targets/ally.ps1 | iex
#>

# When running via 'irm | iex', stdin is the script content which breaks git credential manager.
# Detect this and re-run as a saved script file instead.
if (-not $env:BOOTIBLE_DIRECT) {
    $scriptPath = "$env:TEMP\bootible-bootstrap.ps1"
    # Use bootible.dev which includes SHA256 integrity verification
    # Falls back to raw GitHub if bootible.dev is unavailable
    $primaryUrl = "https://bootible.dev/rog"
    $fallbackUrl = "https://raw.githubusercontent.com/bootible/bootible/main/targets/ally.ps1"

    Write-Host "Downloading bootible (with integrity verification)..." -ForegroundColor Cyan
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        try {
            # Primary: bootible.dev with built-in SHA256 verification
            Invoke-WebRequest -Uri $primaryUrl -OutFile $scriptPath -UseBasicParsing -Headers @{"Cache-Control"="no-cache"} -TimeoutSec 30
        } catch {
            Write-Host "  bootible.dev unavailable, using GitHub fallback..." -ForegroundColor Yellow
            Write-Host "  WARNING: GitHub fallback bypasses integrity verification" -ForegroundColor Yellow
            Invoke-WebRequest -Uri $fallbackUrl -OutFile $scriptPath -UseBasicParsing -Headers @{"Cache-Control"="no-cache"}
        }
        # Run with bypass to avoid execution policy issues, pass env var
        Start-Process -FilePath "powershell.exe" -ArgumentList "-ExecutionPolicy Bypass -NoProfile -Command `"& { `$env:BOOTIBLE_DIRECT='1'; & '$scriptPath' }`"" -Wait -NoNewWindow
        return
    } catch {
        Write-Host "Failed to download script: $_" -ForegroundColor Red
        return
    }
}

$ErrorActionPreference = "Stop"

$BootibleDir = "$env:USERPROFILE\bootible"
$RepoUrl = "https://github.com/bootible/bootible.git"
# Updated by the release process; "main" on the beta channel
$Script:BootibleRef = "main"
$PrivateRepo = $env:BOOTIBLE_PRIVATE
$DryRun = $env:BOOTIBLE_RUN -ne "1"  # Dry run by default, set BOOTIBLE_RUN=1 to apply
$Device = ""

function Write-Status {
    param([string]$Message, [string]$Type = "Info")
    $colors = @{ "Info" = "Cyan"; "Success" = "Green"; "Warning" = "Yellow"; "Error" = "Red" }
    $symbols = @{ "Info" = "->"; "Success" = "[OK]"; "Warning" = "[!]"; "Error" = "[X]" }
    Write-Host "$($symbols[$Type]) " -ForegroundColor $colors[$Type] -NoNewline
    Write-Host $Message
}

function Sync-SystemTime {
    # Sync system time to fix certificate validation errors on fresh installs
    Write-Status "Syncing system time..." "Info"
    try {
        $svc = Get-Service w32time -ErrorAction SilentlyContinue
        if ($svc -and $svc.Status -ne 'Running') {
            Write-Host "    Starting time service..." -ForegroundColor Gray
            Start-Service w32time -ErrorAction Stop
        }
        $result = w32tm /resync /force 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "    Time sync warning: $result" -ForegroundColor Yellow
        } else {
            Write-Status "System time synced" "Success"
        }
    } catch {
        Write-Status "Time sync failed: $_ (continuing anyway)" "Warning"
    }
}

function Test-Admin {
    return ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Detect-Device {
    Write-Status "Detecting device..." "Info"

    # Check manufacturer and product name
    $system = Get-WmiObject -Class Win32_ComputerSystem
    $manufacturer = $system.Manufacturer
    $product = $system.Model

    # ROG Ally detection
    if ($manufacturer -like "*ASUS*" -and $product -like "*ROG Ally*") {
        $script:Device = "rog-ally"
        Write-Status "Detected: ASUS ROG Ally X" "Success"
        return
    }

    # Lenovo Legion Go detection
    if ($manufacturer -like "*Lenovo*" -and $product -like "*Legion Go*") {
        $script:Device = "rog-ally"  # Use ROG Ally config as base
        Write-Status "Detected: Lenovo Legion Go (using ROG Ally config)" "Success"
        return
    }

    # MSI Claw detection
    if ($manufacturer -like "*MSI*" -and $product -like "*Claw*") {
        $script:Device = "rog-ally"
        Write-Status "Detected: MSI Claw (using ROG Ally config)" "Success"
        return
    }

    # Default to rog-ally for any Windows device
    $script:Device = "rog-ally"
    Write-Status "Windows device detected - using ROG Ally configuration" "Info"
}

$script:GitExe = "git"  # Will be updated to full path if needed

function Find-GitExe {
    # Check if git is already in PATH
    $existing = Get-Command git -ErrorAction SilentlyContinue
    if ($existing) {
        return $existing.Source
    }

    # Search common install locations
    $searchPaths = @(
        "$env:ProgramFiles\Git\cmd\git.exe",
        "$env:ProgramFiles\Git\bin\git.exe",
        "${env:ProgramFiles(x86)}\Git\cmd\git.exe",
        "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe",
        "$env:USERPROFILE\AppData\Local\Programs\Git\cmd\git.exe",
        "$env:USERPROFILE\scoop\apps\git\current\bin\git.exe",
        "C:\Git\cmd\git.exe",
        "C:\Program Files\Git\cmd\git.exe"
    )

    foreach ($path in $searchPaths) {
        if (Test-Path $path) {
            return $path
        }
    }

    # Last resort: search Program Files recursively (slow but thorough)
    $found = Get-ChildItem -Path "$env:ProgramFiles" -Recurse -Filter "git.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) {
        return $found.FullName
    }

    return $null
}

function Get-LatestGitVersion {
    try {
        $apiUrl = "https://api.github.com/repos/git-for-windows/git/releases/latest"
        $release = Invoke-RestMethod -Uri $apiUrl -UseBasicParsing -TimeoutSec 10
        # Tag format: v2.47.1.windows.1
        if ($release.tag_name -match 'v(\d+\.\d+\.\d+)\.windows\.\d+') {
            $version = $matches[1]
            return @{
                Version = $version
                Tag = $release.tag_name
                Url = "https://github.com/git-for-windows/git/releases/download/$($release.tag_name)/Git-$version-64-bit.exe"
            }
        }
    } catch {
        Write-Host "    Note: Could not fetch latest Git version, using fallback" -ForegroundColor Gray
    }
    # Fallback to known working version
    return @{
        Version = "2.47.1"
        Tag = "v2.47.1.windows.1"
        Url = "https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.1/Git-2.47.1-64-bit.exe"
    }
}

function Get-LatestGhCliVersion {
    try {
        $apiUrl = "https://api.github.com/repos/cli/cli/releases/latest"
        $release = Invoke-RestMethod -Uri $apiUrl -UseBasicParsing -TimeoutSec 10
        # Tag format: v2.63.2
        if ($release.tag_name -match 'v(\d+\.\d+\.\d+)') {
            $version = $matches[1]
            return @{
                Version = $version
                Tag = $release.tag_name
                Url = "https://github.com/cli/cli/releases/download/$($release.tag_name)/gh_${version}_windows_amd64.msi"
            }
        }
    } catch {
        Write-Host "    Note: Could not fetch latest gh version, using fallback" -ForegroundColor Gray
    }
    # Fallback to known working version
    return @{
        Version = "2.63.2"
        Tag = "v2.63.2"
        Url = "https://github.com/cli/cli/releases/download/v2.63.2/gh_2.63.2_windows_amd64.msi"
    }
}

function Install-Git {
    $gitPath = Find-GitExe
    if ($gitPath) {
        $script:GitExe = $gitPath
        Write-Status "Git found at $gitPath" "Success"
        return $true
    }

    Write-Status "Installing Git from GitHub (~65MB)..." "Info"
    try {
        $gitInfo = Get-LatestGitVersion
        $gitInstaller = "$env:TEMP\Git-installer.exe"
        $gitUrl = $gitInfo.Url

        Write-Host "    Downloading Git $($gitInfo.Version)..." -ForegroundColor Gray
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $gitUrl -OutFile $gitInstaller -UseBasicParsing

        if (-not (Test-Path $gitInstaller)) {
            throw "Download failed - file not found"
        }
        Write-Status "Download complete" "Success"

        Write-Status "Running Git installer (please wait)..." "Info"
        Start-Process -FilePath $gitInstaller -ArgumentList "/VERYSILENT", "/NORESTART", "/SP-" -Wait -NoNewWindow

        # Clean up
        Remove-Item $gitInstaller -ErrorAction SilentlyContinue

        Start-Sleep -Seconds 2

        $gitPath = Find-GitExe
        if ($gitPath) {
            $script:GitExe = $gitPath
            Write-Status "Git installed at $gitPath" "Success"
            return $true
        }

        Write-Status "Git installed but not found in expected locations" "Warning"
        Write-Status "Please close and reopen PowerShell, then re-run" "Info"
        return $false
    } catch {
        Write-Status "Git installation failed: $_" "Error"
        Write-Status "Please install Git manually from https://git-scm.com then re-run" "Warning"
        return $false
    }
}

function Configure-GitCredentials {
    # Ensure Git Credential Manager is configured for GUI prompts
    if (-not $script:GitExe) { return }

    Write-Host "    Configuring Git credential manager..." -ForegroundColor Gray
    $configErrors = @()
    $result = & $script:GitExe config --global credential.helper manager 2>&1
    if ($LASTEXITCODE -ne 0) { $configErrors += "credential.helper: $result" }
    $result = & $script:GitExe config --global credential.guiPrompt true 2>&1
    if ($LASTEXITCODE -ne 0) { $configErrors += "credential.guiPrompt: $result" }
    $result = & $script:GitExe config --global credential.useHttpPath true 2>&1
    if ($LASTEXITCODE -ne 0) { $configErrors += "credential.useHttpPath: $result" }

    if ($configErrors.Count -gt 0) {
        Write-Host "    Warning: Some git config settings failed:" -ForegroundColor Yellow
        $configErrors | ForEach-Object { Write-Host "      $_" -ForegroundColor Yellow }
    }
}

function Show-DeviceCodePopup {
    param([string]$Code, [string]$QrUrl)

    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing

    $form = New-Object System.Windows.Forms.Form
    $form.Text = "GitHub Login"
    $form.Size = New-Object System.Drawing.Size(500, 420)
    $form.StartPosition = "CenterScreen"
    $form.FormBorderStyle = "FixedDialog"
    $form.MaximizeBox = $false
    $form.TopMost = $true
    $form.BackColor = [System.Drawing.Color]::FromArgb(30, 30, 30)

    # Title
    $title = New-Object System.Windows.Forms.Label
    $title.Text = "Scan QR or enter code:"
    $title.Font = New-Object System.Drawing.Font("Segoe UI", 14)
    $title.ForeColor = [System.Drawing.Color]::White
    $title.AutoSize = $true
    $title.Location = New-Object System.Drawing.Point(140, 15)
    $form.Controls.Add($title)

    # Large code display
    $codeLabel = New-Object System.Windows.Forms.Label
    $codeLabel.Text = $Code
    $codeLabel.Font = New-Object System.Drawing.Font("Consolas", 42, [System.Drawing.FontStyle]::Bold)
    $codeLabel.ForeColor = [System.Drawing.Color]::FromArgb(88, 166, 255)
    $codeLabel.AutoSize = $true
    $codeLabel.Location = New-Object System.Drawing.Point(100, 50)
    $form.Controls.Add($codeLabel)

    # QR Code
    $qrBox = New-Object System.Windows.Forms.PictureBox
    $qrBox.Size = New-Object System.Drawing.Size(180, 180)
    $qrBox.Location = New-Object System.Drawing.Point(155, 120)
    $qrBox.SizeMode = "Zoom"
    $qrBox.BackColor = [System.Drawing.Color]::White

    try {
        $wc = New-Object System.Net.WebClient
        $bytes = $wc.DownloadData($QrUrl)
        $ms = New-Object System.IO.MemoryStream(,$bytes)
        $qrBox.Image = [System.Drawing.Image]::FromStream($ms)
    } catch {
        $qrBox.BackColor = [System.Drawing.Color]::Gray
    }
    $form.Controls.Add($qrBox)

    # Status
    $status = New-Object System.Windows.Forms.Label
    $status.Text = "Waiting for login..."
    $status.Font = New-Object System.Drawing.Font("Segoe UI", 10)
    $status.ForeColor = [System.Drawing.Color]::Gray
    $status.AutoSize = $true
    $status.Location = New-Object System.Drawing.Point(175, 310)
    $form.Controls.Add($status)

    # Close button
    $btn = New-Object System.Windows.Forms.Button
    $btn.Text = "Done"
    $btn.Font = New-Object System.Drawing.Font("Segoe UI", 11)
    $btn.Size = New-Object System.Drawing.Size(140, 40)
    $btn.Location = New-Object System.Drawing.Point(175, 340)
    $btn.BackColor = [System.Drawing.Color]::FromArgb(46, 160, 67)
    $btn.ForeColor = [System.Drawing.Color]::White
    $btn.FlatStyle = "Flat"
    $btn.Add_Click({ $form.Close() })
    $form.Controls.Add($btn)

    $form.Show()
    return @{ Form = $form; Status = $status }
}

function Authenticate-GitHub {
    # Use GitHub's Device Flow API directly for reliable auth with nice popup
    Write-Status "Setting up GitHub authentication..." "Info"

    # Check if gh is installed (needed to store token later)
    $ghPath = Get-Command gh -ErrorAction SilentlyContinue
    if (-not $ghPath) {
        Write-Host "    Installing GitHub CLI..." -ForegroundColor Gray

        # Try winget first
        winget install GitHub.cli --accept-package-agreements --accept-source-agreements --silent 2>$null
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        $ghPath = Get-Command gh -ErrorAction SilentlyContinue

        # If winget failed, download directly
        if (-not $ghPath) {
            Write-Host "    Downloading GitHub CLI directly..." -ForegroundColor Gray
            try {
                $ghInfo = Get-LatestGhCliVersion
                $ghInstaller = "$env:TEMP\gh_installer.msi"
                $ghUrl = $ghInfo.Url
                Write-Host "    Downloading gh $($ghInfo.Version)..." -ForegroundColor Gray
                [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
                Invoke-WebRequest -Uri $ghUrl -OutFile $ghInstaller -UseBasicParsing

                Write-Host "    Installing..." -ForegroundColor Gray
                Start-Process -FilePath "msiexec.exe" -ArgumentList "/i `"$ghInstaller`" /quiet /norestart" -Wait
                Remove-Item $ghInstaller -Force -ErrorAction SilentlyContinue

                # Refresh PATH
                $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
                $ghPath = Get-Command gh -ErrorAction SilentlyContinue
            } catch {
                Write-Host "    Could not install GitHub CLI: $_" -ForegroundColor Yellow
            }
        }
    }

    if (-not $ghPath) {
        Write-Status "GitHub CLI not available - private repos may not work" "Warning"
        return $false
    }

    # Check if already authenticated
    Write-Host "    Checking GitHub auth status..." -ForegroundColor Gray
    $origErrorPref = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    $null = & gh auth status 2>&1
    $authExitCode = $LASTEXITCODE
    $ErrorActionPreference = $origErrorPref

    if ($authExitCode -eq 0) {
        Write-Status "Already authenticated with GitHub" "Success"
        & gh auth setup-git 2>&1 | Out-Null
        return $true
    }

    # Not authenticated - use GitHub Device Flow API directly
    Write-Host ""
    Write-Host "    ============================================" -ForegroundColor Cyan
    Write-Host "    GitHub Login Required" -ForegroundColor Cyan
    Write-Host "    ============================================" -ForegroundColor Cyan
    Write-Host ""

    # GitHub CLI's OAuth client_id (public, used by gh CLI)
    $clientId = "178c6fc778ccc68e1d6a"
    $scope = "repo,read:org,admin:public_key"

    try {
        # Request device code from GitHub (JSON response)
        Write-Host "    Requesting login code..." -ForegroundColor Gray
        $headers = @{ "Accept" = "application/json" }
        $deviceResponse = Invoke-RestMethod -Uri "https://github.com/login/device/code" -Method Post -Body "client_id=$clientId&scope=$scope" -ContentType "application/x-www-form-urlencoded" -Headers $headers

        $deviceCode = $deviceResponse.device_code
        $userCode = $deviceResponse.user_code
        $interval = $deviceResponse.interval
        $expiresIn = $deviceResponse.expires_in

        if (-not $userCode) {
            throw "Failed to get device code from GitHub"
        }

        # Generate QR code URL
        $githubUrl = "https://github.com/login/device"
        $qrApiUrl = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=$([uri]::EscapeDataString($githubUrl))"

        # Show popup with code and QR
        $ui = Show-DeviceCodePopup -Code $userCode -QrUrl $qrApiUrl

        Write-Host ""
        Write-Host "    Scan the QR code with your phone to login." -ForegroundColor White
        Write-Host "    Waiting for authentication..." -ForegroundColor Gray

        # Poll for completion while popup is open
        $accessToken = $null
        $pollStart = Get-Date
        $maxWait = [Math]::Min($expiresIn, 300)  # Max 5 minutes
        $tokenHeaders = @{ "Accept" = "application/json" }
        $currentInterval = $interval  # May increase on slow_down response

        while ($ui.Form.Visible -and ((Get-Date) - $pollStart).TotalSeconds -lt $maxWait) {
            [System.Windows.Forms.Application]::DoEvents()
            Start-Sleep -Seconds $currentInterval

            # Poll for token
            try {
                $tokenResponse = Invoke-RestMethod -Uri "https://github.com/login/oauth/access_token" -Method Post -Body "client_id=$clientId&device_code=$deviceCode&grant_type=urn:ietf:params:oauth:grant-type:device_code" -ContentType "application/x-www-form-urlencoded" -Headers $tokenHeaders -ErrorAction SilentlyContinue

                if ($tokenResponse.access_token) {
                    $accessToken = $tokenResponse.access_token
                    $ui.Status.Text = "Success!"
                    $ui.Status.ForeColor = [System.Drawing.Color]::LightGreen
                    [System.Windows.Forms.Application]::DoEvents()
                    Start-Sleep -Seconds 1
                    $ui.Form.Close()
                    break
                }
                elseif ($tokenResponse.error -eq 'slow_down') {
                    # GitHub says we're polling too fast - increase interval by 5 seconds
                    $currentInterval = $currentInterval + 5
                }
                elseif ($tokenResponse.error -eq 'expired_token') {
                    # Device code expired, need to restart
                    $ui.Status.Text = "Code expired"
                    $ui.Status.ForeColor = [System.Drawing.Color]::Orange
                    break
                }
                elseif ($tokenResponse.error -eq 'access_denied') {
                    # User cancelled authorization
                    $ui.Status.Text = "Cancelled"
                    break
                }
                # 'authorization_pending' is expected while waiting - continue polling
            } catch {
                # Network or other errors - track for debugging but continue
                $script:LastOAuthError = $_.Exception.Message
            }
        }

        $ui.Form.Dispose()

        if ($accessToken) {
            # Save token to gh CLI
            Write-Host ""
            Write-Host "    Saving credentials..." -ForegroundColor Gray

            # Write token to temp file for reliable stdin piping
            $tokenFile = "$env:TEMP\gh-token-$([guid]::NewGuid().ToString('N').Substring(0,8)).tmp"
            try {
                $accessToken | Out-File -FilePath $tokenFile -Encoding ASCII -NoNewline
                $loginResult = cmd /c "type `"$tokenFile`" | gh auth login --with-token 2>&1"
                $loginExitCode = $LASTEXITCODE
            } finally {
                # Always clean up token file
                Remove-Item $tokenFile -Force -ErrorAction SilentlyContinue
            }

            if ($loginExitCode -ne 0) {
                Write-Host "    gh auth login failed: $loginResult" -ForegroundColor Yellow
            }

            # Verify it worked
            $ErrorActionPreference = "SilentlyContinue"
            $null = & gh auth status 2>&1
            $authWorked = $LASTEXITCODE -eq 0
            $ErrorActionPreference = $origErrorPref

            if ($authWorked) {
                & gh auth setup-git 2>&1 | Out-Null
                Write-Status "GitHub authentication complete" "Success"
                return $true
            } else {
                Write-Host "    gh auth status check failed after login" -ForegroundColor Yellow
            }
        }

        Write-Status "Authentication timed out or was cancelled" "Warning"
        return $false

    } catch {
        Write-Status "Device flow failed: $_" "Warning"

        # Fallback to manual gh auth
        Write-Host "    Falling back to manual authentication..." -ForegroundColor Yellow
        $ghExe = (Get-Command gh).Source
        $proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c set GH_FORCE_TTY=1 && `"$ghExe`" auth login --hostname github.com --git-protocol https --web" -PassThru

        Write-Host ""
        Read-Host "    Press Enter after completing GitHub login in the other window"

        try {
            if (-not $proc.HasExited) { $proc.Kill() }
            Get-Process -Name "gh" -ErrorAction SilentlyContinue | Where-Object { $_.StartTime -gt (Get-Date).AddMinutes(-5) } | Stop-Process -Force -ErrorAction SilentlyContinue
        } catch {
            # Process cleanup failed - non-critical, continue with auth check
            Write-Host "    Note: Process cleanup failed: $($_.Exception.Message)" -ForegroundColor Gray
        }

        $ErrorActionPreference = "SilentlyContinue"
        $null = & gh auth status 2>&1
        $authWorked = $LASTEXITCODE -eq 0
        $ErrorActionPreference = $origErrorPref

        if ($authWorked) {
            & gh auth setup-git 2>&1 | Out-Null
            Write-Status "GitHub authentication complete" "Success"
            return $true
        }

        Write-Status "GitHub authentication failed" "Warning"
        return $false
    }
}

function Run-GitWithProgress {
    param(
        [string]$Description,
        [string[]]$Arguments,
        [string]$WorkingDir = $null
    )

    Write-Status "$Description..." "Info"

    $cleanArgs = @($Arguments | Where-Object { $_ -ne "--progress" })
    $workDir = if ($WorkingDir) { $WorkingDir } else { (Get-Location).Path }

    try {
        Push-Location $workDir
        & $script:GitExe @cleanArgs
        $exitCode = $LASTEXITCODE
        Pop-Location

        if ($exitCode -ne 0) {
            throw "Git command failed (exit code $exitCode)"
        }
        return $true
    } catch {
        Write-Status "Git failed: $_" "Error"
        throw $_
    }
}

function Clone-Bootible {
    try {
        if (Test-Path $BootibleDir) {
            if ($Script:BootibleRef -eq "main") {
                # Fetch + checkout main first so a device previously pinned to a
                # release tag (detached HEAD) can return to the beta channel
                Run-GitWithProgress -Description "Fetching bootible updates" -Arguments @("fetch", "--tags", "--quiet", "origin") -WorkingDir $BootibleDir
                Run-GitWithProgress -Description "Checking out bootible main" -Arguments @("checkout", "--quiet", "main") -WorkingDir $BootibleDir
                Run-GitWithProgress -Description "Updating bootible repo" -Arguments @("pull", "--quiet", "origin", "main") -WorkingDir $BootibleDir
            } else {
                Run-GitWithProgress -Description "Fetching bootible releases" -Arguments @("fetch", "--tags", "--quiet", "origin") -WorkingDir $BootibleDir
                Run-GitWithProgress -Description "Checking out bootible $($Script:BootibleRef)" -Arguments @("checkout", "--quiet", $Script:BootibleRef) -WorkingDir $BootibleDir
            }
        } else {
            Run-GitWithProgress -Description "Cloning bootible repo" -Arguments @("clone", $RepoUrl, $BootibleDir)
            if ($Script:BootibleRef -ne "main") {
                Run-GitWithProgress -Description "Fetching bootible releases" -Arguments @("fetch", "--tags", "--quiet", "origin") -WorkingDir $BootibleDir
                Run-GitWithProgress -Description "Checking out bootible $($Script:BootibleRef)" -Arguments @("checkout", "--quiet", $Script:BootibleRef) -WorkingDir $BootibleDir
            }
        }
        Write-Status "Bootible ready at $BootibleDir" "Success"
        return $true
    } catch {
        Write-Status "Failed to clone/update bootible: $_" "Error"
        return $false
    }
}

function Setup-Private {
    # Check if already set via environment variable
    if (-not $PrivateRepo) {
        Write-Host ""
        $response = $null
        while ($response -eq $null) {
            $input = Read-Host "Do you have a private config repo? (y/N)"
            if ($input -match "^[Yy]$") {
                $response = "y"
            } elseif ($input -match "^[Nn]$" -or $input -eq "") {
                $response = "n"
            } else {
                Write-Host "Invalid input. Please enter 'y' or 'n'" -ForegroundColor Red
            }
        }
        if ($response -eq "y") {
            Write-Host "Your GitHub username: " -NoNewline
            $Script:GitHubUser = Read-Host
            Write-Host "Private repo (e.g., " -NoNewline
            Write-Host "owner/repo" -ForegroundColor Yellow -NoNewline
            Write-Host "): " -NoNewline
            $repoPath = Read-Host
            if ($repoPath) {
                $script:PrivateRepo = "https://github.com/$repoPath.git"
            }
        }
    }

    if ($PrivateRepo) {
        $privatePath = Join-Path $BootibleDir "private"
        Write-Host ""
        Write-Status "Repo: $PrivateRepo" "Info"

        # Authenticate with GitHub CLI first (more reliable than GCM)
        if (-not (Authenticate-GitHub)) {
            Write-Status "Skipping private repo (authentication failed)" "Warning"
            return
        }

        try {
            if (Test-Path (Join-Path $privatePath ".git")) {
                # Update existing - use git pull
                Push-Location $privatePath
                & $script:GitExe pull 2>&1 | Out-Null
                Pop-Location
            } else {
                if (Test-Path $privatePath) {
                    Write-Host "    Removing old private folder..." -ForegroundColor Gray
                    Remove-Item -Recurse -Force $privatePath
                }

                # Try gh CLI first (avoids GCM deadlock bug)
                $ghPath = Get-Command gh -ErrorAction SilentlyContinue
                if ($ghPath) {
                    # Extract owner/repo from URL
                    $repoSlug = $PrivateRepo -replace 'https://github.com/' -replace '\.git$'
                    Write-Host "    Using GitHub CLI to clone..." -ForegroundColor Gray
                    # gh outputs progress to stderr which triggers ErrorActionPreference=Stop
                    # Temporarily allow stderr output without throwing
                    $prevEAP = $ErrorActionPreference
                    $ErrorActionPreference = "Continue"
                    try {
                        $cloneOutput = & gh repo clone $repoSlug $privatePath 2>&1 | Out-String
                        $cloneExitCode = $LASTEXITCODE
                    } finally {
                        $ErrorActionPreference = $prevEAP
                    }
                    if ($cloneExitCode -ne 0) {
                        Write-Host "    $cloneOutput" -ForegroundColor Red
                        throw "gh clone failed with exit code $cloneExitCode"
                    }
                } else {
                    # Fall back to git with credential helper (avoid token in URL for security)
                    $token = $null
                    try { $token = gh auth token 2>$null } catch { $token = $null }

                    if ($token) {
                        # Use GIT_ASKPASS to provide token securely (not visible in process args)
                        $askpassScript = "$env:TEMP\git-askpass.cmd"
                        # Create a temporary script that echoes the token
                        "@echo $token" | Out-File -FilePath $askpassScript -Encoding ASCII -Force
                        $env:GIT_ASKPASS = $askpassScript
                        $env:GIT_TERMINAL_PROMPT = "0"

                        Write-Host "    Cloning with credential helper..." -ForegroundColor Gray
                        try {
                            & $script:GitExe clone $PrivateRepo $privatePath 2>&1 | Out-Null
                        } finally {
                            # Clean up credentials immediately
                            Remove-Item $askpassScript -Force -ErrorAction SilentlyContinue
                            Remove-Item Env:\GIT_ASKPASS -ErrorAction SilentlyContinue
                            Remove-Item Env:\GIT_TERMINAL_PROMPT -ErrorAction SilentlyContinue
                        }
                    } else {
                        # Last resort - try normal git (may hang on GCM)
                        Write-Host "    Cloning (browser auth may appear)..." -ForegroundColor Yellow
                        & $script:GitExe clone $PrivateRepo $privatePath
                    }
                }
            }
            Write-Status "Private configuration linked" "Success"
        } catch {
            Write-Status "Failed to setup private repo: $_" "Warning"
            Write-Status "Continuing without private config..." "Info"
        }
    }
}

function Select-Config {
    $script:SelectedConfig = ""
    $script:SelectedInstance = ""
    $privateDeviceDir = Join-Path $BootibleDir "private\device\$Device"
    $defaultConfig = Join-Path $BootibleDir "config\$Device\config.yml"

    # Check if private device config directory exists
    if (-not (Test-Path $privateDeviceDir)) {
        Write-Status "Using default configuration" "Info"
        $script:SelectedConfig = $defaultConfig
        return
    }

    # Find device instance directories (each subdirectory is a device instance)
    $deviceInstances = Get-ChildItem -Path $privateDeviceDir -Directory -ErrorAction SilentlyContinue | Sort-Object Name

    # If no device instances, use default
    if (-not $deviceInstances -or $deviceInstances.Count -eq 0) {
        Write-Status "Using default configuration" "Info"
        $script:SelectedConfig = $defaultConfig
        return
    }

    # If only one instance, use it automatically
    if ($deviceInstances.Count -eq 1) {
        $script:SelectedInstance = $deviceInstances[0].Name
        $script:SelectedConfig = Join-Path $deviceInstances[0].FullName "config.yml"
        Write-Status "Using config: $($deviceInstances[0].Name)" "Success"
        return
    }

    # Multiple instances - let user choose
    Write-Host ""
    Write-Host "Multiple configurations found:" -ForegroundColor Cyan
    Write-Host ""
    for ($i = 0; $i -lt $deviceInstances.Count; $i++) {
        $num = $i + 1
        Write-Host "  " -NoNewline
        Write-Host "$num" -ForegroundColor Yellow -NoNewline
        Write-Host ") $($deviceInstances[$i].Name)"
    }
    Write-Host ""

    while ($true) {
        $selection = Read-Host "Select configuration [1-$($deviceInstances.Count)]"

        if ($selection -match '^\d+$') {
            $idx = [int]$selection - 1
            if ($idx -ge 0 -and $idx -lt $deviceInstances.Count) {
                $script:SelectedInstance = $deviceInstances[$idx].Name
                $script:SelectedConfig = Join-Path $deviceInstances[$idx].FullName "config.yml"
                Write-Host ""
                Write-Status "Selected: $($deviceInstances[$idx].Name)" "Success"
                return
            }
        }
        Write-Host "Invalid selection. Please enter a number between 1 and $($deviceInstances.Count)" -ForegroundColor Red
    }
}

function Install-BootibleCommand {
    Write-Status "Installing 'bootible' command..." "Info"

    # Run Run.ps1 directly - it handles config selection internally
    $cmdContent = @"
@echo off
powershell -ExecutionPolicy Bypass -File "$BootibleDir\config\$Device\Run.ps1" %*
"@

    # Try WindowsApps first (already in PATH)
    $cmdPath = Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps\bootible.cmd"
    try {
        Set-Content -Path $cmdPath -Value $cmdContent -Force -ErrorAction Stop
        Write-Status "Installed 'bootible' command" "Success"
        return
    } catch {
        Write-Host "    WindowsApps not writable, trying fallback..." -ForegroundColor Gray
    }

    # Fallback: put in bootible directory and add to PATH
    $cmdPath = Join-Path $BootibleDir "bootible.cmd"
    try {
        Set-Content -Path $cmdPath -Value $cmdContent -Force
        Write-Host "    Adding to PATH..." -ForegroundColor Gray
        # Add to user PATH if not already there
        $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
        if ($userPath -notlike "*$BootibleDir*") {
            [System.Environment]::SetEnvironmentVariable("Path", "$BootibleDir;$userPath", "User")
            $env:Path = "$BootibleDir;$env:Path"
        }
        Write-Status "Installed 'bootible' command (added $BootibleDir to PATH)" "Success"
    } catch {
        Write-Status "Could not install bootible command: $_" "Warning"
        Write-Status "You can run manually: $BootibleDir\config\$Device\Run.ps1" "Info"
    }
}

function Run-DeviceSetup {
    Write-Host ""
    if ($DryRun) {
        Write-Status "Running $Device configuration (DRY RUN)..." "Warning"
    } else {
        Write-Status "Running $Device configuration..." "Info"
    }

    # Show which config is being used
    if ($script:SelectedConfig -and $script:SelectedConfig -ne (Join-Path $BootibleDir "config\$Device\config.yml")) {
        Write-Status "Config: $(Split-Path $script:SelectedConfig -Leaf)" "Info"
    }
    Write-Host ""

    $devicePath = Join-Path $BootibleDir "config\$Device"
    $runScript = Join-Path $devicePath "Run.ps1"

    # Build arguments for splatting
    $runParams = @{}
    if ($DryRun) {
        $runParams['DryRun'] = $true
    }
    if ($script:SelectedConfig) {
        $runParams['ConfigFile'] = $script:SelectedConfig
    }

    switch ($Device) {
        "rog-ally" {
            # Use call operator with splatting to avoid argument quoting issues
            & $runScript @runParams
        }
        default {
            Write-Status "Unknown device type: $Device" "Error"
            exit 1
        }
    }
}

function Main {
    # Detect device type first (needed for log path)
    Detect-Device

    # Start transcript - always start in TEMP since we don't know the instance yet
    # Will be moved to device instance Logs folder after Select-Config
    $suffix = if ($DryRun) { "_dryrun" } else { "_run" }
    $hostname = $env:COMPUTERNAME.ToLower()
    $logFileName = "$(Get-Date -Format 'yyyy-MM-dd_HHmmss')_${hostname}$suffix.log"
    $Script:TranscriptFile = Join-Path $env:TEMP "bootible_$logFileName"

    # Set env var so Run.ps1 knows transcript is already running
    $env:BOOTIBLE_TRANSCRIPT = $Script:TranscriptFile

    try {
        Start-Transcript -Path $Script:TranscriptFile -Force | Out-Null
    } catch {
        # Transcript failed to start, continue without it
    }

    Write-Host ""
    Write-Host "+------------------------------------------------------------+" -ForegroundColor Cyan
    Write-Host "|                      Bootible                              |" -ForegroundColor White
    Write-Host "|         Universal Gaming Device Configuration              |" -ForegroundColor Gray
    Write-Host "+------------------------------------------------------------+" -ForegroundColor Cyan
    Write-Host ""

    # Check admin
    if (-not (Test-Admin)) {
        Write-Status "Administrator privileges required" "Error"
        Write-Host ""
        Write-Host "Please run PowerShell as Administrator and try again." -ForegroundColor Yellow
        Write-Host ""
        return
    }
    Write-Status "Running as Administrator" "Success"

    # Sync time first (fixes certificate errors on fresh installs)
    Sync-SystemTime

    # Check winget
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Write-Status "winget not found. Please install App Installer from Microsoft Store." "Error"
        return
    }
    Write-Status "winget available" "Success"
    Write-Host ""

    if (-not (Install-Git)) {
        return
    }
    Configure-GitCredentials
    Write-Host ""

    if (-not (Clone-Bootible)) {
        Write-Host ""
        Write-Host "Failed to clone bootible. Check your network connection." -ForegroundColor Red
        return
    }
    Write-Host ""

    # Verify Run.ps1 exists
    $runScript = Join-Path $BootibleDir "config\$Device\Run.ps1"
    if (-not (Test-Path $runScript)) {
        Write-Status "Run.ps1 not found at $runScript" "Error"
        return
    }

    Setup-Private
    Write-Host ""

    Select-Config
    Write-Host ""

    # Move transcript from TEMP to device instance Logs folder now that we know the instance
    $privatePath = Join-Path $BootibleDir "private"
    if ($script:SelectedInstance -and (Test-Path $privatePath) -and $Script:TranscriptFile -and ($Script:TranscriptFile -like "$env:TEMP*")) {
        # Transcript is in TEMP, move it to device instance Logs folder
        $logsPath = Join-Path $privatePath "device\$Device\$($script:SelectedInstance)\Logs"
        if (-not (Test-Path $logsPath)) {
            New-Item -ItemType Directory -Path $logsPath -Force | Out-Null
        }

        # Stop current transcript
        try { Stop-Transcript | Out-Null } catch { }
        Start-Sleep -Milliseconds 500

        # Move file to logs folder (strip "bootible_" prefix)
        $tempFileName = Split-Path -Leaf $Script:TranscriptFile
        $logFileName = $tempFileName -replace '^bootible_', ''
        $newTranscriptPath = Join-Path $logsPath $logFileName
        if (Test-Path $Script:TranscriptFile) {
            Move-Item -Path $Script:TranscriptFile -Destination $newTranscriptPath -Force
            $Script:TranscriptFile = $newTranscriptPath
            $env:BOOTIBLE_TRANSCRIPT = $newTranscriptPath

            # Restart transcript appending to moved file
            try {
                Start-Transcript -Path $Script:TranscriptFile -Append -Force | Out-Null
            } catch { }
        }
    }

    Install-BootibleCommand
    Write-Host ""

    Run-DeviceSetup

    Write-Host ""
    if ($DryRun) {
        Write-Host "+------------------------------------------------------------+" -ForegroundColor Yellow
        Write-Host "|                  DRY RUN COMPLETE                          |" -ForegroundColor White
        Write-Host "+------------------------------------------------------------+" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Review the output above. When ready to apply changes:" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  bootible" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "+------------------------------------------------------------+" -ForegroundColor Green
        Write-Host "|                   Setup Complete!                          |" -ForegroundColor White
        Write-Host "+------------------------------------------------------------+" -ForegroundColor Green
        Write-Host ""
        Write-Host "Device: $Device" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow

        switch ($Device) {
            "rog-ally" {
                Write-Host "  - Restart your device to apply all changes"
                Write-Host "  - Configure Armoury Crate for performance profiles"
                Write-Host "  - Set up game streaming apps if installed"
            }
        }
        Write-Host ""
    }

    Write-Host "To re-run anytime:" -ForegroundColor Gray
    Write-Host "  bootible" -ForegroundColor Gray
    Write-Host ""

    # Stop transcript and push log (ally.ps1 owns the transcript)
    if ($Script:TranscriptFile) {
        try { Stop-Transcript | Out-Null } catch { }

        # Wait for file to flush
        Start-Sleep -Seconds 2

        $privatePath = Join-Path $BootibleDir "private"
        if ((Test-Path $privatePath) -and (Test-Path $Script:TranscriptFile)) {
            $logFileName = Split-Path -Leaf $Script:TranscriptFile
            $logType = if ($DryRun) { "Dry run" } else { "Run" }
            Write-Host "[OK] $logType log saved: $logFileName" -ForegroundColor Green

            # Push to git (refresh PATH first in case git was just installed)
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
            $gitExe = Get-Command git -ErrorAction SilentlyContinue
            if ($gitExe) {
                Push-Location $privatePath
                $prevEAP = $ErrorActionPreference
                $ErrorActionPreference = "Continue"
                try {
                    $runType = if ($DryRun) { "dry run" } else { "run" }

                    # Build log path based on whether we have a selected instance
                    if ($script:SelectedInstance) {
                        $logRelPath = "device/$Device/$($script:SelectedInstance)/Logs/$logFileName"
                        $logGlobPath = "device/$Device/$($script:SelectedInstance)/Logs/*.log"
                    } else {
                        # Fallback if no instance selected (shouldn't happen normally)
                        $logRelPath = "device/$Device"
                        $logGlobPath = "device/$Device/**/*.log"
                    }

                    # Verify log file exists before attempting git operations
                    if (-not (Test-Path $logRelPath)) {
                        Write-Host "[!] Log file not found: $logRelPath" -ForegroundColor Yellow
                    } else {
                        # Stage all log files (including any from failed previous runs)
                        & git add $logGlobPath 2>$null

                        # Check if there's anything to commit
                        $stagedFiles = & git diff --cached --name-only 2>$null
                        if ($stagedFiles) {
                            # Set git identity if not configured (required for commit)
                            $userName = & git config user.name 2>$null
                            $userEmail = & git config user.email 2>$null
                            if (-not $userName) {
                                & git config user.name "bootible" 2>$null
                            }
                            if (-not $userEmail) {
                                & git config user.email "bootible@localhost" 2>$null
                            }

                            # Commit with output captured to verify success
                            $instanceName = if ($script:SelectedInstance) { $script:SelectedInstance } else { $Device }
                            $commitOutput = & git commit -m "log: $instanceName $runType $(Get-Date -Format 'yyyy-MM-dd HH:mm')" 2>&1

                            # Verify commit actually happened by checking if files are still staged
                            $stillStaged = & git diff --cached --name-only 2>$null
                            if (-not $stillStaged) {
                                # Commit succeeded, now push
                                cmd /c "git push 2>nul"
                                if ($LASTEXITCODE -eq 0) {
                                    Write-Host "[OK] Log pushed to private repo" -ForegroundColor Green
                                } else {
                                    Write-Host "[!] Commit saved locally, push failed" -ForegroundColor Yellow
                                }
                            } else {
                                Write-Host "[!] Commit failed: $commitOutput" -ForegroundColor Yellow
                            }
                        } else {
                            Write-Host "[OK] Log saved (no changes to push)" -ForegroundColor Gray
                        }
                    }
                } finally {
                    $ErrorActionPreference = $prevEAP
                    Pop-Location
                }
            }
        }
    }
}

# Run
Main
