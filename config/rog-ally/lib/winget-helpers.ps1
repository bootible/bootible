# Winget Helper Functions
# =======================
# Extracted for testability - can be dot-sourced without executing full Run.ps1

# Script-scoped variables that control behavior
if (-not (Test-Path variable:Script:DryRun)) { $Script:DryRun = $false }
if (-not (Test-Path variable:Script:HasWingetSource)) { $Script:HasWingetSource = $true }
if (-not (Test-Path variable:Script:HasMsStoreSource)) { $Script:HasMsStoreSource = $true }
if (-not (Test-Path variable:Script:JsonLogEnabled)) { $Script:JsonLogEnabled = $false }
if (-not (Test-Path variable:Script:CurrentModule)) { $Script:CurrentModule = $null }

function Write-Status {
    param([string]$Message, [string]$Type = "Info")
    $colors = @{
        "Info" = "Cyan"
        "Success" = "Green"
        "Warning" = "Yellow"
        "Error" = "Red"
    }
    $symbols = @{
        "Info" = "->"
        "Success" = "[OK]"
        "Warning" = "[!]"
        "Error" = "[X]"
    }
    Write-Host "$($symbols[$Type]) " -ForegroundColor $colors[$Type] -NoNewline
    Write-Host $Message
}

function Get-CurrentModuleName {
    if ($Script:CurrentModule) {
        return $Script:CurrentModule
    }
    return "main"
}

function Add-JsonLogEntry {
    param(
        [string]$Module,
        [string]$Action,
        [string]$Result,
        [double]$DurationMs
    )

    if (-not $Script:JsonLogEnabled) {
        return
    }

    $entry = [ordered]@{
        timestamp = (Get-Date).ToString("o")
        module = if ($Module) { $Module } else { "main" }
        action = $Action
        result = $Result
        duration_ms = [math]::Round($DurationMs, 2)
    }

    $Script:JsonLogEntries += $entry
}

function Install-WingetPackage {
    param(
        [string]$PackageId,
        [string]$Name,
        [switch]$Force,
        [int]$TimeoutSeconds = 300  # 5 minute timeout per source (larger packages like VLC need more time)
    )

    $operationStart = Get-Date
    $logAction = "install:$Name"
    $logModule = Get-CurrentModuleName
    $completeLog = {
        param([string]$Result)
        $durationMs = ((Get-Date) - $operationStart).TotalMilliseconds
        Add-JsonLogEntry -Module $logModule -Action $logAction -Result $Result -DurationMs $durationMs
    }

    # Check if already installed first (even in DryRun)
    try {
        # Check both sources for existing installation
        $installed = winget list --id $PackageId --accept-source-agreements 2>$null
        if ($installed -match $PackageId) {
            Write-Status "$Name already installed - skipping" "Success"
            & $completeLog "skipped"
            if (-not $Script:DryRun -and (Get-Command Add-InstallResult -ErrorAction SilentlyContinue)) {
                Add-InstallResult -PackageId $PackageId -Name $Name -Status 'skipped' -Source ''
            }
            return $true
        }
    } catch {
        # winget list failed, continue with install attempt
    }

    if ($Script:DryRun) {
        # Validate package exists (check winget first, then msstore)
        Write-Host "    Validating $PackageId..." -ForegroundColor Gray -NoNewline

        $foundInWinget = $false
        $foundInMsStore = $false

        # winget outputs to stderr which triggers ErrorActionPreference=Stop
        # Temporarily allow stderr without throwing
        $prevEAP = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            if ($Script:HasWingetSource) {
                $showResult = winget show --id $PackageId --source winget --accept-source-agreements 2>&1 | Out-String
                if ($LASTEXITCODE -eq 0 -and $showResult -match "Found") {
                    $foundInWinget = $true
                }
            }

            if (-not $foundInWinget -and $Script:HasMsStoreSource) {
                $showResult = winget show --id $PackageId --source msstore --accept-source-agreements 2>&1 | Out-String
                if ($LASTEXITCODE -eq 0 -and $showResult -match "Found") {
                    $foundInMsStore = $true
                }
            }
        } finally {
            $ErrorActionPreference = $prevEAP
        }

        if ($foundInWinget) {
            Write-Host " OK (winget)" -ForegroundColor Green
            Write-Status "[DRY RUN] Would install: $Name ($PackageId) from winget" "Info"
            & $completeLog "dry_run"
            return $true
        } elseif ($foundInMsStore) {
            Write-Host " OK (msstore)" -ForegroundColor Yellow
            Write-Status "[DRY RUN] Would install: $Name ($PackageId) from msstore (fallback)" "Info"
            & $completeLog "dry_run"
            return $true
        } else {
            Write-Host " NOT FOUND" -ForegroundColor Red
            Write-Status "[DRY RUN] Package not found in any source: $PackageId" "Warning"
            & $completeLog "not_found"
            return $false
        }
    }

    Write-Status "Installing $Name..." "Info"

    # Helper function to run winget with timeout
    $runWingetWithTimeout = {
        param($PackageId, $Source, $TimeoutSeconds)

        $job = Start-Job -ScriptBlock {
            param($id, $src)
            $result = winget install --id $id --source $src --accept-source-agreements --accept-package-agreements --silent 2>&1
            @{ ExitCode = $LASTEXITCODE; Output = $result }
        } -ArgumentList $PackageId, $Source

        $completed = Wait-Job -Id $job.Id -Timeout $TimeoutSeconds

        if ($completed) {
            $jobResult = Receive-Job -Id $job.Id
            Remove-Job -Id $job.Id -Force
            return $jobResult
        } else {
            # Timeout - kill the job and any winget processes it spawned
            Stop-Job -Id $job.Id -ErrorAction SilentlyContinue
            Remove-Job -Id $job.Id -Force -ErrorAction SilentlyContinue
            # Kill any hanging winget processes
            Get-Process -Name "winget" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
            return @{ ExitCode = -1; Output = "Timeout after $TimeoutSeconds seconds"; TimedOut = $true }
        }
    }

    # Try winget source first
    if ($Script:HasWingetSource) {
        Write-Host "    Trying winget source (${TimeoutSeconds}s timeout)..." -ForegroundColor Gray
        $result = & $runWingetWithTimeout $PackageId "winget" $TimeoutSeconds

        if ($result.TimedOut) {
            Write-Host "    Winget timed out after ${TimeoutSeconds}s" -ForegroundColor Yellow
        } elseif ($result.ExitCode -eq 0) {
            Write-Status "$Name installed (winget)" "Success"
            & $completeLog "success"
            if (Get-Command Add-InstallResult -ErrorAction SilentlyContinue) {
                Add-InstallResult -PackageId $PackageId -Name $Name -Status 'succeeded' -Source 'winget'
            }
            return $true
        } else {
            Write-Host "    Winget source failed (exit code $($result.ExitCode))" -ForegroundColor Yellow

            # Source open failures (common on fresh installs) are usually fixed
            # by a source reset - try that once per run, then retry the install
            $sourceOpenFailure = "$($result.Output)" -match 'opening source'
            if ($sourceOpenFailure -and -not $Script:WingetSourceRecovered) {
                $Script:WingetSourceRecovered = $true
                Write-Host "    Resetting winget sources and retrying..." -ForegroundColor Yellow
                # winget outputs to stderr which triggers ErrorActionPreference=Stop
                # Temporarily allow stderr without throwing
                $prevEAP = $ErrorActionPreference
                $ErrorActionPreference = "Continue"
                try {
                    winget source reset --force 2>&1 | Out-Null
                    winget source update 2>&1 | Out-Null
                } finally {
                    $ErrorActionPreference = $prevEAP
                }

                $result = & $runWingetWithTimeout $PackageId "winget" $TimeoutSeconds
                if (-not $result.TimedOut -and $result.ExitCode -eq 0) {
                    Write-Status "$Name installed (winget after source reset)" "Success"
                    & $completeLog "success"
                    if (Get-Command Add-InstallResult -ErrorAction SilentlyContinue) {
                        Add-InstallResult -PackageId $PackageId -Name $Name -Status 'succeeded' -Source 'winget'
                    }
                    return $true
                }
                Write-Host "    Retry after source reset failed (exit code $($result.ExitCode))" -ForegroundColor Yellow
            }
        }
    }

    # Fallback to msstore
    if ($Script:HasMsStoreSource) {
        Write-Host "    Falling back to msstore (${TimeoutSeconds}s timeout)..." -ForegroundColor Yellow
        $result = & $runWingetWithTimeout $PackageId "msstore" $TimeoutSeconds

        if ($result.TimedOut) {
            Write-Host "    msstore timed out after ${TimeoutSeconds}s" -ForegroundColor Red
        } elseif ($result.ExitCode -eq 0) {
            Write-Status "$Name installed (msstore fallback)" "Success"
            & $completeLog "success"
            if (Get-Command Add-InstallResult -ErrorAction SilentlyContinue) {
                Add-InstallResult -PackageId $PackageId -Name $Name -Status 'succeeded' -Source 'msstore'
            }
            return $true
        } else {
            Write-Host "    msstore also failed (exit code $($result.ExitCode))" -ForegroundColor Red
        }
    }

    # Both sources failed - show error details
    Write-Status "Failed to install $Name from all sources" "Warning"
    if ($result.Output -and -not $result.TimedOut) {
        $errorLines = $result.Output | Where-Object { $_ -match "error|fail|not found|applicable" } | Select-Object -First 3
        foreach ($line in $errorLines) {
            Write-Host "    $line" -ForegroundColor Yellow
        }
    }
    if (Get-Command Add-InstallResult -ErrorAction SilentlyContinue) {
        Add-InstallResult -PackageId $PackageId -Name $Name -Status 'failed' -Source '' -Message 'all sources failed or timed out'
    }
    & $completeLog "failed"
    return $false
}

function Get-GitHubLatestRelease {
    <#
    .SYNOPSIS
        Fetches the latest release tag and one matching asset for a GitHub repo.
    .DESCRIPTION
        Returns $null on API failure or when no asset matches - callers fall
        back to a manual-install message rather than failing the run.
    #>
    param(
        [Parameter(Mandatory)][string]$Repo,
        [string]$AssetPattern = "*"
    )

    try {
        $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -Headers @{ 'User-Agent' = 'bootible' } -ErrorAction Stop
    } catch {
        return $null
    }

    $asset = $release.assets | Where-Object { $_.name -like $AssetPattern } | Select-Object -First 1
    if (-not $asset) {
        return $null
    }

    return [pscustomobject]@{
        Tag         = $release.tag_name
        AssetName   = $asset.name
        DownloadUrl = $asset.browser_download_url
        Size        = $asset.size
        Digest      = $asset.digest  # "sha256:<hex>" when GitHub provides it; $null otherwise
    }
}
