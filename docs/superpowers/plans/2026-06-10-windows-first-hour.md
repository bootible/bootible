# bootible v1.0 — Windows First Hour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gap between bootible and the community's manual Windows-handheld checklist (hibernate, G-Helper, SAC awareness, on-device receipt, drift repair), then ship it as a tagged v1.0 served by the one-liner.

**Architecture:** All features land in the existing ROG Ally pipeline: pure decision logic in `config/rog-ally/lib/*.ps1` (unit-testable on Linux), thin execution in `config/rog-ally/modules/*.ps1` (dot-sourced by Run.ps1, share script scope), config keys validated by `Validate-ConfigSchema` in Run.ps1. Release channel logic lives in the Cloudflare worker + a version constant in `targets/ally.ps1`.

**Tech Stack:** PowerShell 5.1-compatible scripts, Pester 5.6.1 (run via `~/bin/pwsh -NoProfile -c 'Invoke-Pester -Path ./tests/'` from `bootible/`), PSScriptAnalyzer (CI fails on Error severity), Cloudflare Worker (JS), GitHub Actions.

**House rules for every task:**
- Verify-gate: the commit hook needs a fresh stamp. Run the suite, then `touch .claude/.verified ../.claude/.verified`, then commit in a SEPARATE Bash call (the gate is PreToolUse).
- Commit messages must never contain "claude" or "anthropic"; no Co-Authored-By line.
- `git add` only the files you touched.
- Pure functions go in `lib/`, get dot-sourced by tests directly (see `tests/Run.Tests.ps1` BeforeAll for the pattern). Windows-only cmdlets must be behind injectable scriptblocks or mocked (see the `winget` stub in `tests/Install-WingetPackage.Tests.ps1`).

---

### Task 1: Power module — sleep → hibernate

**Files:**
- Create: `config/rog-ally/lib/power-helpers.ps1`
- Create: `config/rog-ally/modules/power.ps1`
- Create: `tests/PowerHelpers.Tests.ps1`
- Modify: `config/rog-ally/Run.ps1` (schema map ~line 575-650 area; `$moduleOrder` list ~line 1270)
- Modify: `config/rog-ally/config.yml` (new keys, default off)

- [ ] **Step 1: Write the failing tests**

```powershell
#Requires -Modules Pester

BeforeAll {
    $helpersPath = Join-Path $PSScriptRoot "../config/rog-ally/lib/power-helpers.ps1"
    . $helpersPath
}

Describe "Get-PowerConfigCommands" {
    It "Returns no commands for default config" {
        $result = @(Get-PowerConfigCommands -SleepMode "default" -HibernateAfterMinutes 0 -PowerButtonAction "")
        $result.Count | Should -Be 0
    }

    It "Enables hibernate and disables standby when sleep_mode is hibernate" {
        $result = @(Get-PowerConfigCommands -SleepMode "hibernate" -HibernateAfterMinutes 0 -PowerButtonAction "")
        ($result | ForEach-Object { $_ -join ' ' }) | Should -Contain "/hibernate on"
        ($result | ForEach-Object { $_ -join ' ' }) | Should -Contain "/change standby-timeout-ac 0"
        ($result | ForEach-Object { $_ -join ' ' }) | Should -Contain "/change standby-timeout-dc 0"
    }

    It "Adds hibernate timeouts when hibernate_after_minutes is set" {
        $result = @(Get-PowerConfigCommands -SleepMode "hibernate" -HibernateAfterMinutes 30 -PowerButtonAction "")
        ($result | ForEach-Object { $_ -join ' ' }) | Should -Contain "/change hibernate-timeout-ac 30"
        ($result | ForEach-Object { $_ -join ' ' }) | Should -Contain "/change hibernate-timeout-dc 30"
    }

    It "Maps power button to hibernate on AC and DC and activates the scheme" {
        $result = @(Get-PowerConfigCommands -SleepMode "default" -HibernateAfterMinutes 0 -PowerButtonAction "hibernate")
        ($result | ForEach-Object { $_ -join ' ' }) | Should -Contain "/setacvalueindex SCHEME_CURRENT SUB_BUTTONS PBUTTONACTION 2"
        ($result | ForEach-Object { $_ -join ' ' }) | Should -Contain "/setdcvalueindex SCHEME_CURRENT SUB_BUTTONS PBUTTONACTION 2"
        ($result | ForEach-Object { $_ -join ' ' })[-1] | Should -Be "/setactive SCHEME_CURRENT"
    }

    It "Maps sleep and shutdown button actions to powercfg indices 1 and 3" {
        $sleep = @(Get-PowerConfigCommands -SleepMode "default" -HibernateAfterMinutes 0 -PowerButtonAction "sleep")
        ($sleep | ForEach-Object { $_ -join ' ' }) | Should -Contain "/setacvalueindex SCHEME_CURRENT SUB_BUTTONS PBUTTONACTION 1"
        $shutdown = @(Get-PowerConfigCommands -SleepMode "default" -HibernateAfterMinutes 0 -PowerButtonAction "shutdown")
        ($shutdown | ForEach-Object { $_ -join ' ' }) | Should -Contain "/setacvalueindex SCHEME_CURRENT SUB_BUTTONS PBUTTONACTION 3"
    }
}
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `~/bin/pwsh -NoProfile -c 'Invoke-Pester -Path ./tests/PowerHelpers.Tests.ps1 -Output Detailed'`
Expected: all 5 fail with `CommandNotFoundException: Get-PowerConfigCommands`

- [ ] **Step 3: Implement `lib/power-helpers.ps1`**

```powershell
# Bootible Power Helpers
# ======================
# Pure functions producing powercfg argument lists. No side effects.

function Get-PowerConfigCommands {
    <#
    .SYNOPSIS
        Builds the list of powercfg argument arrays for the requested power config.
    .DESCRIPTION
        Returns an array of string arrays; each inner array is one powercfg invocation.
        PBUTTONACTION indices: 0=do nothing, 1=sleep, 2=hibernate, 3=shut down.
    #>
    param(
        [string]$SleepMode = "default",
        [int]$HibernateAfterMinutes = 0,
        [string]$PowerButtonAction = ""
    )

    $commands = @()

    if ($SleepMode -eq "hibernate") {
        $commands += ,@("/hibernate", "on")
        $commands += ,@("/change", "standby-timeout-ac", "0")
        $commands += ,@("/change", "standby-timeout-dc", "0")
        if ($HibernateAfterMinutes -gt 0) {
            $commands += ,@("/change", "hibernate-timeout-ac", "$HibernateAfterMinutes")
            $commands += ,@("/change", "hibernate-timeout-dc", "$HibernateAfterMinutes")
        }
    }

    $buttonIndex = switch ($PowerButtonAction) {
        "sleep"     { "1" }
        "hibernate" { "2" }
        "shutdown"  { "3" }
        default     { $null }
    }
    if ($buttonIndex) {
        $commands += ,@("/setacvalueindex", "SCHEME_CURRENT", "SUB_BUTTONS", "PBUTTONACTION", $buttonIndex)
        $commands += ,@("/setdcvalueindex", "SCHEME_CURRENT", "SUB_BUTTONS", "PBUTTONACTION", $buttonIndex)
        $commands += ,@("/setactive", "SCHEME_CURRENT")
    }

    return ,$commands
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `~/bin/pwsh -NoProfile -c 'Invoke-Pester -Path ./tests/PowerHelpers.Tests.ps1'`
Expected: `Tests Passed: 5, Failed: 0`

- [ ] **Step 5: Create `modules/power.ps1`**

Follow the existing module style (see `modules/streaming.ps1` for a small example — header comment, `Get-ConfigValue` reads, `Write-Status`, `$Script:DryRun` guard):

```powershell
# Power Module
# ============
# Sleep -> hibernate conversion for handhelds. Modern Standby drains
# 10-23% battery in 12h on Ally-class devices; hibernate does not.
# Firmware-level Modern Standby behavior (S0 wake sources) is NOT
# controllable from here - this module changes what Windows does on
# idle, lid, and power-button events.

$sleepMode = Get-ConfigValue "sleep_mode" "default"
$hibernateAfter = Get-ConfigValue "hibernate_after_minutes" 0
$buttonAction = Get-ConfigValue "power_button_action" ""

$commands = @(Get-PowerConfigCommands -SleepMode $sleepMode -HibernateAfterMinutes $hibernateAfter -PowerButtonAction $buttonAction)

if ($commands.Count -eq 0) {
    Write-Status "Power settings unchanged (sleep_mode: default)" "Info"
    return
}

if ($Script:DryRun) {
    foreach ($cmd in $commands) {
        Write-Status "[DRY RUN] Would run: powercfg $($cmd -join ' ')" "Info"
    }
    return
}

Write-Status "Applying power configuration (sleep_mode: $sleepMode)..." "Info"
foreach ($cmd in $commands) {
    & powercfg @cmd | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Status "powercfg $($cmd -join ' ') failed (exit $LASTEXITCODE)" "Warning"
    }
}
Write-Status "Power configuration applied" "Success"
```

Note: `power-helpers.ps1` must be dot-sourced by Run.ps1 alongside the other lib files — add next to the existing `lib/helpers.ps1` import near the top of Run.ps1:

```powershell
$powerHelpersPath = Join-Path $PSScriptRoot "lib/power-helpers.ps1"
if (Test-Path $powerHelpersPath) {
    . $powerHelpersPath
}
```

- [ ] **Step 6: Register schema keys and module order in Run.ps1**

In the `Validate-ConfigSchema` key map (the hashtable containing `'wallpaper_path' = 'string'` etc.), add:

```powershell
        'sleep_mode' = 'enum:default,hibernate'
        'hibernate_after_minutes' = 'int'
        'power_button_action' = 'enum:,sleep,hibernate,shutdown'
```

(Confirm the enum syntax against the existing `'wallpaper_style' = 'enum:Fill,Fit,...'` entry and how empty values are treated; if empty string isn't valid in the enum validator, validate only when non-empty by using `'string'` and let the helper ignore unknown values — match whichever pattern the validator actually supports.)

In `$moduleOrder`, insert `"power"` after `"optimization"`, before `"debloat"`:

```powershell
    "optimization",
    "power",          # Sleep -> hibernate; after optimization, before debloat
    "debloat"
```

- [ ] **Step 7: Add defaults to `config/rog-ally/config.yml`**

Add a commented section near the other system settings:

```yaml
# Power & sleep
# Modern Standby drains battery; "hibernate" maps idle/power-button to hibernate instead.
sleep_mode: "default"             # default | hibernate
hibernate_after_minutes: 0        # 0 = system default timing
power_button_action: ""           # "" (unchanged) | sleep | hibernate | shutdown
```

- [ ] **Step 8: Full suite + lint, stamp, commit**

Run: `~/bin/pwsh -NoProfile -c 'Invoke-Pester -Path ./tests/'` — expect 42 passed, 0 failed.
Run: `~/bin/pwsh -NoProfile -c 'Invoke-ScriptAnalyzer -Path ./config/rog-ally/lib/power-helpers.ps1 -Severity Error; Invoke-ScriptAnalyzer -Path ./config/rog-ally/modules/power.ps1 -Severity Error'` — expect no output.
Then `touch .claude/.verified ../.claude/.verified`, and in a separate call:

```bash
git add config/rog-ally/lib/power-helpers.ps1 config/rog-ally/modules/power.ps1 tests/PowerHelpers.Tests.ps1 config/rog-ally/Run.ps1 config/rog-ally/config.yml
git commit -m "feat(rog-ally): power module - sleep to hibernate conversion"
```

---

### Task 2: G-Helper install

**Files:**
- Modify: `config/rog-ally/lib/winget-helpers.ps1` (add `Get-GitHubLatestRelease` — it sits with the other install plumbing)
- Modify: `config/rog-ally/modules/rog_ally.ps1` (new install block, near the MSI Afterburner block)
- Create: `tests/GitHubRelease.Tests.ps1`
- Modify: `config/rog-ally/Run.ps1` (schema key), `config/rog-ally/config.yml` (default)

- [ ] **Step 1: Write the failing tests**

```powershell
#Requires -Modules Pester

BeforeAll {
    $helpersPath = Join-Path $PSScriptRoot "../config/rog-ally/lib/winget-helpers.ps1"
    . $helpersPath
}

Describe "Get-GitHubLatestRelease" {
    It "Returns tag and matching asset details" {
        Mock Invoke-RestMethod {
            [pscustomobject]@{
                tag_name = "v0.254"
                assets = @(
                    [pscustomobject]@{ name = "GHelperSourceCode.zip"; browser_download_url = "https://example.com/src.zip"; size = 100 },
                    [pscustomobject]@{ name = "GHelper.zip"; browser_download_url = "https://example.com/GHelper.zip"; size = 5000000 }
                )
            }
        }

        $result = Get-GitHubLatestRelease -Repo "seerge/g-helper" -AssetPattern "GHelper.zip"

        $result.Tag | Should -Be "v0.254"
        $result.AssetName | Should -Be "GHelper.zip"
        $result.DownloadUrl | Should -Be "https://example.com/GHelper.zip"
        $result.Size | Should -Be 5000000
    }

    It "Returns null when no asset matches" {
        Mock Invoke-RestMethod {
            [pscustomobject]@{ tag_name = "v1"; assets = @([pscustomobject]@{ name = "other.txt"; browser_download_url = "u"; size = 1 }) }
        }

        $result = Get-GitHubLatestRelease -Repo "seerge/g-helper" -AssetPattern "GHelper.zip"

        $result | Should -BeNullOrEmpty
    }

    It "Returns null when the API call fails" {
        Mock Invoke-RestMethod { throw "rate limited" }

        $result = Get-GitHubLatestRelease -Repo "seerge/g-helper" -AssetPattern "GHelper.zip"

        $result | Should -BeNullOrEmpty
    }
}
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `~/bin/pwsh -NoProfile -c 'Invoke-Pester -Path ./tests/GitHubRelease.Tests.ps1 -Output Detailed'`
Expected: 3 failures, `CommandNotFoundException: Get-GitHubLatestRelease`

- [ ] **Step 3: Implement in `lib/winget-helpers.ps1`** (append after `Install-WingetPackage`)

```powershell
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
    }
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `~/bin/pwsh -NoProfile -c 'Invoke-Pester -Path ./tests/GitHubRelease.Tests.ps1'`
Expected: `Tests Passed: 3, Failed: 0`

- [ ] **Step 5: Add the install block to `modules/rog_ally.ps1`** (after the MSI Afterburner block)

First verify the real asset name: `curl -s https://api.github.com/repos/seerge/g-helper/releases/latest | grep '"name"'` — adjust `$assetPattern` below if it isn't `GHelper.zip`.

```powershell
if (Get-ConfigValue "install_ghelper" $false) {
    $gHelperDir = Join-Path $env:LOCALAPPDATA "GHelper"
    $gHelperExe = Join-Path $gHelperDir "GHelper.exe"

    if (Test-Path $gHelperExe) {
        Write-Status "G-Helper already installed - skipping" "Success"
    } elseif ($Script:DryRun) {
        Write-Status "[DRY RUN] Would install G-Helper (Armoury Crate alternative) from GitHub releases" "Info"
    } else {
        Write-Status "Installing G-Helper (lightweight Armoury Crate alternative)..." "Info"
        $release = Get-GitHubLatestRelease -Repo "seerge/g-helper" -AssetPattern "GHelper.zip"
        if (-not $release) {
            Write-Status "Could not resolve G-Helper release - install manually: https://github.com/seerge/g-helper/releases" "Warning"
        } else {
            $zipFile = Join-Path $env:TEMP $release.AssetName
            try {
                $ProgressPreference = 'SilentlyContinue'
                Invoke-WebRequest -Uri $release.DownloadUrl -OutFile $zipFile -UseBasicParsing -ErrorAction Stop
                $ProgressPreference = 'Continue'

                $downloaded = (Get-Item $zipFile).Length
                if ($downloaded -ne $release.Size) {
                    throw "Size mismatch: expected $($release.Size) bytes, got $downloaded"
                }

                New-Item -ItemType Directory -Path $gHelperDir -Force | Out-Null
                Expand-Archive -Path $zipFile -DestinationPath $gHelperDir -Force
                Remove-Item $zipFile -Force -ErrorAction SilentlyContinue

                if (Test-Path $gHelperExe) {
                    Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'GHelper' -Value "`"$gHelperExe`""
                    Write-Status "G-Helper $($release.Tag) installed (autostarts at login)" "Success"
                } else {
                    Write-Status "G-Helper archive extracted but GHelper.exe not found - check $gHelperDir" "Warning"
                }
            } catch {
                Write-Status "Failed to install G-Helper: $_" "Warning"
                Write-Status "Install manually: https://github.com/seerge/g-helper/releases" "Info"
            }
        }
    }
    Write-Status "G-Helper: TDP, fan curves, GPU modes without Armoury Crate" "Info"
}
```

- [ ] **Step 6: Schema key + default**

Run.ps1 `Validate-ConfigSchema` map: add `'install_ghelper' = 'bool'`.
`config/rog-ally/config.yml`, in the apps/tools section near `install_msi_afterburner`:

```yaml
# G-Helper - lightweight Armoury Crate alternative (TDP, fans, GPU modes)
install_ghelper: false
```

- [ ] **Step 7: Full suite + lint, stamp, commit**

Run suite (expect 45 passed) + `Invoke-ScriptAnalyzer -Path ./config/rog-ally/modules/rog_ally.ps1 -Severity Error` (no output). Stamp, then:

```bash
git add config/rog-ally/lib/winget-helpers.ps1 config/rog-ally/modules/rog_ally.ps1 tests/GitHubRelease.Tests.ps1 config/rog-ally/Run.ps1 config/rog-ally/config.yml
git commit -m "feat(rog-ally): optional G-Helper install from GitHub releases"
```

---

### Task 3: Smart App Control detection

**Files:**
- Modify: `config/rog-ally/lib/helpers.ps1` (add `Get-SmartAppControlState` — pure-ish, injectable reader)
- Modify: `config/rog-ally/modules/health.ps1` (surface the state in health checks)
- Modify: `config/rog-ally/modules/validate.ps1` (surface during dry-run validation)
- Create: `tests/SmartAppControl.Tests.ps1`

- [ ] **Step 1: Write the failing tests**

```powershell
#Requires -Modules Pester

BeforeAll {
    $helpersPath = Join-Path $PSScriptRoot "../config/rog-ally/lib/helpers.ps1"
    . $helpersPath
}

Describe "Get-SmartAppControlState" {
    It "Maps registry value 0 to off" {
        Get-SmartAppControlState -RegistryReader { 0 } | Should -Be "off"
    }

    It "Maps registry value 1 to on" {
        Get-SmartAppControlState -RegistryReader { 1 } | Should -Be "on"
    }

    It "Maps registry value 2 to evaluation" {
        Get-SmartAppControlState -RegistryReader { 2 } | Should -Be "evaluation"
    }

    It "Returns unknown when the registry read fails" {
        Get-SmartAppControlState -RegistryReader { throw "no such key" } | Should -Be "unknown"
    }

    It "Returns unknown for unrecognized values" {
        Get-SmartAppControlState -RegistryReader { 99 } | Should -Be "unknown"
    }
}
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `~/bin/pwsh -NoProfile -c 'Invoke-Pester -Path ./tests/SmartAppControl.Tests.ps1 -Output Detailed'`
Expected: 5 failures, `CommandNotFoundException: Get-SmartAppControlState`

- [ ] **Step 3: Implement in `lib/helpers.ps1`** (append)

```powershell
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
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `~/bin/pwsh -NoProfile -c 'Invoke-Pester -Path ./tests/SmartAppControl.Tests.ps1'`
Expected: `Tests Passed: 5, Failed: 0`

- [ ] **Step 5: Surface in `modules/validate.ps1` and `modules/health.ps1`**

Read both modules first to match their existing output style. Add to validate.ps1 (runs during dry-run):

```powershell
# Smart App Control breaks Armoury Crate components silently
$sacState = Get-SmartAppControlState
switch ($sacState) {
    "on" {
        Write-Status "Smart App Control is ON - it blocks Armoury Crate components (ROG Live Service, ACSetup)" "Warning"
        Write-Status "Turning SAC off is one-way (re-enabling requires a Windows reset). If you rely on Armoury Crate, see: Settings > Privacy & security > Windows Security > App & browser control" "Info"
    }
    "evaluation" {
        Write-Status "Smart App Control is in evaluation mode - it may switch ON by itself and break Armoury Crate" "Warning"
    }
    "off" {
        Write-Status "Smart App Control: off" "Success"
    }
    default {
        Write-Status "Smart App Control state could not be determined" "Info"
    }
}
```

Add the equivalent check to health.ps1's post-install checks using its existing pass/warn reporting helpers (read the file; it has its own check-result conventions — follow them, reporting "on"/"evaluation" as a warning with the same guidance text, "off" as pass).

- [ ] **Step 6: Full suite + lint, stamp, commit**

Suite (expect 50 passed), analyzer on the three modified files (no Errors). Stamp, then:

```bash
git add config/rog-ally/lib/helpers.ps1 config/rog-ally/modules/validate.ps1 config/rog-ally/modules/health.ps1 tests/SmartAppControl.Tests.ps1
git commit -m "feat(rog-ally): detect Smart App Control and warn about Armoury Crate breakage"
```

---

### Task 4: On-device receipt + help file

**Files:**
- Create: `config/rog-ally/lib/receipt.ps1`
- Create: `config/rog-ally/files/receipt-faq.md`
- Create: `tests/Receipt.Tests.ps1`
- Modify: `config/rog-ally/Run.ps1` (dot-source lib; generate receipt after `Write-Summary` on real runs)

- [ ] **Step 1: Write the failing tests**

```powershell
#Requires -Modules Pester

BeforeAll {
    $receiptPath = Join-Path $PSScriptRoot "../config/rog-ally/lib/receipt.ps1"
    . $receiptPath
}

Describe "New-BootibleReceipt" {
    BeforeEach {
        # Shape matches Add-InstallResult in Run.ps1: Name, Status (lowercase), PackageId, Source, Message
        $script:results = @{
            Attempted = 5; Succeeded = 3; Failed = 1; Skipped = 1
            Packages = @(
                @{ Name = "Steam"; Status = "succeeded"; Source = "winget" },
                @{ Name = "Discord"; Status = "succeeded"; Source = "winget" },
                @{ Name = "G-Helper"; Status = "succeeded"; Source = "direct" },
                @{ Name = "VLC"; Status = "failed"; Message = "winget source failure" },
                @{ Name = "7-Zip"; Status = "skipped" }
            )
        }
        $script:changes = @("Hibernate enabled (sleep_mode: hibernate)", "Wallpaper applied", "SSH server enabled on port 22")
    }

    It "Includes instance name and version in the header" {
        $md = New-BootibleReceipt -InstanceName "Vengeance" -Version "1.0.0" -InstallResults $results -AppliedChanges $changes -FaqText "## FAQ"
        $md | Should -Match "Vengeance"
        $md | Should -Match "1\.0\.0"
    }

    It "Lists installed, failed, and skipped packages with their status" {
        $md = New-BootibleReceipt -InstanceName "V" -Version "1.0.0" -InstallResults $results -AppliedChanges $changes -FaqText "## FAQ"
        $md | Should -Match "Steam"
        $md | Should -Match "VLC.*failed.*winget source failure"
        $md | Should -Match "7-Zip"
    }

    It "Lists applied configuration changes" {
        $md = New-BootibleReceipt -InstanceName "V" -Version "1.0.0" -InstallResults $results -AppliedChanges $changes -FaqText "## FAQ"
        $md | Should -Match "Hibernate enabled"
        $md | Should -Match "SSH server enabled"
    }

    It "Appends the FAQ text verbatim" {
        $md = New-BootibleReceipt -InstanceName "V" -Version "1.0.0" -InstallResults $results -AppliedChanges $changes -FaqText "## FAQ`nSAC guidance here"
        $md | Should -Match "SAC guidance here"
    }

    It "Handles empty results without throwing" {
        $empty = @{ Attempted = 0; Succeeded = 0; Failed = 0; Skipped = 0; Packages = @() }
        $md = New-BootibleReceipt -InstanceName "V" -Version "dev" -InstallResults $empty -AppliedChanges @() -FaqText ""
        $md | Should -Match "bootible"
    }
}
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `~/bin/pwsh -NoProfile -c 'Invoke-Pester -Path ./tests/Receipt.Tests.ps1 -Output Detailed'`
Expected: 5 failures, `CommandNotFoundException: New-BootibleReceipt`

- [ ] **Step 3: Implement `lib/receipt.ps1`**

```powershell
# Bootible Receipt
# ================
# Pure markdown generation for the on-device "what did bootible do" file.

function New-BootibleReceipt {
    <#
    .SYNOPSIS
        Builds the markdown receipt written to the device Desktop after a real run.
    #>
    param(
        [Parameter(Mandatory)][string]$InstanceName,
        [Parameter(Mandatory)][string]$Version,
        [Parameter(Mandatory)][hashtable]$InstallResults,
        [string[]]$AppliedChanges = @(),
        [string]$FaqText = ""
    )

    $lines = @()
    $lines += "# Your device was set up by bootible"
    $lines += ""
    $lines += "- **Configuration:** $InstanceName"
    $lines += "- **bootible version:** $Version"
    $lines += "- **Run completed:** $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    $lines += ""
    $lines += "Re-running is always safe: open PowerShell and type ``bootible``. It re-applies your configuration and repairs anything Windows Update broke."
    $lines += ""

    $lines += "## Apps"
    $lines += ""
    $lines += "Attempted: $($InstallResults.Attempted) | Installed: $($InstallResults.Succeeded) | Skipped (already present): $($InstallResults.Skipped) | Failed: $($InstallResults.Failed)"
    $lines += ""
    foreach ($pkg in $InstallResults.Packages) {
        $suffix = if ($pkg.Message) { " — $($pkg.Message)" } else { "" }
        $lines += "- **$($pkg.Name)**: $($pkg.Status)$suffix"
    }
    $lines += ""

    if ($AppliedChanges.Count -gt 0) {
        $lines += "## Configuration changes"
        $lines += ""
        foreach ($change in $AppliedChanges) {
            $lines += "- $change"
        }
        $lines += ""
    }

    if ($FaqText) {
        $lines += $FaqText
        $lines += ""
    }

    return ($lines -join "`n")
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `~/bin/pwsh -NoProfile -c 'Invoke-Pester -Path ./tests/Receipt.Tests.ps1'`
Expected: `Tests Passed: 5, Failed: 0`

- [ ] **Step 5: Write the FAQ template `config/rog-ally/files/receipt-faq.md`**

```markdown
## If something looks broken

### Armoury Crate stopped working / parts of it won't start
Windows **Smart App Control** blocks Armoury Crate components (ROG Live Service, ACSetup). Check it under
Settings → Privacy & security → Windows Security → App & browser control.
Heads-up: turning Smart App Control off is **one-way** — re-enabling it requires resetting Windows.
Most Ally owners use **G-Helper** instead (bootible can install it: `install_ghelper: true`).

### An app failed to install
Usually a winget source hiccup. Open PowerShell and run:

    winget source reset --force
    winget source update
    bootible

bootible retries this automatically once per run, but sources can stay flaky on fresh installs.

### My device sleeps and the battery dies anyway
If your config sets `sleep_mode: hibernate`, the power button and idle timeout hibernate instead of using
Modern Standby (which drains 10–23% in 12 hours on these devices). If battery still drains overnight,
check Settings → System → Power for anything resetting these — then just run `bootible` to re-apply.

### Windows Update broke my settings
This is normal, unfortunately — updates reinstall bloat, reset power settings, and occasionally downgrade
drivers. Run `bootible` again: it detects what drifted and re-applies your configuration.

### Where are the logs?
Each run writes a transcript into your private config repo under your device's `Logs/` folder, and it's
pushed automatically when possible.

## Help & links

- Docs & troubleshooting: https://docs.bootible.dev/reference/troubleshooting/
- Report a bug: https://github.com/bootible/bootible/issues
- Community Discord: https://discord.gg/bootible
```

- [ ] **Step 6: Wire into Run.ps1**

Dot-source next to the other lib imports at the top:

```powershell
$receiptLibPath = Join-Path $PSScriptRoot "lib/receipt.ps1"
if (Test-Path $receiptLibPath) {
    . $receiptLibPath
}
```

Collect applied changes: add a script-scope list near `$Script:InstallResults` initialization:

```powershell
$Script:AppliedChanges = [System.Collections.Generic.List[string]]::new()
```

Add an `Add-AppliedChange` helper next to `Add-InstallResult` (read Run.ps1 to find it):

```powershell
function Add-AppliedChange {
    param([string]$Description)
    if (-not $Script:DryRun) {
        $Script:AppliedChanges.Add($Description)
    }
}
```

Then in each module that changes system state, record one line at the point of success — minimum set for this task: power.ps1 (`Add-AppliedChange "Hibernate enabled (sleep_mode: hibernate)"` and the button action), rog_ally.ps1 G-Helper block (`Add-AppliedChange "G-Helper $($release.Tag) installed (autostart at login)"`), debloat.ps1 wallpaper/lockscreen success paths, ssh.ps1 server-enable success path. Guard each call with `if (Get-Command Add-AppliedChange -ErrorAction SilentlyContinue)` is NOT needed — modules are dot-sourced into Run.ps1's scope where the function exists.

After `Write-Summary` is called at the end of the run (find the call near the transcript-stop/log-push section), add:

```powershell
# Write the on-device receipt (real runs only)
if (-not $Script:DryRun -and (Get-Command New-BootibleReceipt -ErrorAction SilentlyContinue)) {
    try {
        $faqPath = Join-Path $Script:DeviceRoot "files\receipt-faq.md"
        $faqText = if (Test-Path $faqPath) { Get-Content $faqPath -Raw } else { "" }
        $instanceLabel = if ($Script:SelectedInstance) { $Script:SelectedInstance } else { "default" }
        $receipt = New-BootibleReceipt -InstanceName $instanceLabel -Version $Script:BootibleVersion `
            -InstallResults $Script:InstallResults -AppliedChanges @($Script:AppliedChanges) -FaqText $faqText
        $desktopPath = [Environment]::GetFolderPath('Desktop')
        Set-Content -Path (Join-Path $desktopPath "Bootible - Read Me.md") -Value $receipt -Encoding UTF8
        Write-Status "Receipt written to Desktop: Bootible - Read Me.md" "Success"
    } catch {
        Write-Status "Could not write Desktop receipt: $_" "Warning"
    }
}
```

`$Script:BootibleVersion` does not exist yet — define it near the root vars at the top of Run.ps1 (Task 7 makes releases bump it):

```powershell
$Script:BootibleVersion = "main"
```

- [ ] **Step 7: Full suite + lint, stamp, commit**

Suite (expect 55 passed), analyzer on receipt.ps1 + Run.ps1 (no NEW Errors — Run.ps1's pre-existing Write-Host warnings are accepted style). Stamp, then:

```bash
git add config/rog-ally/lib/receipt.ps1 config/rog-ally/files/receipt-faq.md tests/Receipt.Tests.ps1 config/rog-ally/Run.ps1 config/rog-ally/modules/power.ps1 config/rog-ally/modules/rog_ally.ps1 config/rog-ally/modules/debloat.ps1 config/rog-ally/modules/ssh.ps1
git commit -m "feat(rog-ally): write setup receipt and FAQ to the device Desktop"
```

---

### Task 5: Checklist parity audit

**Files:**
- Create: `docs/checklist-parity.md`

This is an audit + documentation task. The community checklist items, converged from the sources in `docs/research/handheld-community-landscape.md` (XDA starter guide, HowToGeek 20 tips, baldsealion guide, ASUS official):

1. Debloat Windows (remove preinstalled apps/ads)
2. Switch sleep to hibernate
3. Install G-Helper (Armoury Crate alternative)
4. Configure TDP / performance profiles
5. Disable CPU boost for battery
6. Set display refresh rate
7. Configure HDR
8. Install game launchers (Steam, Epic, GOG, etc.)
9. Install streaming clients (Moonlight/Chiaki)
10. Set up emulation (EmuDeck)
11. Enable Storage Sense / free disk space
12. Privacy/telemetry tweaks
13. Update GPU drivers + pause/guard Windows Update regressions
14. Remote access (SSH/Tailscale/RDP)

- [ ] **Step 1: Audit each item against the config**

For each item, find the covering config key(s): `grep -n "install_\|configure_\|disable_\|enable_\|set_" config/rog-ally/config.yml` and check `Validate-ConfigSchema` in Run.ps1. Items 2 and 3 are covered by Tasks 1–2 of this plan.

- [ ] **Step 2: Write `docs/checklist-parity.md`**

A table: `| Checklist item | bootible coverage | Config key(s) | Notes |`. Every item gets a row. For uncovered items, the coverage cell says **Not covered** with a one-line rationale (e.g. "TDP profiles: owned by G-Helper/Armoury Crate at runtime — bootible installs the tool, doesn't manage live profiles" — that's a rationale, not a gap). If the audit reveals a *small* genuine gap (a missing bool config key wiring an existing module capability), implement it in this task using the established pattern (schema key + config.yml default + module block + Pester test if there's pure logic); if it's a large gap, list it in a "Deferred" section at the bottom of the doc instead of implementing.

- [ ] **Step 3: Suite + stamp + commit**

```bash
git add docs/checklist-parity.md
git commit -m "docs: community checklist parity table"
```

(Include any small gap implementations' files in the same add list, and mention them in the commit body.)

---

### Task 6: Update guard / repair (drift detection)

**Files:**
- Create: `config/rog-ally/lib/state-snapshot.ps1`
- Create: `tests/StateSnapshot.Tests.ps1`
- Modify: `config/rog-ally/Run.ps1` (dot-source; drift report before modules; snapshot save after successful real run)

- [ ] **Step 1: Write the failing tests (pure diff + serialization round-trip)**

```powershell
#Requires -Modules Pester

BeforeAll {
    $snapshotPath = Join-Path $PSScriptRoot "../config/rog-ally/lib/state-snapshot.ps1"
    . $snapshotPath
}

Describe "Compare-StateSnapshot" {
    It "Returns empty when states match" {
        $expected = @{ hibernate_enabled = $true; wallpaper_hash = "abc"; gpu_driver = "31.0.24027" }
        $actual   = @{ hibernate_enabled = $true; wallpaper_hash = "abc"; gpu_driver = "31.0.24027" }
        @(Compare-StateSnapshot -Expected $expected -Actual $actual).Count | Should -Be 0
    }

    It "Reports each drifted key with expected and actual values" {
        $expected = @{ hibernate_enabled = $true; wallpaper_hash = "abc" }
        $actual   = @{ hibernate_enabled = $false; wallpaper_hash = "abc" }
        $drift = @(Compare-StateSnapshot -Expected $expected -Actual $actual)
        $drift.Count | Should -Be 1
        $drift[0].Key | Should -Be "hibernate_enabled"
        $drift[0].Expected | Should -Be $true
        $drift[0].Actual | Should -Be $false
    }

    It "Reports keys missing from actual state" {
        $drift = @(Compare-StateSnapshot -Expected @{ ssh_running = $true } -Actual @{})
        $drift.Count | Should -Be 1
        $drift[0].Actual | Should -BeNullOrEmpty
    }

    It "Ignores keys present only in actual (new state is not drift)" {
        @(Compare-StateSnapshot -Expected @{} -Actual @{ extra = 1 }).Count | Should -Be 0
    }
}

Describe "Snapshot serialization" {
    It "Round-trips a snapshot through JSON" {
        $snapshot = @{ hibernate_enabled = $true; gpu_driver = "31.0.24027"; packages = @("Steam", "Discord") }
        $file = Join-Path $TestDrive "state.json"

        Save-StateSnapshot -Snapshot $snapshot -Path $file
        $loaded = Read-StateSnapshot -Path $file

        $loaded.hibernate_enabled | Should -Be $true
        $loaded.gpu_driver | Should -Be "31.0.24027"
        @($loaded.packages).Count | Should -Be 2
    }

    It "Read returns null for a missing file" {
        Read-StateSnapshot -Path (Join-Path $TestDrive "missing.json") | Should -BeNullOrEmpty
    }
}
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `~/bin/pwsh -NoProfile -c 'Invoke-Pester -Path ./tests/StateSnapshot.Tests.ps1 -Output Detailed'`
Expected: 6 failures, functions not found

- [ ] **Step 3: Implement `lib/state-snapshot.ps1`**

```powershell
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

    $drift = @()
    foreach ($key in $Expected.Keys) {
        $expectedValue = $Expected[$key]
        $actualValue = if ($Actual.ContainsKey($key)) { $Actual[$key] } else { $null }
        if ("$expectedValue" -ne "$actualValue") {
            $drift += [pscustomobject]@{ Key = $key; Expected = $expectedValue; Actual = $actualValue }
        }
    }
    return ,$drift
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
        $json = Get-Content -Path $Path -Raw | ConvertFrom-Json
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
        $hibernateOut = (& powercfg /availablesleepstates) -join " "
        $state['hibernate_enabled'] = $hibernateOut -match 'Hibernate'
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
        $wallpaperPath = Get-ConfigValue "wallpaper_path" ""
        if ($wallpaperPath) {
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
```

Note: `Get-LiveState` is not unit-tested on Linux (Windows cmdlets) — keep it free of logic beyond probing; everything decision-shaped stays in `Compare-StateSnapshot`.

- [ ] **Step 4: Run tests, verify they pass**

Run: `~/bin/pwsh -NoProfile -c 'Invoke-Pester -Path ./tests/StateSnapshot.Tests.ps1'`
Expected: `Tests Passed: 6, Failed: 0`

- [ ] **Step 5: Wire into Run.ps1**

Dot-source with the other libs. Then, immediately BEFORE the module-execution loop (`foreach ($moduleName in $moduleOrder)`):

```powershell
# Drift report: compare live state against the last known-good snapshot
$Script:StateSnapshotPath = $null
if ($Script:SelectedInstance) {
    $Script:StateSnapshotPath = Join-Path $Script:PrivateRoot "device\rog-ally\$($Script:SelectedInstance)\state.json"
    $lastSnapshot = Read-StateSnapshot -Path $Script:StateSnapshotPath
    if ($lastSnapshot) {
        $live = Get-LiveState -Config $Script:Config
        $drift = @(Compare-StateSnapshot -Expected $lastSnapshot -Actual $live)
        if ($drift.Count -gt 0) {
            Write-Header "DRIFT DETECTED SINCE LAST RUN"
            foreach ($item in $drift) {
                Write-Status "$($item.Key): expected '$($item.Expected)', found '$($item.Actual)'" "Warning"
            }
            if ($drift.Key -contains 'gpu_driver') {
                Write-Status "GPU driver changed - bootible reports this but will NOT roll drivers back" "Info"
            }
            Write-Status "Modules below will re-apply your configuration" "Info"
        } else {
            Write-Status "No drift since last run" "Success"
        }
    }
}
```

And AFTER the module loop completes successfully, on real runs only (place next to the receipt write from Task 4):

```powershell
# Refresh the known-good snapshot
if (-not $Script:DryRun -and $Script:StateSnapshotPath) {
    try {
        Save-StateSnapshot -Snapshot (Get-LiveState -Config $Script:Config) -Path $Script:StateSnapshotPath
        Write-Status "State snapshot saved" "Success"
    } catch {
        Write-Status "Could not save state snapshot: $_" "Warning"
    }
}
```

Also add a drift line to the receipt: in the receipt block, pass drift info by appending to `$Script:AppliedChanges` when drift was repaired (in the drift-report block: `foreach ($item in $drift) { Add-AppliedChange "Repaired drift: $($item.Key)" }` — add after the Write-Status loop, guarded by `-not $Script:DryRun`).

- [ ] **Step 6: Full suite + lint, stamp, commit**

Suite (expect 61 passed), analyzer on state-snapshot.ps1 (no Errors). Stamp, then:

```bash
git add config/rog-ally/lib/state-snapshot.ps1 tests/StateSnapshot.Tests.ps1 config/rog-ally/Run.ps1
git commit -m "feat(rog-ally): drift detection and known-good state snapshots"
```

---

### Task 7: Release channel — one-liner serves tagged releases

**Files:**
- Modify: `cloudflare/_worker.js`
- Modify: `targets/ally.ps1` (version constant + checkout of own ref after clone, ~line 652 area)
- Modify: `config/rog-ally/Run.ps1` (`$Script:BootibleVersion` reads the same constant pattern)
- Create: `docs/releasing.md`

Pre-work: read `cloudflare/_worker.js` fully (605 lines) and `scripts/update-checksums.sh` + `.github/workflows/` checksum workflow to confirm exactly where checksums are computed and enforced before touching serving paths. The design below assumes the worker proxies `GITHUB_RAW_BASE` paths; adjust mechanically if the worker structure differs.

- [ ] **Step 1: Worker — resolve latest release tag with caching**

In `cloudflare/_worker.js`, add a helper and route logic:

```javascript
const RELEASE_API = 'https://api.github.com/repos/bootible/bootible/releases/latest';
const RELEASE_CACHE_TTL = 300; // seconds

async function resolveRef(pathname) {
  // /rog-beta, /deck-beta -> main; /rog, /deck -> latest release tag (fallback main)
  if (pathname.endsWith('-beta')) return 'main';
  try {
    const resp = await fetch(RELEASE_API, {
      headers: { 'User-Agent': 'bootible-worker' },
      cf: { cacheTtl: RELEASE_CACHE_TTL, cacheEverything: true },
    });
    if (!resp.ok) return 'main';
    const release = await resp.json();
    return release.tag_name || 'main';
  } catch {
    return 'main';
  }
}
```

Wherever the worker currently builds the raw GitHub URL from `GITHUB_RAW_BASE` (which pins `main`), thread the resolved ref through instead, and register the `-beta` route aliases for the existing script routes (`/rog`, `/deck`, `/droid` — confirm exact route names in the file).

- [ ] **Step 2: ally.ps1 — pin clone to its own ref**

Add near the top of `targets/ally.ps1`:

```powershell
# Updated by the release process; "main" on the beta channel
$Script:BootibleRef = "main"
```

At the clone/update step (~line 652, "Update existing - use git pull"), replace the plain pull with ref-aware logic:

```powershell
if ($Script:BootibleRef -eq "main") {
    git -C $BootibleDir pull --quiet origin main
} else {
    git -C $BootibleDir fetch --tags --quiet origin
    git -C $BootibleDir checkout --quiet $Script:BootibleRef
}
```

And after a fresh clone, the same checkout when `$Script:BootibleRef` is not "main".

- [ ] **Step 3: Run.ps1 version constant**

Change Task 4's placeholder to the same release-managed pattern:

```powershell
# Updated by the release process; "main" between releases
$Script:BootibleVersion = "main"
```

- [ ] **Step 4: Write `docs/releasing.md`** — the manual release procedure:

```markdown
# Releasing bootible

1. Ensure main is green (CI: Pester, PSScriptAnalyzer, checksums, lints).
2. Set the version constants for the tag:
   - `targets/ally.ps1`: `$Script:BootibleRef = "vX.Y.Z"`
   - `config/rog-ally/Run.ps1`: `$Script:BootibleVersion = "X.Y.Z"`
   Commit: `chore(release): vX.Y.Z`
3. Tag and push: `git tag vX.Y.Z && git push origin main vX.Y.Z`
4. Create the GitHub release with notes (`gh release create vX.Y.Z --generate-notes`).
5. Immediately follow up on main: set both constants back to "main".
   Commit: `chore: reopen main for development`
6. Verify: `irm https://bootible.dev/rog | iex` on a test machine reports the released version;
   `bootible.dev/rog-beta` still serves main.

The worker resolves the latest release via the GitHub API (5-minute cache) — no worker
deploy is needed per release.
```

- [ ] **Step 5: Verify worker locally if tooling exists, suite, stamp, commit**

There is no Pester coverage for the worker; validate JS syntax with `node --check cloudflare/_worker.js`. Run the PowerShell suite (count unchanged). Stamp, then:

```bash
git add cloudflare/_worker.js targets/ally.ps1 config/rog-ally/Run.ps1 docs/releasing.md
git commit -m "feat(release): serve tagged releases from the one-liner, beta channel on main"
```

Deploying the worker is a separate step — coordinate with Gavin (Cloudflare account rules apply: source ~/.secrets, account-scoped token).

---

### Task 8: Launch assets

**Files:**
- Modify: `README.md`
- Create: `docs/launch/reddit-rogally-post.md`
- Create: `docs/launch/creator-pitches.md`
- Modify: `docs-site/docs/index.md`

Nothing in this task is published — drafts live in-repo for Gavin's review and manual sending.

- [ ] **Step 1: Reposition README.md**

Reframe the opening around the research-validated story. Required elements: tagline "the missing first hour for Windows handhelds"; the three pains it kills (broken sleep, manual checklist, Windows Update breaking your setup — each phrased in user language); the one-liner front and center; the "re-run repairs" differentiator; the receipt screenshot placeholder (`docs-site/docs/assets/receipt-demo.png` — captured during the Vengeance RC run). Fix the contributor pointer: `docs/ai-context/` is gitignored, so point contributors at https://docs.bootible.dev and `docs/` instead.

- [ ] **Step 2: Draft `docs/launch/reddit-rogally-post.md`**

Structure (the executor writes full prose for each):
- Title options (3 variants), e.g. "I built a one-command setup for the Ally that survives Windows Updates — free + open source"
- Hook: the shared experience (the 10-step checklist everyone does, then Windows Update undoes it)
- What it does: one command → debloat, hibernate fix, G-Helper, your apps, receipt on the Desktop
- What makes it different: re-run repairs drift; config lives in YOUR repo; dry-run by default so you can see everything before it touches anything
- Honesty section: open source, MIT, what it does NOT do (no driver rollback, no Armoury Crate removal)
- Ask: feedback + what to support next
- Rules note: check r/ROGAlly self-promo rules before posting; flair appropriately

- [ ] **Step 3: Draft `docs/launch/creator-pitches.md`**

Two short pitches (rogallylife.com contact, ETA PRIME business email — look up current contact routes and note them in the doc):
- One-paragraph pitch each: what bootible is, why their audience cares (the checklist content they already make → now one command), offer of a demo/early access, link to repo + docs
- A "demo script" section: the 60-second screen recording flow (fresh Ally → one-liner → dry-run scroll → `bootible` → receipt on Desktop)

- [ ] **Step 4: Update docs-site landing (`docs-site/docs/index.md`)**

Align the hero copy with the README repositioning (same three pains, same differentiator). Keep mkdocs front-matter/structure intact.

- [ ] **Step 5: Suite + stamp + commit**

```bash
git add README.md docs/launch/reddit-rogally-post.md docs/launch/creator-pitches.md docs-site/docs/index.md
git commit -m "docs: launch positioning - README, post draft, creator pitches"
```

---

### Task 9: v1.0.0 release (GATED — do not execute until the Vengeance RC run passes)

**Gate:** The July Vengeance wipe+bootstrap (runbook: `gaming/docs/vengeance-refresh-2026-07.md`) must complete with: parity checklist green, receipt on Desktop, drift repair demonstrated (toggle hibernate off, re-run, watch it repair), EmuDeck EA detected.

- [ ] **Step 1: Capture the receipt screenshot + demo recording during the RC run** (assets for README/docs-site/launch)
- [ ] **Step 2: Follow `docs/releasing.md` to cut v1.0.0**
- [ ] **Step 3: Verify both channels** (`/rog` reports 1.0.0, `/rog-beta` reports main)
- [ ] **Step 4: Hand launch drafts to Gavin for review and manual posting**

---

## Self-review notes

- Spec coverage: power module (Task 1), G-Helper (2), SAC (3), receipt (4), parity audit (5), update guard (6), release engineering (7), launch plan (8), success-criteria gate (9). Covered.
- Test-count expectations (42/45/50/55/61) assume the suite starts at 37 and each task adds its stated tests; re-count at execution if intermediate tasks change.
- Task 7's worker steps depend on reading the actual `_worker.js` structure — the pre-work step makes that explicit rather than guessing routes.
