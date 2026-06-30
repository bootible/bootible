import { describe, expect, it } from "vitest";
import { flatpakRefs } from "./deck-apps";
import { generateDeckProvision } from "./deck-provision";

describe("flatpakRefs", () => {
  it("resolves ids to Flathub refs and drops unknowns", () => {
    expect(flatpakRefs(["discord", "nope", "vlc"])).toEqual([
      "com.discordapp.Discord",
      "org.videolan.VLC",
    ]);
  });
});

describe("generateDeckProvision", () => {
  it("emits a safe bash scaffold by default", () => {
    const s = generateDeckProvision({});
    expect(s.startsWith("#!/usr/bin/env bash\n")).toBe(true);
    expect(s).toContain("set -euo pipefail");
    expect(s).toContain('passwd -S "$USER"'); // password guard
    expect(s).toContain("btrfs subvolume snapshot /"); // snapshot first
    expect(s).toContain("flatpak remote-add --if-not-exists --user flathub");
    expect(s).toContain("com.github.tchx84.Flatseal"); // the one default app
  });

  it("omits the snapshot when disabled", () => {
    const s = generateDeckProvision({ createSnapshot: false });
    expect(s).not.toContain("btrfs subvolume snapshot");
  });

  it("installs only the chosen flatpak apps", () => {
    const s = generateDeckProvision({ flatpakApps: ["discord"] });
    expect(s).toContain(
      "flatpak install --user --noninteractive --or-update flathub com.discordapp.Discord",
    );
    expect(s).not.toContain("org.signal.Signal"); // not chosen
  });

  it("enables sshd without touching the port at the default", () => {
    const s = generateDeckProvision({ ssh: { enabled: true, port: 22, authorizedKeys: [] } });
    expect(s).toContain("systemctl enable --now sshd");
    expect(s).not.toContain("/etc/ssh/sshd_config"); // no port edit at 22
  });

  it("sets a custom port and persists it across SteamOS updates", () => {
    const s = generateDeckProvision({ ssh: { enabled: true, port: 2222, authorizedKeys: [] } });
    expect(s).toContain("Port 2222");
    expect(s).toContain("/etc/atomic-update.conf.d/bootible-ssh.conf"); // allowlisted
    expect(s).toContain("systemctl restart sshd");
  });

  it("writes authorized keys when provided", () => {
    const key = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5 gavin@desk";
    const s = generateDeckProvision({ ssh: { enabled: true, port: 22, authorizedKeys: [key] } });
    expect(s).toContain('"$HOME/.ssh/authorized_keys"');
    expect(s).toContain(key);
  });

  it("fetches GitHub public keys on-device when a username is given", () => {
    const s = generateDeckProvision({
      ssh: { enabled: true, port: 22, authorizedKeys: [], githubUser: "octocat" },
    });
    expect(s).toContain('curl -fsSL "https://github.com/octocat.keys"');
    expect(s).toContain('>> "$HOME/.ssh/authorized_keys"');
  });

  it("bakes the Sunshine password when provided", () => {
    const s = generateDeckProvision({
      sunshine: { enabled: true, user: "me", pass: "s3cret" },
    });
    expect(s).toContain("--creds 'me' 's3cret'");
    expect(s).not.toContain("read -rs");
  });

  it("prompts for the Sunshine password on-device when deferred (keeps it off the USB)", () => {
    const s = generateDeckProvision({
      sunshine: { enabled: true, user: "me", pass: "s3cret", promptPass: true },
    });
    expect(s).not.toContain("s3cret"); // never written to the USB
    expect(s).toContain("read -rs _sunpass");
    expect(s).toContain("--creds 'me' \"$_sunpass\"");
  });

  it("sets the hostname only when given", () => {
    expect(generateDeckProvision({ hostname: "vengeance" })).toContain("hostnamectl set-hostname");
    expect(generateDeckProvision({})).not.toContain("hostnamectl");
  });

  it("installs Decky + chosen plugins (store names) and restarts the loader", () => {
    const s = generateDeckProvision({ decky: { enabled: true, plugins: ["PowerTools"] } });
    expect(s).toContain("decky-installer");
    expect(s).toContain("'PowerTools'"); // store name single-quote-escaped, passed to the loop
    expect(s).toContain("plugins.deckbrew.xyz/plugins");
    expect(s).toContain("systemctl restart plugin_loader"); // the v1 fix
    // The plugin name MUST be an env-var PREFIX (N="$NAME" python3 …), not a
    // trailing arg — otherwise os.environ['N'] throws and set -e kills the run
    // (caught on real hardware, 29 Jun).
    expect(s).toContain('N="$NAME" python3');
    expect(s).not.toMatch(/python3 -c "[^"]*" N="\$NAME"/);
    // plugins extract as root — the loader service owns ~/homebrew/plugins, so a
    // non-sudo extract hits Permission denied (caught on real hardware, 29 Jun).
    expect(s).toContain("sudo python3 -m zipfile -e");
    // loader stopped before extract so a re-run can't hit ETXTBSY on a live plugin
    // backend, then restarted after (caught re-running on hardware, 29 Jun).
    expect(s).toContain("systemctl stop plugin_loader");
    expect(s).toContain("systemctl restart plugin_loader");
  });

  it("skips Decky when disabled", () => {
    const s = generateDeckProvision({ decky: { enabled: false, plugins: [] } });
    expect(s).not.toContain("decky-installer");
  });

  it("installs Proton tools + Proton-GE", () => {
    const s = generateDeckProvision({ proton: { ge: true, protonUpQt: true, protontricks: true } });
    expect(s).toContain("net.davidotek.pupgui2"); // ProtonUp-Qt
    expect(s).toContain("com.github.Matoking.protontricks");
    expect(s).toContain("proton-ge-custom/releases/latest");
    expect(s).toContain("compatibilitytools.d");
    // Must skip the ARM tarball — x86_64 device (caught on hardware, 29 Jun).
    expect(s).toContain("'aarch64' not in a['name']");
  });

  it("stages EmuDeck folders + launcher", () => {
    const s = generateDeckProvision({ emudeck: true });
    expect(s).toContain("emudeck.com/EmuDeck.desktop");
    expect(s).toContain("for d in roms bios saves states");
  });

  it("sets a static IP via nmcli on the chosen interface", () => {
    const s = generateDeckProvision({
      staticIp: {
        iface: "ethernet",
        ip: "192.168.1.50",
        prefix: 24,
        gateway: "192.168.1.1",
        dns: "1.1.1.1",
      },
    });
    expect(s).toContain('$2=="802-3-ethernet"');
    expect(s).toContain("nmcli connection modify");
    expect(s).toContain("ipv4.addresses '192.168.1.50/24'");
    expect(s).toContain("ipv4.gateway '192.168.1.1'");
    expect(s).toContain("ipv4.dns '1.1.1.1'");
  });

  it("skips the static IP step when the address is invalid", () => {
    const s = generateDeckProvision({ staticIp: { iface: "wifi", ip: "not-an-ip", prefix: 24 } });
    expect(s).not.toContain("nmcli connection modify");
  });

  it("installs Sunshine + Tailscale (via the SteamOS-native deck-tailscale installer)", () => {
    const s = generateDeckProvision({ sunshine: { enabled: true }, tailscale: true });
    expect(s).toContain("dev.lizardbyte.app.Sunshine");
    // The generic tailscale.com/install.sh refuses on SteamOS — use deck-tailscale.
    expect(s).toContain("tailscale-dev/deck-tailscale");
    expect(s).not.toContain("tailscale.com/install.sh");
    // No more contradictory "ok installed" after a failure — it's gated on success.
    expect(s).toContain("Tailscale install failed — install manually");
  });

  it("StickDeck picks the non-Windows .zip asset and unzips it (was the linux-filter bug)", () => {
    const s = generateDeckProvision({ stickdeck: true });
    expect(s).toContain("DiscreteTom/stickdeck-rs");
    expect(s).toContain("'win' not in a['name'].lower()"); // the Deck asset has no "linux"
    expect(s).toContain("zipfile"); // it's a .zip, not a tarball
    expect(s).not.toContain("tar -xzf /tmp/stickdeck");
  });

  it("pre-sets Sunshine credentials with --creds when provided", () => {
    const s = generateDeckProvision({ sunshine: { enabled: true, user: "deck", pass: "pw" } });
    expect(s).toContain("--creds 'deck' 'pw'");
  });

  it("stages the Waydroid installer when enabled", () => {
    const s = generateDeckProvision({ waydroid: true });
    expect(s).toContain("SteamOS-Waydroid-Installer");
  });

  it("installs StickDeck when enabled", () => {
    const s = generateDeckProvision({ stickdeck: true });
    expect(s).toContain("DiscreteTom/stickdeck-rs/releases/latest");
    expect(s).toContain("StickDeck.desktop");
  });

  it("installs password managers via Flatpak", () => {
    const s = generateDeckProvision({
      passwordManagers: { managers: ["bitwarden", "1password"], method: "flatpak" },
    });
    expect(s).toContain("com.bitwarden.desktop");
    expect(s).toContain("1Password.flatpakref"); // 1Password uses a flatpakref URL
    expect(s).not.toContain("distrobox create");
  });

  it("installs password managers via Distrobox (full features)", () => {
    const s = generateDeckProvision({
      passwordManagers: { managers: ["1password"], method: "distrobox" },
    });
    expect(s).toContain("distrobox create -i archlinux:latest -n arch");
    expect(s).toContain("yay -S --noconfirm 1password");
    expect(s).toContain("distrobox-export --app 1password");
  });

  it("omits password managers when none chosen", () => {
    expect(generateDeckProvision({})).not.toContain("Password managers");
  });

  // ── injection hardening: user values reach generated bash run under sudo, and
  //    can arrive from an imported/cloud profile, so they must be neutralized. ──
  it("neutralizes a hostile hostname — no raw command substitution", () => {
    const s = generateDeckProvision({ hostname: "$(touch pwned)" });
    expect(s).not.toContain("$(touch"); // sanitized to [A-Za-z0-9-], then single-quoted
    expect(s).toContain("hostnamectl set-hostname 'touchpwned'");
  });

  it("single-quote-escapes Decky plugin names — no command substitution", () => {
    const s = generateDeckProvision({ decky: { enabled: true, plugins: ["$(evil)"] } });
    expect(s).toContain("'$(evil)'"); // literal inside single quotes
    expect(s).not.toContain('"$(evil)"'); // never the unsafe double-quoted form
  });

  it("drops an out-of-range or non-integer ssh port to 22", () => {
    expect(
      generateDeckProvision({ ssh: { enabled: true, port: 99999, authorizedKeys: [] } }),
    ).not.toContain("99999");
    // a port smuggled as a string via an untyped profile is coerced/dropped too
    const evil = generateDeckProvision({
      ssh: { enabled: true, port: "22; rm -rf ~" as unknown as number, authorizedKeys: [] },
    });
    expect(evil).not.toContain("rm -rf");
  });

  it("broadcasts a completion beacon when a buildId is set", () => {
    const s = generateDeckProvision({ buildId: "deadbeef" });
    // Mirrors the ROG beacon: a bounded python3 UDP broadcast on BEACON_PORT.
    expect(s).toContain("50474"); // BEACON_PORT
    expect(s).toContain("python3");
    expect(s).toContain("'status': 'done'"); // the python source builds the payload
    expect(s).toContain("'bootible': 1");
    // buildId is passed as an argv (not interpolated into the python source).
    expect(s).toContain("'deadbeef'");
    // Detached + bounded so it isn't a permanent agent.
    expect(s).toContain("nohup");
    expect(s).toContain("range(120)");
  });

  it("omits the beacon when no buildId is set", () => {
    const s = generateDeckProvision({});
    expect(s).not.toContain("50474");
    expect(s).not.toContain("BOOTIBLE_BEACON");
  });

  it("single-quote-escapes a hostile buildId into the argv", () => {
    const s = generateDeckProvision({ buildId: "a'b" });
    expect(s).toContain("'a'\\''b'");
  });
});
