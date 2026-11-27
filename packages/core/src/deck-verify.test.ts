import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import type { DeckConfig } from "./deck-config";
import { deckVerifyChecks, generateDeckVerify } from "./deck-verify";
import { parseVerifyOutput } from "./verify";

const CFG: Partial<DeckConfig> = {
  hostname: "VengeanceDeck",
  createSnapshot: true,
  flatpakApps: ["spotify", "chrome", "not-a-real-app"],
  defaultBrowser: "chrome",
  decky: { enabled: true, plugins: ["TabMaster"] },
  proton: { ge: true, protonUpQt: false, protontricks: false },
  ssh: { enabled: true, port: 22, authorizedKeys: ["ssh-ed25519 AAAAkey me@pc"] },
};

const ids = (cfg: Partial<DeckConfig>) => deckVerifyChecks(cfg).map((c) => c.id);

describe("deckVerifyChecks", () => {
  it("checks exactly what was chosen, skipping unknown app ids", () => {
    expect(ids(CFG)).toEqual([
      "receipt",
      "snapshot",
      "hostname",
      "flathub",
      "flatpak:spotify",
      "flatpak:chrome",
      "default-browser",
      "decky",
      "plugin:TabMaster",
      "proton-ge",
      "sshd",
      "ssh-keys",
    ]);
  });

  it("adds checks for every optional feature that's switched on", () => {
    const all = ids({
      emudeck: true,
      sunshine: { enabled: true, user: "me", promptPass: true },
      vnc: true,
      tailscale: true,
      stickdeck: true,
      waydroid: true,
      staticIp: { iface: "wifi", ip: "10.0.0.5", prefix: 24 },
      ssh: { enabled: true, port: 2222, authorizedKeys: [], githubUser: "someone" },
      passwordManagers: { managers: ["bitwarden"], method: "distrobox" },
    });
    for (const id of [
      "emudeck",
      "flatpak:sunshine",
      "sunshine-creds",
      "flatpak:vnc",
      "tailscale",
      "flatpak:trayscale",
      "stickdeck",
      "waydroid",
      "static-ip",
      "ssh-port",
      "ssh-github",
      "pm:bitwarden",
    ]) {
      expect(all).toContain(id);
    }
  });

  it("checks the 1Password flatpak by its app id, not the .flatpakref URL", () => {
    const c = deckVerifyChecks({
      passwordManagers: { managers: ["1password"], method: "flatpak" },
    });
    expect(c.find((x) => x.id === "flatpak:1password")?.body).toContain(
      "com.onepassword.OnePassword",
    );
  });

  it("leaves out Decky plugins when Decky is off", () => {
    expect(ids({ decky: { enabled: false, plugins: ["TabMaster"] } })).not.toContain(
      "plugin:TabMaster",
    );
  });
});

function bashPath(): string | null {
  for (const cmd of ["bash", "C:/Program Files/Git/bin/bash.exe"]) {
    try {
      execFileSync(cmd, ["-c", "exit 0"], { stdio: "ignore" });
      return cmd;
    } catch {}
  }
  return null;
}

const BASH = bashPath();

/** Build a fake $HOME that looks like a fully provisioned Deck for CFG, put
 *  stubs for flatpak/systemctl/xdg-mime/uname/python3 first on PATH, run the
 *  generated script, and parse what it reports. `fail` names a stub that should
 *  report failure (exit 1) instead. */
function runVerify(
  cfg: Partial<DeckConfig>,
  fail?: string,
  receipt = "ok   snapshot: /x\nDONE provision finished; 0 warning(s)\n",
  /** Extra files under the fake $HOME; realPython runs the script's python3
   *  bodies for real instead of stubbing them to pass. */
  opts: { files?: Record<string, string>; realPython?: boolean } = {},
) {
  if (!BASH) throw new Error("no bash");
  const root = mkdtempSync(join(tmpdir(), "bootible-verify-"));
  const home = join(root, "home");
  const bin = join(root, "bin");
  for (const d of [
    ".bootible",
    ".ssh",
    "homebrew/services",
    "homebrew/plugins/tabmaster",
    ".steam/root/compatibilitytools.d/GE-Proton9-1/proton",
  ])
    mkdirSync(join(home, d), { recursive: true });
  mkdirSync(bin);
  writeFileSync(join(home, ".bootible/receipt"), receipt);
  writeFileSync(
    join(home, ".ssh/authorized_keys"),
    "# Managed by bootible\nssh-ed25519 AAAAkey me@pc\n",
  );
  // MSYS bash only treats a file as executable (-x) when it starts with #!
  writeFileSync(join(home, "homebrew/services/PluginLoader"), "#!/bin/sh\n");
  chmodSync(join(home, "homebrew/services/PluginLoader"), 0o755);
  for (const [path, body] of Object.entries(opts.files ?? {})) {
    mkdirSync(dirname(join(home, path)), { recursive: true });
    writeFileSync(join(home, path), body);
  }

  const stub = (name: string, body: string) => {
    const p = join(bin, name);
    writeFileSync(p, `#!/usr/bin/env bash\n${name === fail ? "exit 1" : body}\n`);
    chmodSync(p, 0o755);
  };
  stub("flatpak", 'case "$1" in remotes) echo flathub ;; esac; exit 0');
  stub("systemctl", "exit 0");
  stub("xdg-mime", "echo com.google.Chrome.desktop");
  stub("uname", "echo VengeanceDeck");
  if (!opts.realPython) stub("python3", "cat >/dev/null; exit 0");
  // /.snapshots is outside $HOME; point the check at a fake by stubbing ls.
  stub("ls", "exit 0");

  const script = join(root, "verify.sh");
  writeFileSync(script, generateDeckVerify(cfg));
  const r = spawnSync(BASH, [script], {
    encoding: "utf8",
    // USERPROFILE too: Windows Python's expanduser("~") reads it, not HOME.
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      PATH: `${bin}:${process.env.PATH ?? ""}`,
    },
  });
  return { checks: parseVerifyOutput(r.stdout), root, stderr: r.stderr };
}

describe.skipIf(!BASH)("generateDeckVerify (executed under bash)", () => {
  it("is valid bash", () => {
    const root = mkdtempSync(join(tmpdir(), "bootible-verify-"));
    const f = join(root, "v.sh");
    writeFileSync(f, generateDeckVerify(CFG));
    expect(spawnSync(BASH as string, ["-n", f]).status).toBe(0);
  });

  it("reports every check as passing on a device that matches the config", () => {
    const { checks, stderr } = runVerify(CFG);
    expect(checks.map((c) => c.id)).toEqual(ids(CFG));
    const failed = checks.filter((c) => c.status !== "pass");
    expect(failed, stderr).toEqual([]);
  });

  it("fails each Flatpak check with a reason when the app isn't installed", () => {
    const { checks } = runVerify(CFG, "flatpak");
    const spotify = checks.find((c) => c.id === "flatpak:spotify");
    expect(spotify?.status).toBe("fail");
    expect(spotify?.detail).toBe("com.spotify.Client not installed");
    expect(checks.find((c) => c.id === "hostname")?.status).toBe("pass");
  });

  it("counts a run's warnings once (its own summary line is a WARN too)", () => {
    const { checks } = runVerify(
      CFG,
      undefined,
      "WARN plugin failed: Syncthing\nDONE provision finished; 1 warning(s)\nWARN 1 step(s) had warnings — see ~/.bootible/receipt\n",
    );
    expect(checks.find((c) => c.id === "receipt")).toMatchObject({
      status: "fail",
      detail: "1 warning(s), first: plugin failed: Syncthing",
    });
  });

  it("fails a plugin the last run failed to install, even though its folder is there", () => {
    const { checks } = runVerify(
      CFG,
      undefined,
      "WARN plugin failed: TabMaster\nDONE provision finished; 1 warning(s)\n",
    );
    expect(checks.find((c) => c.id === "plugin:TabMaster")).toMatchObject({
      status: "fail",
      detail: "the last setup run failed to install it, so it may be a mix of old and new files",
    });
  });

  it("names the wrong hostname", () => {
    const { checks } = runVerify({ ...CFG, hostname: "OtherDeck" });
    expect(checks.find((c) => c.id === "hostname")).toMatchObject({
      status: "fail",
      detail: "hostname is VengeanceDeck",
    });
  });

  it("never executes a config value (a hostile plugin name stays data)", () => {
    const evil = "x'; touch PWNED; echo '";
    const { checks, root } = runVerify({ ...CFG, decky: { enabled: true, plugins: [evil] } });
    expect(existsSync(join(root, "home", "PWNED"))).toBe(false);
    expect(checks.find((c) => c.id === `plugin:${evil}`)).toBeDefined();
  });
});

const PYTHON = !!BASH && spawnSync(BASH, ["-c", "python3 -c 'import glob, json'"]).status === 0;

describe.skipIf(!PYTHON)("Decky plugin check (real python3)", () => {
  const ONLY = { decky: { enabled: true, plugins: ["Syncthing"] } };
  const PLUGIN = { "homebrew/plugins/decky-syncthing/plugin.json": '{"name": "Syncthing"}' };
  // The line Decky logs when a plugin's _main() raises (real Deck, 28 Nov).
  const CRASH =
    "future: <Task finished name='Task-1' coro=<Plugin._main() done, defined at /x/main.py:91> exception=PermissionError(13, 'Permission denied')>\n";
  const plugin = (files: Record<string, string>) =>
    runVerify(ONLY, undefined, undefined, { realPython: true, files }).checks.find(
      (c) => c.id === "plugin:Syncthing",
    );

  it("fails a plugin whose last start crashed, naming the error", () => {
    expect(
      plugin({ ...PLUGIN, "homebrew/logs/decky-syncthing/2026-11-28 07.33.07.log": CRASH }),
    ).toMatchObject({
      status: "fail",
      detail: "it crashed on its last start: PermissionError(13, 'Permission denied')",
    });
  });

  it("passes once a later start is clean, ignoring the plugin's own newer logs", () => {
    expect(
      plugin({
        ...PLUGIN,
        "homebrew/logs/decky-syncthing/2026-11-28 07.33.07.log": CRASH,
        "homebrew/logs/decky-syncthing/2026-11-28 07.45.00.log": "INFO started\n",
        "homebrew/logs/decky-syncthing/watchdog.log": CRASH,
      })?.status,
    ).toBe("pass");
  });

  it("fails a plugin that isn't installed", () => {
    expect(plugin({})).toMatchObject({ status: "fail", detail: "not in ~/homebrew/plugins" });
  });
});
