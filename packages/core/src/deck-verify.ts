import { catalogApp } from "./catalog";
import { FLATPAK_APPS, passwordManagers } from "./deck-apps";
import { type DeckConfig, normalizeDeckConfig } from "./deck-config";
import { shq } from "./deck-provision";
import { CHECK_MARKER, type CheckSpec, SKIP_CODE } from "./verify";

/**
 * Deep verify for a Steam Deck: from the config the Deck was provisioned with,
 * generate a bash script that checks every chosen item against the real system
 * (flatpak, systemd, NetworkManager, the filesystem). Runs as `deck` over SSH with
 * no sudo. Each check mirrors what deck-provision.ts does for that field; where an
 * end state depends on a value only known at provision time (the EmuDeck path, the
 * NM connection, the snapshot) the receipt line that recorded it is the anchor.
 */

const ONEPASSWORD_APP_ID = "com.onepassword.OnePassword";

const PRELUDE = `set -u
R="$HOME/.bootible/receipt"
emit() { printf '${CHECK_MARKER}\\t%s\\t%s\\t%s\\t%s\\n' "$1" "$2" "$3" "$4"; }
run() {
  local id="$1" label="$2" fn="$3" out rc
  out=$("$fn" 2>&1); rc=$?
  out=$(printf '%s' "$out" | tail -n1 | tr '\\t\\r' '  ')
  if [ "$rc" -eq 0 ]; then emit pass "$id" "$label" ""
  elif [ "$rc" -eq ${SKIP_CODE} ]; then emit skip "$id" "$label" "$out"
  else emit fail "$id" "$label" "\${out:-check failed}"; fi
}
fp() { flatpak info --user "$1" >/dev/null 2>&1 || { echo "$1 not installed"; return 1; }; }
unit_on() {
  systemctl is-enabled "$1" >/dev/null 2>&1 || { echo "$1 isn't enabled"; return 1; }
  systemctl is-active "$1" >/dev/null 2>&1 || { echo "$1 isn't running"; return 1; }
}
`;

function flatpakCheck(id: string, ref: string, name: string): CheckSpec {
  return { id: `flatpak:${id}`, label: `${name} (Flatpak)`, body: `fp ${shq(ref)}` };
}

export function deckVerifyChecks(input: Partial<DeckConfig>): CheckSpec[] {
  const cfg = normalizeDeckConfig(input);
  const checks: CheckSpec[] = [];
  const add = (id: string, label: string, body: string) => checks.push({ id, label, body });

  add(
    "receipt",
    "Setup finished without warnings",
    `[ -f "$R" ] || { echo "no receipt — provision.sh never ran"; return 1; }
  grep -q '^DONE' "$R" || { echo "provision.sh stopped before the end"; return 1; }
  # The count on the DONE line, not grep -c '^WARN': the run's own summary
  # ("WARN N step(s) had warnings") is a WARN line too and would count twice.
  w=$(grep '^DONE' "$R" | tail -1 | sed -n 's/.*; \\([0-9][0-9]*\\) warning.*/\\1/p')
  [ "\${w:-0}" = 0 ] || { echo "$w warning(s), first: $(grep -m1 '^WARN' "$R" | cut -c6-)"; return 1; }`,
  );

  if (cfg.createSnapshot) {
    add(
      "snapshot",
      "Rollback snapshot",
      `grep -qE 'not btrfs|no root subvolume' "$R" 2>/dev/null && { echo "root isn't btrfs, so no snapshot is possible"; return ${SKIP_CODE}; }
  ls -d /.snapshots/pre-bootible-* >/dev/null 2>&1 || { echo "no /.snapshots/pre-bootible-*"; return 1; }`,
    );
  }

  if (cfg.hostname) {
    add(
      "hostname",
      `Hostname ${cfg.hostname}`,
      `h=$(uname -n); [ "$h" = ${shq(cfg.hostname)} ] || { echo "hostname is $h"; return 1; }`,
    );
  }

  add(
    "flathub",
    "Flathub remote",
    `flatpak remotes --user --columns=name 2>/dev/null | grep -qx flathub || { echo "the user flathub remote is missing"; return 1; }`,
  );

  const byId = new Map(FLATPAK_APPS.map((a) => [a.id, a]));
  for (const id of cfg.flatpakApps) {
    const app = byId.get(id);
    if (app) checks.push(flatpakCheck(id, app.ref, app.name));
  }

  const browser = cfg.defaultBrowser ? catalogApp(cfg.defaultBrowser) : undefined;
  if (browser?.flatpak && cfg.flatpakApps.includes(browser.id)) {
    const desktop = `${browser.flatpak}.desktop`;
    add(
      "default-browser",
      `Default browser ${browser.name}`,
      `d=$(xdg-mime query default x-scheme-handler/https 2>/dev/null)
  [ "$d" = ${shq(desktop)} ] || grep -q ${shq(`^x-scheme-handler/https=${desktop}`)} "$HOME/.config/mimeapps.list" 2>/dev/null || { echo "default is \${d:-unset}"; return 1; }`,
    );
  }

  if (cfg.decky.enabled) {
    add(
      "decky",
      "Decky Loader",
      `[ -x "$HOME/homebrew/services/PluginLoader" ] || { echo "Decky Loader isn't installed"; return 1; }
  unit_on plugin_loader`,
    );
    for (const name of cfg.decky.plugins) {
      add(
        `plugin:${name}`,
        `Decky plugin: ${name}`,
        // A failed install can leave the old plugin dir behind, half overwritten
        // (Syncthing on 28 Nov: new main.py, old bin/ and dist/), so being present
        // isn't enough — the last run must also have installed it.
        `grep -Fxq ${shq(`WARN plugin failed: ${name}`)} "$R" 2>/dev/null && { echo "the last setup run failed to install it, so it may be a mix of old and new files"; return 1; }
  python3 - ${shq(name)} <<'BOOTIBLE_PY' || { echo "not in ~/homebrew/plugins"; return 1; }
import glob, json, os, sys
names = set()
for f in glob.glob(os.path.expanduser("~/homebrew/plugins/*/plugin.json")):
    try:
        names.add(json.load(open(f)).get("name"))
    except Exception:
        pass
sys.exit(0 if sys.argv[1] in names else 1)
BOOTIBLE_PY`,
      );
    }
  }

  if (cfg.proton.ge) {
    add(
      "proton-ge",
      "Proton-GE",
      `ls -d "$HOME"/.steam/root/compatibilitytools.d/GE-Proton*/proton >/dev/null 2>&1 || { echo "no GE-Proton in ~/.steam/root/compatibilitytools.d"; return 1; }`,
    );
  }
  if (cfg.proton.protonUpQt)
    checks.push(flatpakCheck("protonupqt", "net.davidotek.pupgui2", "ProtonUp-Qt"));
  if (cfg.proton.protontricks)
    checks.push(flatpakCheck("protontricks", "com.github.Matoking.protontricks", "Protontricks"));

  if (cfg.emudeck) {
    add(
      "emudeck",
      "EmuDeck staged",
      `EMU=$(sed -n 's/^ok   EmuDeck staged at \\(.*\\) — run.*/\\1/p' "$R" 2>/dev/null | head -1)
  [ -n "$EMU" ] || { echo "receipt doesn't say where EmuDeck was staged"; return 1; }
  for d in roms bios saves states; do [ -d "$EMU/$d" ] || { echo "missing $EMU/$d"; return 1; }; done
  [ -x "$HOME/Desktop/EmuDeck.desktop" ] || { echo "no EmuDeck launcher on the Desktop"; return 1; }`,
    );
  }

  if (cfg.sunshine.enabled) {
    checks.push(flatpakCheck("sunshine", "dev.lizardbyte.app.Sunshine", "Sunshine"));
    if (cfg.sunshine.user && (cfg.sunshine.pass || cfg.sunshine.promptPass)) {
      add(
        "sunshine-creds",
        "Sunshine credentials",
        `grep -q '^ok   Sunshine credentials set' "$R" 2>/dev/null || { echo "credentials weren't set"; return 1; }`,
      );
    }
  }

  if (cfg.vnc) checks.push(flatpakCheck("vnc", "org.tigervnc.vncviewer", "TigerVNC viewer"));

  if (cfg.tailscale) {
    add(
      "tailscale",
      "Tailscale",
      // Same rule as the provisioner: deck-tailscale's /opt binary, or a distro
      // one on PATH (Bazzite ships tailscale in /usr/bin).
      `{ [ -x /opt/tailscale/tailscale ] || command -v tailscale >/dev/null 2>&1; } || { echo "tailscale isn't installed"; return 1; }
  unit_on tailscaled`,
    );
    checks.push(flatpakCheck("trayscale", "dev.deedles.Trayscale", "Trayscale"));
  }

  if (cfg.staticIp) {
    const want = `${cfg.staticIp.ip}/${cfg.staticIp.prefix}`;
    add(
      "static-ip",
      `Static IP ${want}`,
      `CON=$(sed -n 's/^ok   static IP .* set on //p' "$R" 2>/dev/null | head -1)
  [ -n "$CON" ] || { echo "receipt doesn't name the connection it changed"; return 1; }
  [ "$(nmcli -g ipv4.method connection show "$CON" 2>/dev/null)" = manual ] || { echo "$CON isn't set to a manual address"; return 1; }
  nmcli -g ipv4.addresses connection show "$CON" 2>/dev/null | grep -qF ${shq(want)} || { echo "$CON has $(nmcli -g ipv4.addresses connection show "$CON" 2>/dev/null)"; return 1; }`,
    );
  }

  if (cfg.ssh.enabled) {
    add("sshd", "SSH server", "unit_on sshd");
    if (cfg.ssh.port !== 22) {
      add(
        "ssh-port",
        `SSH on port ${cfg.ssh.port}`,
        `ss -Htln ${shq(`sport = :${cfg.ssh.port}`)} 2>/dev/null | grep -q . || { echo "nothing listening on ${cfg.ssh.port}"; return 1; }`,
      );
    }
    if (cfg.ssh.authorizedKeys.length > 0) {
      const greps = cfg.ssh.authorizedKeys
        .map((k) => `grep -qxF ${shq(k)} "$HOME/.ssh/authorized_keys" 2>/dev/null || n=$((n+1))`)
        .join("\n  ");
      add(
        "ssh-keys",
        `SSH keys (${cfg.ssh.authorizedKeys.length})`,
        `n=0
  ${greps}
  [ "$n" = 0 ] || { echo "$n key(s) missing from ~/.ssh/authorized_keys"; return 1; }`,
      );
    }
    if (cfg.ssh.githubUser) {
      add(
        "ssh-github",
        `SSH keys from github.com/${cfg.ssh.githubUser}`,
        `grep -qF ${shq(`ok   added github.com/${cfg.ssh.githubUser} keys`)} "$R" 2>/dev/null || { echo "the GitHub keys weren't fetched"; return 1; }
  [ "$(grep -cv '^#' "$HOME/.ssh/authorized_keys" 2>/dev/null)" -gt 0 ] || { echo "~/.ssh/authorized_keys has no keys"; return 1; }`,
      );
    }
  }

  const pms = passwordManagers(cfg.passwordManagers.managers);
  for (const pm of pms) {
    if (cfg.passwordManagers.method === "flatpak") {
      const appId = pm.flatpakIsRef ? ONEPASSWORD_APP_ID : pm.flatpak;
      checks.push(flatpakCheck(pm.id, appId, pm.name));
    } else {
      add(
        `pm:${pm.id}`,
        `${pm.name} (distrobox)`,
        `command -v distrobox >/dev/null 2>&1 || { echo "distrobox isn't installed"; return 1; }
  podman ps -a --format '{{.Names}}' 2>/dev/null | grep -qx arch || { echo "no 'arch' distrobox container"; return 1; }
  distrobox enter arch -- pacman -Q ${shq(pm.pkg)} >/dev/null 2>&1 || { echo "${pm.pkg} isn't installed in the arch container"; return 1; }`,
      );
    }
  }

  if (cfg.stickdeck) {
    add(
      "stickdeck",
      "StickDeck",
      `find "$HOME/Applications/stickdeck" -name launch.sh -type f 2>/dev/null | grep -q . || { echo "no launch.sh in ~/Applications/stickdeck"; return 1; }
  [ -x "$HOME/Desktop/StickDeck.desktop" ] || { echo "no StickDeck launcher on the Desktop"; return 1; }`,
    );
  }

  if (cfg.waydroid) {
    add(
      "waydroid",
      "Waydroid installer",
      `[ -x /usr/bin/waydroid ] && return 0
  [ -f "$HOME/Applications/SteamOS-Waydroid-Installer/steamos-waydroid-installer.sh" ] || { echo "installer isn't in ~/Applications"; return 1; }
  [ -x "$HOME/Desktop/Waydroid Installer.desktop" ] || { echo "no Waydroid launcher on the Desktop"; return 1; }`,
    );
  }

  return checks;
}

/** The full bash script: prelude, one function per check, then the runs. */
export function generateDeckVerify(input: Partial<DeckConfig>): string {
  const checks = deckVerifyChecks(input);
  const fns = checks.map((c, i) => `c${i}() {\n  ${c.body}\n}`).join("\n");
  const runs = checks.map((c, i) => `run ${shq(c.id)} ${shq(c.label)} c${i}`).join("\n");
  return `${PRELUDE}\n${fns}\n\n${runs}\n`;
}
