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
  // "launcher": runstrip.bat runs user-installs.ps1 in its non-elevated session
  // straight after the elevated strip (no reboot). "runonce": the bootstrap runs
  // at first logon with no such sibling, so defer to RunOnce at next sign-in.
  deferVia: "launcher" | "runonce" = "runonce",
): string {
  if (commands.length === 0) return "";
  const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
  // Drop the leading 'winget','install' — keep the args for splatting.
  const arrays = commands.map((c) => `  ,@(${c.slice(2).map(q).join(", ")})`).join("\n");
  return `# App installs: elevated first (machine-scope land). Anything that rejects an
# admin context (user-scope installers like Spotify, winget exit 0x8a150046) is
# written to user-installs.ps1 and run NON-elevated — by runstrip.bat in this
# session (no reboot), or via RunOnce at next sign-in for the first-logon bootstrap.
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
  # Sweep desktop icons these installers dumped (against the pre-install snapshot).
  $rLines += '$keep = @(Get-Content "$env:SystemDrive\\bootible\\desktop-keep.txt" -ErrorAction SilentlyContinue)'
  $rLines += 'foreach ($d in @("$env:PUBLIC\\Desktop","$env:USERPROFILE\\Desktop")) { Get-ChildItem "$d\\*.lnk" -ErrorAction SilentlyContinue | Where-Object { $keep -notcontains $_.FullName } | Remove-Item -Force -ErrorAction SilentlyContinue }'
  Set-Content -Path $rScript -Value $rLines -Encoding ascii
${
  deferVia === "runonce"
    ? `  $runCmd = 'powershell -NoProfile -ExecutionPolicy Bypass -File "' + $rScript + '"'
  New-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce' -Name 'BootibleUserInstall' -Value $runCmd -PropertyType String -Force | Out-Null
  ${logFn} "$($bootRetry.Count) user-scope app(s) will finish installing at your next sign-in (sign out/in or reboot)"`
    : `  ${logFn} "$($bootRetry.Count) user-scope app(s) queued -- runstrip.bat finishes them in your session (no reboot)"`
}
}`;
}

/**
 * Emit a PowerShell block that updates App Installer (winget) to the latest from
 * https://aka.ms/getwinget via DISM provisioning. A factory image ships an old
 * winget whose pinned Store cert can be stale (msstore error 0x8a15005e); this
 * fixes the Store source. Run elevated, before any msstore installs. ~216 MB, so
 * callers should gate it on "an msstore app is actually selected".
 */
export function generateAppInstallerUpdate(logFn = "Write-Strip"): string {
  return `# Store apps need a current App Installer — the factory winget's pinned cert can
# be stale (msstore error 0x8a15005e). Update it before installing Store apps.
${logFn} 'updating App Installer (winget) so the Microsoft Store source works...'
try {
  $wgTmp = Join-Path $env:TEMP 'bootible-winget.msixbundle'
  Invoke-WebRequest -Uri 'https://aka.ms/getwinget' -OutFile $wgTmp -UseBasicParsing
  Add-AppxProvisionedPackage -Online -PackagePath $wgTmp -SkipLicense -ErrorAction Stop | Out-Null
  Remove-Item $wgTmp -ErrorAction SilentlyContinue
  ${logFn} "App Installer updated ($(winget --version 2>$null))"
} catch { ${logFn} "  App Installer update failed (Store apps may not install): $_" }`;
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
