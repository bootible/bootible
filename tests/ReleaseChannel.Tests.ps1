#Requires -Modules Pester

# Regression guard: the release channel spans three files that must stay wired
# together — targets/ally.ps1 ($Script:BootibleRef, ref-aware clone/checkout),
# config/rog-ally/Run.ps1 ($Script:BootibleVersion), and cloudflare/_worker.js
# (resolveRef, '-beta' routes, per-channel sha256/sha256Stable checksums).
# These are text-level assertions in the RuntimeWiring style: they pin the
# wiring the release process (docs/releasing.md) depends on, not behavior.

BeforeAll {
    $script:AllyPs1Path = Join-Path $PSScriptRoot "../targets/ally.ps1"
    $script:RunPs1Path = Join-Path $PSScriptRoot "../config/rog-ally/Run.ps1"
    $script:WorkerJsPath = Join-Path $PSScriptRoot "../cloudflare/_worker.js"
}

Describe "Release channel wiring" {
    It "ally.ps1 defines `$Script:BootibleRef" {
        $hits = Select-String -Path $script:AllyPs1Path -Pattern '^\$Script:BootibleRef\s*='
        $hits | Should -Not -BeNullOrEmpty
    }

    It "ally.ps1 checks out `$Script:BootibleRef when not on main" {
        $hits = Select-String -Path $script:AllyPs1Path -Pattern '"checkout",\s*"--quiet",\s*\$Script:BootibleRef'
        $hits | Should -Not -BeNullOrEmpty
    }

    It "Run.ps1 defines `$Script:BootibleVersion" {
        $hits = Select-String -Path $script:RunPs1Path -Pattern '^\$Script:BootibleVersion\s*='
        $hits | Should -Not -BeNullOrEmpty
    }

    It "Worker defines the resolveRef release resolver" {
        $hits = Select-String -Path $script:WorkerJsPath -Pattern 'async function resolveRef'
        $hits | Should -Not -BeNullOrEmpty
    }

    It "Worker routes '-beta' to main" {
        $hits = Select-String -Path $script:WorkerJsPath -Pattern "endsWith\('-beta'\)"
        $hits | Should -Not -BeNullOrEmpty
    }

    It "Worker route <Route> carries both channel checksums" -ForEach @(
        @{ Route = '/rog' }
        @{ Route = '/deck' }
        @{ Route = '/android' }
    ) {
        $content = Get-Content -Path $script:WorkerJsPath -Raw
        $block = [regex]::Match($content, "'$Route':\s*\{[^}]*\}").Value
        $block | Should -Match "sha256: '[a-f0-9]{64}'"
        $block | Should -Match "sha256Stable: '[a-f0-9]{64}'"
    }

    It "Worker selects the checksum by the ref actually served" {
        $hits = Select-String -Path $script:WorkerJsPath -Pattern "ref === 'main' \? route\.sha256 : route\.sha256Stable"
        $hits | Should -Not -BeNullOrEmpty
    }
}
