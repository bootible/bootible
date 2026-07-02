import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { DeckConfig } from "./deck-config";
import { generateDeckProvision } from "./deck-provision";

/**
 * End-to-end dry run of the Steam Deck provisioner: build a MAX config (every app,
 * plugin and feature on), write it to a temp config file, generate provision.sh
 * from it, and actually EXECUTE the script under a stubbed PATH (flatpak / curl /
 * python3 / sudo / … replaced with no-op stubs that log what they're asked to do).
 * Nothing touches the real system, but the script runs end-to-end under
 * `set -euo pipefail` and we validate the receipt/log it produces — proving the
 * whole config → script → run → log pipeline holds with everything enabled.
 *
 * Requires `bash`; skipped where unavailable (a bare Windows box with no Git Bash).
 */

// Every toggle on — the "select all options" config.
const MAX: Partial<DeckConfig> = {
  hostname: "VengeanceDeck",
  createSnapshot: true,
  flatpakApps: ["chrome", "discord", "vlc", "spotify", "moonlight"],
  decky: { enabled: true, plugins: ["PowerTools", "SteamGridDB", "ProtonDB Badges"] },
  proton: { ge: true, protonUpQt: true, protontricks: true },
  emudeck: true,
  sunshine: { enabled: true, user: "nerdzadmin", promptPass: true },
  vnc: true,
  tailscale: true,
  waydroid: true,
  stickdeck: true,
  passwordManagers: { managers: ["1password", "bitwarden"], method: "distrobox" },
  ssh: { enabled: true, port: 22, githubUser: "gavinmcfall", authorizedKeys: [] },
  staticIp: {
    iface: "wifi",
    ip: "192.168.1.50",
    prefix: 24,
    gateway: "192.168.1.1",
    dns: "1.1.1.1",
  },
  buildId: "itestbuild01",
};

function bashPath(): string | null {
  for (const cmd of ["bash", "C:/Program Files/Git/bin/bash.exe"]) {
    try {
      execFileSync(cmd, ["-c", "exit 0"], { stdio: "ignore" });
      return cmd;
    } catch {}
  }
  return null;
}

// A single stub stands in for every external tool: it records the invocation to
// $TRACE, honours `-o <file>` (touch it, so downstream chmod/tar on a "download"
// succeed), and emits just enough stdout to keep the happy path green.
const STUB = `#!/usr/bin/env bash
name=$(basename "$0")
echo "$name $*" >> "$TRACE"
prev=""
for a in "$@"; do
  if [ "$prev" = "-o" ]; then : > "$a" 2>/dev/null || true; fi
  prev="$a"
done
case "$name" in
  findmnt) echo btrfs ;;      # so the btrfs snapshot path runs
  passwd)  echo "deck P" ;;   # no " NP " -> password guard passes
  python3) echo x ;;          # non-empty -> plugin hash / release URL lookups resolve
  install)
    # emulate \`install -d [-m MODE] DIR...\` — create the dirs but skip the unix
    # mode (chmod fails on a Windows/NTFS temp dir; it's real on a Deck).
    skip=0
    for a in "$@"; do
      if [ "$skip" = 1 ]; then skip=0; continue; fi
      case "$a" in -m) skip=1 ;; -*) : ;; *) mkdir -p "$a" 2>/dev/null || true ;; esac
    done
    ;;
esac
exit 0
`;

const STUBBED_TOOLS = [
  "flatpak",
  "sudo",
  "curl",
  "python3",
  "systemctl",
  "hostnamectl",
  "findmnt",
  "btrfs",
  "git",
  "distrobox",
  "tar",
  "passwd",
  "steamos-readonly",
  "nohup",
  "nmcli",
  "install",
];

const bash = bashPath();

describe("deck provisioner — full-config dry run", () => {
  it.skipIf(!bash)("parses (bash -n) with every option enabled", () => {
    const dir = mkdtempSync(join(tmpdir(), "bootible-dry-"));
    const cfgPath = join(dir, "config.json");
    writeFileSync(cfgPath, JSON.stringify(MAX, null, 2));
    const script = generateDeckProvision(JSON.parse(readFileSync(cfgPath, "utf8")));
    const sh = join(dir, "provision.sh");
    writeFileSync(sh, script);
    const r = spawnSync(bash as string, ["-n", sh], { encoding: "utf8" });
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
  });

  it.skipIf(!bash)(
    "runs end-to-end under stubs and logs every app to the receipt",
    () => {
      const dir = mkdtempSync(join(tmpdir(), "bootible-dry-"));
      // 1. write the max config to a temp file, then generate from what we read back
      const cfgPath = join(dir, "config.json");
      writeFileSync(cfgPath, JSON.stringify(MAX, null, 2));
      const script = generateDeckProvision(JSON.parse(readFileSync(cfgPath, "utf8")));
      const sh = join(dir, "provision.sh");
      writeFileSync(sh, script);

      // 2. stub every external tool onto a private PATH
      const bin = join(dir, "bin");
      mkdirSync(bin);
      for (const tool of STUBBED_TOOLS) {
        const p = join(bin, tool);
        writeFileSync(p, STUB);
        chmodSync(p, 0o755);
      }

      // 3. run it with a throwaway HOME so ~/.bootible lands in the temp dir
      const home = join(dir, "home");
      mkdirSync(home);
      const trace = join(dir, "trace.txt");
      const r = spawnSync(bash as string, [sh], {
        encoding: "utf8",
        input: "",
        timeout: 60000,
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH ?? ""}`,
          HOME: home,
          USER: "deck",
          TRACE: trace,
        },
      });

      // Ran clean to completion under `set -euo pipefail` with EVERY option on.
      // (This is the load-bearing assertion — it caught the EmuDeck SD-card abort.)
      expect(r.status, `stderr:\n${r.stderr}\nstdout:\n${r.stdout}`).toBe(0);

      // Execution + logging: the receipt/log the on-device SSH check will read.
      const receipt = readFileSync(join(home, ".bootible", "receipt"), "utf8");
      const log = readFileSync(join(home, ".bootible", "provision.log"), "utf8");
      expect(log).toContain("provisioning this Steam Deck");
      expect(receipt).toContain("DONE provision finished");
      // Milestones the run actually reached (proves ok() logging end-to-end).
      expect(receipt, "flatpak batch").toMatch(/ok\s+flatpak apps done/i);
      for (const plugin of MAX.decky?.plugins ?? []) {
        expect(receipt, `decky plugin ${plugin}`).toContain(`plugin: ${plugin}`);
      }
      expect(receipt, "ssh").toMatch(/ssh ready/i);
      expect(receipt, "tailscale").toMatch(/tailscale/i);
      expect(receipt, "waydroid").toMatch(/waydroid/i);
      expect(receipt, "stickdeck").toMatch(/stickdeck/i);

      // Coverage: the generated script covers every enabled app/feature (deterministic).
      for (const ref of ["Chrome", "Discord", "VLC", "Spotify", "Moonlight"]) {
        expect(script, `flatpak install for ${ref}`).toMatch(
          new RegExp(`flatpak install[^\\n]*${ref}`, "i"),
        );
      }
      expect(script, "hostname").toContain("hostnamectl set-hostname");
      expect(script, "decky loader").toMatch(/decky-installer/i);
      expect(script, "proton-ge").toMatch(/proton-ge-custom/i);
      expect(script, "protonup-qt").toMatch(/pupgui2/i);
      expect(script, "protontricks").toMatch(/protontricks/i);
      expect(script, "emudeck").toMatch(/emudeck/i);
      expect(script, "sunshine creds").toMatch(/--creds/i);
      expect(script, "vnc").toMatch(/tigervnc|vncviewer/i);
      expect(script, "password managers via distrobox").toMatch(/distrobox/i);
      expect(script, "github ssh keys").toMatch(/gavinmcfall\.keys/i);
      expect(script, "sshd enabled").toMatch(/systemctl enable[^\n]*sshd/i);
    },
    60000,
  );
});
