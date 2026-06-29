/**
 * Install Windows apps that aren't on winget or the Store, from their GitHub
 * releases (e.g. Greenlight). Emits a PowerShell block that — run elevated in the
 * device script (strip/bootstrap) — resolves each app's latest release, downloads
 * the asset matching its pattern, and queues the silent install to run in the
 * USER session at next sign-in (these are per-user electron installers, so they
 * must not run in the admin context — the same reason winget user-scope apps defer).
 */
export interface GithubReleaseApp {
  /** App slug (used for the downloaded filename + log lines). */
  id: string;
  /** "owner/repo". */
  repo: string;
  /** Regex (string) matched against release asset names. */
  assetPattern: string;
  /** Silent-install args for the downloaded installer (e.g. "/S"). */
  silentArgs: string;
}

export function generateGithubReleaseInstall(
  apps: GithubReleaseApp[],
  rootExpr: string,
  logFn = "Write-Bootible",
): string {
  if (apps.length === 0) return "";
  const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
  const entries = apps
    .map(
      (a) =>
        `  @{ id=${q(a.id)}; repo=${q(a.repo)}; pattern=${q(a.assetPattern)}; args=${q(a.silentArgs)} }`,
    )
    .join("\n");
  return `# GitHub-release app installs (not on winget/Store): download the latest matching
# asset now (elevated), then run each silent installer in the USER session at next
# sign-in — they're per-user electron installers that mustn't run as admin.
$ghApps = @(
${entries}
)
$ghRoot = ${rootExpr}
$ghLog = Join-Path $ghRoot 'github-installs.log'
$ghLines = @()
foreach ($g in $ghApps) {
  ${logFn} "fetching $($g.id) from github.com/$($g.repo)"
  try {
    $rel = Invoke-RestMethod -Uri "https://api.github.com/repos/$($g.repo)/releases/latest" -Headers @{ 'User-Agent' = 'bootible' } -UseBasicParsing
    $asset = $rel.assets | Where-Object { $_.name -match $g.pattern } | Select-Object -First 1
    if (-not $asset) { ${logFn} "  no asset matched $($g.pattern)"; continue }
    $dest = Join-Path $ghRoot ($g.id + '-setup.exe')
    Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $dest -UseBasicParsing
    $ghLines += ('& "' + $dest + '" ' + $g.args + ' | Out-Null; "' + $g.id + ' exit $LASTEXITCODE" | Add-Content "' + $ghLog + '"')
  } catch { ${logFn} "  $($g.id) download failed: $_" }
}
if ($ghLines.Count -gt 0) {
  $ghScript = Join-Path $ghRoot 'github-installs.ps1'
  Set-Content -Path $ghScript -Value $ghLines -Encoding ascii
  $ghCmd = 'powershell -NoProfile -ExecutionPolicy Bypass -File "' + $ghScript + '"'
  New-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce' -Name 'BootibleGithubInstall' -Value $ghCmd -PropertyType String -Force | Out-Null
  ${logFn} "$($ghLines.Count) GitHub app(s) install at your next sign-in"
}`;
}
