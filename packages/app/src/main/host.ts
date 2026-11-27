import { execFileSync } from "node:child_process";

/** Install the chosen streaming apps on THIS desktop (the host). Sunshine =
 *  server, Moonlight = client. winget, best-effort; returns per-app status. */
export function installHostStreaming(which: { sunshine?: boolean; moonlight?: boolean }): {
  ok: boolean;
  output: string;
} {
  const apps = [
    { id: "LizardByte.Sunshine", role: "Sunshine (server)", on: !!which.sunshine },
    {
      id: "MoonlightGameStreamingProject.Moonlight",
      role: "Moonlight (client)",
      on: !!which.moonlight,
    },
  ].filter((a) => a.on);
  if (apps.length === 0) return { ok: true, output: "nothing selected for this PC" };
  const lines: string[] = [];
  let ok = true;
  for (const app of apps) {
    try {
      execFileSync(
        "winget",
        [
          "install",
          "--id",
          app.id,
          "--accept-source-agreements",
          "--accept-package-agreements",
          "--silent",
        ],
        { encoding: "utf8", timeout: 300000 },
      );
      lines.push(`${app.role}: installed`);
    } catch (error) {
      const e = error as { status?: number };
      // winget exits non-zero when already installed; treat that as fine.
      if (e.status === 0x8a15002b || e.status === -1978335189) {
        lines.push(`${app.role}: already installed`);
      } else {
        lines.push(`${app.role}: see winget`);
        ok = false;
      }
    }
  }
  return { ok, output: lines.join("\n") };
}
