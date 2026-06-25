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
  return `# App installs: elevated first; retry admin-rejecting (user-scope) ones de-elevated.
$bootInstalls = @(
${arrays}
)
$bootRetry = @()
foreach ($a in $bootInstalls) {
  ${logFn} "install $($a -join ' ')"
  & winget install @a
  if ($LASTEXITCODE -ne 0) { ${logFn} "  elevated exit $LASTEXITCODE -- queueing de-elevated retry"; $bootRetry += ,$a }
}
if ($bootRetry.Count -gt 0) {
  ${logFn} "retrying $($bootRetry.Count) user-scope install(s) de-elevated (as $env:USERNAME)"
  $rScript = Join-Path (${rootExpr}) 'user-installs.ps1'
  $rLines = @('$env:PATH = "$env:LOCALAPPDATA\\Microsoft\\WindowsApps;$env:PATH"')
  foreach ($a in $bootRetry) { $rLines += ('winget install ' + ($a -join ' ')) }
  Set-Content -Path $rScript -Value $rLines -Encoding ascii
  try {
    $act = New-ScheduledTaskAction -Execute 'powershell' -Argument ('-NoProfile -ExecutionPolicy Bypass -File "' + $rScript + '"')
    $pri = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName 'bootible-userinstall' -Action $act -Principal $pri -Force | Out-Null
    Start-ScheduledTask -TaskName 'bootible-userinstall'
    $waited = 0
    do { Start-Sleep 5; $waited += 5 } while ((Get-ScheduledTask -TaskName 'bootible-userinstall' -ErrorAction SilentlyContinue).State -eq 'Running' -and $waited -lt 1800)
    Unregister-ScheduledTask -TaskName 'bootible-userinstall' -Confirm:$false -ErrorAction SilentlyContinue
    ${logFn} 'de-elevated installs done'
  } catch { ${logFn} "  de-elevated retry failed: $_" }
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
