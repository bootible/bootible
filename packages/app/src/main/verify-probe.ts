/**
 * What Verify runs on a device over SSH, and how its exit status is read.
 * Pure, so the rules are unit-tested without spawning ssh.
 */

/** Remote command for the device's login shell. Linux (Deck): bash — read the
 *  provision receipt if present, then `uname -n` so a reachable Deck always
 *  prints something. Not `hostname`: SteamOS doesn't ship it, and the exit 127
 *  made a connected Deck look unreachable. Windows (ROG): cmd. */
export function verifyProbe(os: "windows" | "linux"): string {
  return os === "linux"
    ? "cat ~/.bootible/receipt 2>/dev/null; uname -n"
    : "type C:\\bootible\\status.txt 2>nul & echo. & type C:\\bootible\\receipt.txt 2>nul";
}

/** ssh exits 255 when it couldn't connect or authenticate; any other code is
 *  the remote command's own status, so we did reach the device. No status at
 *  all means a timeout or ssh failing to start. */
export function sshReachable(status: number | null | undefined): boolean {
  return typeof status === "number" && status !== 255;
}
