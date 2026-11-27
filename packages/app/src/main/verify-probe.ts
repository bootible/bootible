/**
 * What Verify runs on a device over SSH, and how its exit status is read.
 * Pure, so the rules are unit-tested without spawning ssh.
 */
import { MANIFEST_MARKER, manifestProbe, windowsProbeCommand } from "@bootible/core";

/** Remote command for the device's login shell. Linux (Deck): bash — read the
 *  provision receipt if present, then `uname -n` so a reachable Deck always
 *  prints something. Not `hostname`: SteamOS doesn't ship it, and the exit 127
 *  made a connected Deck look unreachable. Windows (ROG): cmd. Both then print
 *  the build manifest after a marker line, for the deep verify. */
export function verifyProbe(os: "windows" | "linux"): string {
  return os === "linux"
    ? `cat ~/.bootible/receipt 2>/dev/null; uname -n; echo ${MANIFEST_MARKER}; ${manifestProbe(os)}`
    : windowsProbeCommand(
        "Get-Content C:\\bootible\\status.txt -ErrorAction 0; ''; Get-Content C:\\bootible\\receipt.txt -ErrorAction 0",
      );
}

/** Split a probe's output into the receipt part (shown as-is) and the manifest text. */
export function splitProbe(output: string): { receipt: string; manifest: string } {
  const lines = output.split(/\r?\n/);
  const at = lines.findIndex((l) => l.trim() === MANIFEST_MARKER);
  if (at < 0) return { receipt: output.trim(), manifest: "" };
  return {
    receipt: lines.slice(0, at).join("\n").trim(),
    manifest: lines
      .slice(at + 1)
      .join("\n")
      .trim(),
  };
}

/** ssh exits 255 when it couldn't connect or authenticate; any other code is
 *  the remote command's own status, so we did reach the device. No status at
 *  all means a timeout or ssh failing to start. */
export function sshReachable(status: number | null | undefined): boolean {
  return typeof status === "number" && status !== 255;
}
