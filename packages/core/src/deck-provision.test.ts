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
});
