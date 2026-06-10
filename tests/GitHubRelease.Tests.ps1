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
