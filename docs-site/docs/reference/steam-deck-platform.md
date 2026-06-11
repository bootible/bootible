---
title: Steam Deck
description: Configure your Steam Deck with Bootible
---

# Steam Deck

Bootible uses Ansible to configure your Steam Deck, installing applications via Flatpak and setting up gaming enhancements like Decky Loader.

---

## Quick Start

### 1. Switch to Desktop Mode

Hold the **Power** button and select **Switch to Desktop**.

### 2. Set Your Sudo Password

If you haven't already, open Konsole and run:

```bash
passwd
```

### 3. Run Bootible

```bash
curl -fsSL https://bootible.dev/deck | bash
```

This runs a **dry run** first, showing what would change. Then run `bootible` to apply.

---

## What Gets Installed

### Gaming Enhancements

| Feature | Description |
|---------|-------------|
| **Decky Loader** | Plugin system for Gaming Mode |
| **Proton-GE** | Custom Proton with extra fixes |
| **ProtonUp-Qt** | Manage Proton versions |
| **Protontricks** | Install Windows components |
| **EmuDeck** | All-in-one emulation setup |

### Applications (Flatpak)

| Category | Apps |
|----------|------|
| **Communication** | Discord, Signal, Telegram |
| **Media** | Spotify, VLC, Plex |
| **Browsers** | Firefox, Chromium |
| **Streaming** | Moonlight, Chiaki-ng |
| **Productivity** | VS Code, OBS |
| **Gaming** | Heroic Launcher, Lutris |

### System Configuration

- Hostname setting
- Static IP configuration
- SSH server with key management
- Tailscale VPN
- Shader cache relocation to SD card

---

## Decky Loader Plugins

Decky adds features to Gaming Mode. Access it by pressing **...** (Quick Access Menu) and selecting the plug icon.

### Available Plugins

| Plugin | Description |
|--------|-------------|
| **PowerTools** | CPU/GPU control, per-game profiles |
| **ProtonDB Badges** | Compatibility ratings in library |
| **SteamGridDB** | Custom artwork for games |
| **CSS Loader** | Visual themes |
| **Animation Changer** | Boot/suspend animations |
| **HLTB** | How Long to Beat times |
| **Battery Tracker** | Battery health monitoring |
| **AutoSuspend** | Auto-suspend on idle |
| **Tailscale Control** | VPN toggle in Gaming Mode |

### Enable Plugins

Configure in your `config.yml`:

```yaml
install_decky: true
decky_plugins:
  powertools:
    enabled: true
  protondb_badges:
    enabled: true
  steamgriddb:
    enabled: true
  css_loader:
    enabled: true
```

---

## Storage Management

### Internal vs SD Card

Steam Deck has limited internal storage. Bootible can help manage this:

```yaml
# Move shader cache to SD card (can be 10-50GB+)
move_shader_cache: true

# Store emulation on SD card
emulation_storage: "sdcard"  # or "internal", "auto"
```

### SD Card Detection

Bootible automatically detects SD cards at:

- `/run/media/mmcblk0p1` (unlabeled)
- `/run/media/deck/<label>` (labeled)

---

## Proton & Windows Games

### What is Proton?

Proton lets you play Windows games on Linux. It's built into Steam but Bootible enhances it:

- **Proton-GE**: Custom build with extra fixes and codecs
- **Protontricks**: Install Windows components (vcrun, .NET, etc.)

### Checking Compatibility

Use [ProtonDB.com](https://www.protondb.com) or the ProtonDB Badges plugin:

| Rating | Meaning |
|--------|---------|
| Platinum | Works perfectly |
| Gold | Minor issues |
| Silver | Playable with problems |
| Bronze | May have issues |
| Borked | Doesn't work |

### Common Launch Options

Add to game **Properties > Launch Options**:

```bash
# Fix some crashes
PROTON_NO_ESYNC=1 %command%
PROTON_NO_FSYNC=1 %command%

# Reduce shader stutter
DXVK_ASYNC=1 %command%

# Force resolution
gamescope -w 1280 -h 800 -- %command%
```

---

## Remote Access

### SSH

Enable SSH to manage your Deck from another computer:

```yaml
install_ssh: true
ssh_generate_key: true
ssh_add_to_github: true  # Adds key to your GitHub account
ssh_import_authorized_keys: true
ssh_authorized_keys:
  - "desktop.pub"  # From private/ssh-keys/
```

### Tailscale

Access your Deck from anywhere with Tailscale VPN:

```yaml
install_tailscale: true
```

After install, authenticate: `tailscale up`

### Sunshine (Game Streaming Host)

Stream from your Deck to other devices:

```yaml
install_remote_desktop: true
install_sunshine: true
```

---

## Emulation

### EmuDeck Setup

EmuDeck is an interactive installer that configures:

- RetroArch (multi-system)
- Dolphin (GameCube/Wii)
- PCSX2 (PlayStation 2)
- RPCS3 (PlayStation 3)
- Yuzu/Ryujinx (Switch)
- And many more...

```yaml
install_emudeck: true
emulation_storage: "sdcard"  # Recommended
```

Bootible downloads EmuDeck; you complete setup interactively.

### After EmuDeck Setup

1. Copy ROMs to `~/Emulation/roms/<system>/`
2. Add BIOS files to `~/Emulation/bios/`
3. Run Steam ROM Manager to add games to Steam

### ROM Formats

| System | Recommended Format |
|--------|-------------------|
| GameCube/Wii | .rvz (compressed) |
| PS1/PS2 | .chd (compressed) |
| PSP | .cso (compressed) |
| Everything else | .zip when supported |

---

## Backup & Recovery

### Btrfs Snapshots

Before making changes, Bootible creates a snapshot:

```
/home/.snapshots/bootible-pre-setup-20250108-143022
```

To restore if something goes wrong:

```bash
# List snapshots
sudo ls /home/.snapshots/

# Restore (requires root)
sudo btrfs subvolume delete /home
sudo btrfs subvolume snapshot /home/.snapshots/bootible-pre-setup-* /home
```

### Disable Snapshots

```yaml
create_snapshot: false
```

---

## Troubleshooting

### Decky Not Showing

1. Restart Steam: **Power** > **Restart Steam**
2. Still missing? Re-run Bootible

### SSH Connection Refused

1. Check service: `systemctl status sshd`
2. Check firewall: `sudo firewall-cmd --list-all`
3. Verify port: `ss -tlnp | grep 22`

### Flatpak Install Failed

1. Update Flatpak: `flatpak update`
2. Check Flathub: `flatpak remote-list`
3. Add if missing: `flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo`

### SteamOS Update Broke Things

SteamOS updates can reset system changes. Re-run Bootible:

```bash
bootible
```

---

## Next Steps

<div class="grid cards" markdown>

-   :material-cog:{ .lg .middle } **Role Reference**

    ---

    Detailed documentation of each Ansible role.

    [:octicons-arrow-right-24: Roles](roles.md)

-   :material-format-list-checks:{ .lg .middle } **Configuration**

    ---

    Full list of Steam Deck configuration options.

    [:octicons-arrow-right-24: Config Reference](../../configuration/steam-deck.md)

</div>
