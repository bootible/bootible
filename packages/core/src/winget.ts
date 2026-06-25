/**
 * Build silent `winget install` command arrays for a set of package ids —
 * ported from the v1 Install-WingetPackage helper (config/rog-ally/lib). The
 * executor's injected runner decides whether they actually run.
 */
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
