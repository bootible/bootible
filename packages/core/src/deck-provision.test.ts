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

  it("sets the hostname only when given", () => {
    expect(generateDeckProvision({ hostname: "vengeance" })).toContain("hostnamectl set-hostname");
    expect(generateDeckProvision({})).not.toContain("hostnamectl");
  });

  it("installs Decky + chosen plugins (store names) and restarts the loader", () => {
    const s = generateDeckProvision({ decky: { enabled: true, plugins: ["PowerTools"] } });
    expect(s).toContain("decky-installer");
    expect(s).toContain('"PowerTools"'); // store name passed straight to the loop
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
  });

  it("stages EmuDeck folders + launcher", () => {
    const s = generateDeckProvision({ emudeck: true });
    expect(s).toContain("emudeck.com/EmuDeck.desktop");
    expect(s).toContain("for d in roms bios saves states");
  });

  it("installs Sunshine and Tailscale when enabled", () => {
    const s = generateDeckProvision({ sunshine: true, tailscale: true });
    expect(s).toContain("dev.lizardbyte.app.Sunshine");
    expect(s).toContain("tailscale.com/install.sh");
    expect(s).toContain("systemctl enable --now tailscaled");
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
});
