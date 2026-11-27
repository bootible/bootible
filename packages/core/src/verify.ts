/**
 * Deep verify — the shared result format.
 *
 * A device saves the config it was provisioned with; the app generates a check
 * script from that config (deck-verify.ts / windows-verify.ts), runs it over SSH,
 * and parses the result here. Each check prints exactly one line:
 *
 *   BOOTIBLE-CHECK <TAB> pass|fail|skip <TAB> id <TAB> label <TAB> detail
 *
 * Anything else the shell prints (login banners, warnings) is ignored, so noise
 * can't corrupt the result. Checks look at real system state, not the receipt the
 * provisioner wrote about itself.
 */

export const CHECK_MARKER = "BOOTIBLE-CHECK";

export type CheckStatus = "pass" | "fail" | "skip";

export interface VerifyCheck {
  status: CheckStatus;
  /** Stable id, e.g. "flatpak:spotify", "plugin:TabMaster", "hostname". */
  id: string;
  /** What a person reads, e.g. "Spotify (Flatpak)". */
  label: string;
  /** Why it failed or was skipped; empty on pass. */
  detail: string;
}

const STATUSES = new Set<CheckStatus>(["pass", "fail", "skip"]);

export function parseVerifyOutput(output: string): VerifyCheck[] {
  const checks: VerifyCheck[] = [];
  for (const raw of output.split(/\r?\n/)) {
    const f = raw.replace(/\r$/, "").split("\t");
    if (f[0] !== CHECK_MARKER) continue;
    const status = f[1] as CheckStatus;
    if (!STATUSES.has(status) || !f[2]) continue;
    checks.push({ status, id: f[2], label: f[3] ?? f[2], detail: (f[4] ?? "").trim() });
  }
  return checks;
}

export function summarizeChecks(checks: readonly VerifyCheck[]): {
  pass: number;
  fail: number;
  skip: number;
  total: number;
} {
  const count = (s: CheckStatus) => checks.filter((c) => c.status === s).length;
  return { pass: count("pass"), fail: count("fail"), skip: count("skip"), total: checks.length };
}

/** One check in a generated script, before it is rendered for a shell. */
export interface CheckSpec {
  id: string;
  label: string;
  /** Shell body. Exit 0 = pass, 77 = skip, anything else = fail; the last line
   *  printed becomes the detail. */
  body: string;
}

/** Exit code a check body uses to report "not applicable here". */
export const SKIP_CODE = 77;
