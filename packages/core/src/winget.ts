/**
 * Build silent `winget install` command arrays for a set of package ids —
 * ported from the v1 Install-WingetPackage helper (config/rog-ally/lib). The
 * executor's injected runner decides whether they actually run.
 */
/**
 * Emit a PowerShell two-pass installer for a set of `winget install` command
 * arrays. Pass 1 runs each elevated (machine-scope apps land). Any that exit
 * non-zero — notably user-scope installers like Spotify, which reject an admin
 * context (winget exit 86) — are retried DE-ELEVATED via a one-shot scheduled
 * task at medium integrity in the logged-in user's session. Self-correcting: no
 * per-app scope metadata needed. `rootExpr` is a PS expression for the bootible
 * dir (e.g. "$Root"); `logFn` is the script's logger (Write-Strip / Write-Bootible).
 */
export function generateTwoPassInstall(
  commands: string[][],
  rootExpr: string,
  logFn = "Write-Strip",
): string {
  if (commands.length === 0) return "";
  const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
  // Drop the leading 'winget','install' — keep the args for splatting.
  const arrays = commands.map((c) => `  ,@(${c.slice(2).map(q).join(", ")})`).join("\n");
  return `# App installs: elevated first (machine-scope land). Anything that rejects an
# admin context (user-scope installers like Spotify, winget exit 0x8a150046) is
# deferred to the user's NEXT sign-in via RunOnce, where it installs in the
# interactive medium-integrity session that user-scope installers require.
$bootInstalls = @(
${arrays}
)
$bootOk = @(0, -1978335189) # success + "already installed" (0x8a15002b)
$bootRetry = @()
foreach ($a in $bootInstalls) {
  ${logFn} "install $($a -join ' ')"
  & winget install @a
  if ($bootOk -notcontains $LASTEXITCODE) { ${logFn} "  elevated exit $LASTEXITCODE -- deferring to next sign-in"; $bootRetry += ,$a }
}
if ($bootRetry.Count -gt 0) {
  $rRoot = ${rootExpr}
  $rScript = Join-Path $rRoot 'user-installs.ps1'
  $rLog = Join-Path $rRoot 'user-installs.log'
  $rLines = @()
  # The bare 'winget' App Execution Alias doesn't resolve in every context, so
  # resolve its real path; log each result for diagnosis.
  $rLines += '$wg = "$env:LOCALAPPDATA\\Microsoft\\WindowsApps\\winget.exe"'
  $rLines += 'if (-not (Test-Path $wg)) { $wg = (Get-Command winget.exe -ErrorAction SilentlyContinue).Source }'
  $rLines += ('"bootible user-scope installs $(Get-Date -Format o) as $(whoami)" | Set-Content "' + $rLog + '"')
  foreach ($a in $bootRetry) {
    $rLines += ('& $wg install ' + ($a -join ' ') + ' *>> "' + $rLog + '"')
    $rLines += ('"' + $a[1] + ' exit $LASTEXITCODE" | Add-Content "' + $rLog + '"')
  }
  Set-Content -Path $rScript -Value $rLines -Encoding ascii
  $runCmd = 'powershell -NoProfile -ExecutionPolicy Bypass -File "' + $rScript + '"'
  New-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce' -Name 'BootibleUserInstall' -Value $runCmd -PropertyType String -Force | Out-Null
  ${logFn} "$($bootRetry.Count) user-scope app(s) will finish installing at your next sign-in (sign out/in or reboot)"
}`;
}

export function getWingetInstallCommands(packageIds: string[]): string[][] {
  return packageIds.map((id) => [
    "winget",
    "install",
    "--id",
    id,
    // Pin to the winget source so a misconfigured/SSL-inspected msstore source
    // (corp networks: cert-pinning error 0x8a15005e) can't spam errors or fail
    // the install. Store-only apps opt back in with their own --source msstore.
    "--source",
    "winget",
    "--accept-source-agreements",
    "--accept-package-agreements",
    "--silent",
  ]);
}
