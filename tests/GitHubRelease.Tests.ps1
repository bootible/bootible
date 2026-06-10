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
                    [pscustomobject]@{ name = "GHelperSourceCode.zip"; browser_download_url = "https://example.com/src.zip"; size = 100; digest = "sha256:1111111111111111111111111111111111111111111111111111111111111111" },
                    [pscustomobject]@{ name = "GHelper.zip"; browser_download_url = "https://example.com/GHelper.zip"; size = 5000000; digest = "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" }
                )
            }
        }

        $result = Get-GitHubLatestRelease -Repo "seerge/g-helper" -AssetPattern "GHelper.zip"

        $result.Tag | Should -Be "v0.254"
        $result.AssetName | Should -Be "GHelper.zip"
        $result.DownloadUrl | Should -Be "https://example.com/GHelper.zip"
        $result.Size | Should -Be 5000000
        $result.Digest | Should -Be "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        Should -Invoke Invoke-RestMethod -ParameterFilter { $Uri -eq 'https://api.github.com/repos/seerge/g-helper/releases/latest' }
    }

    It "Surfaces a null digest when the asset has none" {
        Mock Invoke-RestMethod {
            [pscustomobject]@{
                tag_name = "v0.254"
                assets = @(
                    [pscustomobject]@{ name = "GHelper.zip"; browser_download_url = "https://example.com/GHelper.zip"; size = 5000000 }
                )
            }
        }

        $result = Get-GitHubLatestRelease -Repo "seerge/g-helper" -AssetPattern "GHelper.zip"

        $result.AssetName | Should -Be "GHelper.zip"
        $result.Digest | Should -BeNullOrEmpty
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
