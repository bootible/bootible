#Requires -Modules Pester

<#
.SYNOPSIS
    Guards against references to the legacy private repo layout.

.DESCRIPTION
    The private repo uses the device-instance layout:
      private/device/<device>/<Instance>/config.yml
      private/scripts/            (shared scripts)
      private/ssh-keys/           (public keys)
    The only place allowed to reference the legacy flat layout
    (private/<device>/...) is the explicit fallback in
    Find-PrivateDeviceConfigs. Anything else is a stale path that will
    silently miss private content at run time.
#>

Describe "Private repo layout references" {
    It "No ROG Ally script references the legacy private/rog-ally layout" {
        $scriptFiles = Get-ChildItem -Path (Join-Path $PSScriptRoot "../config/rog-ally") -Filter "*.ps1" -Recurse -File
        $offenders = @()
        foreach ($file in $scriptFiles) {
            $hits = Select-String -Path $file.FullName -Pattern 'private[\\/]+rog-ally' -AllMatches
            foreach ($hit in $hits) {
                $offenders += "$($file.Name):$($hit.LineNumber)"
            }
        }
        $offenders -join ", " | Should -BeNullOrEmpty
    }

    It "No bootstrap target references the legacy private device layout" {
        $allyTarget = Join-Path $PSScriptRoot "../targets/ally.ps1"
        $hits = Select-String -Path $allyTarget -Pattern 'private[\\/]+(rog-ally|steamdeck)[\\/]' -AllMatches
        @($hits).Count | Should -Be 0
    }
}
