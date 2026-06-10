#Requires -Modules Pester

# Regression guard: lib/winget-helpers.ps1 is the single runtime source of
# truth for Write-Status, Get-CurrentModuleName, Add-JsonLogEntry, and
# Install-WingetPackage. These functions were once duplicated inline in
# Run.ps1 and drifted in both directions (the lib's winget source-recovery
# block shipped as dead code because Run.ps1 never loaded the lib). This
# suite parses Run.ps1's text so the drift cannot recur silently.

BeforeAll {
    $script:RunPs1Path = Join-Path $PSScriptRoot "../config/rog-ally/Run.ps1"
}

Describe "Run.ps1 runtime wiring" {
    It "Resolves lib/winget-helpers.ps1 relative to the script root" {
        $hits = Select-String -Path $script:RunPs1Path -Pattern 'Join-Path \$PSScriptRoot "lib/winget-helpers\.ps1"'
        $hits | Should -Not -BeNullOrEmpty
    }

    It "Dot-sources the winget helpers path" {
        $hits = Select-String -Path $script:RunPs1Path -Pattern '^\s*\.\s+\$wingetHelpersPath'
        $hits | Should -Not -BeNullOrEmpty
    }

    It "Does not define <Name> inline" -ForEach @(
        @{ Name = 'Install-WingetPackage' }
        @{ Name = 'Write-Status' }
        @{ Name = 'Get-CurrentModuleName' }
        @{ Name = 'Add-JsonLogEntry' }
    ) {
        $hits = Select-String -Path $script:RunPs1Path -Pattern "^function $Name"
        $hits | Should -BeNullOrEmpty
    }
}
