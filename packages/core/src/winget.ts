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
    "--accept-source-agreements",
    "--accept-package-agreements",
    "--silent",
  ]);
}
