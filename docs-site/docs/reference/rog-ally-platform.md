---
title: ROG Ally
description: Configure your ASUS ROG Ally with Bootible
---

# ROG Ally

Bootible uses PowerShell modules to configure your ROG Ally, installing applications via winget and applying Windows gaming optimizations.

---

## Quick Start

### 1. Open PowerShell as Administrator

Press ++win+x++ and select **Terminal (Admin)** or **PowerShell (Admin)**.

### 2. Run Bootible

```powershell
irm https://bootible.dev/rog | iex
```

This runs a **dry run** first, showing what would change. Then run `bootible` to apply.

---

## What Gets Installed

### Gaming Platforms

| Platform | Package ID |
|----------|------------|
| **Steam** | `Valve.Steam` |
| **GOG Galaxy** | `GOG.Galaxy` |
| **Epic Games** | `EpicGames.EpicGamesLauncher` |
| **EA App** | `ElectronicArts.EADesktop` |
| **Ubisoft Connect** | `Ubisoft.Connect` |
| **Amazon Games** | `Amazon.Games` |
| **Playnite** | `Playnite.Playnite` |

### Applications

| Category | Apps |
|----------|------|
| **Communication** | Discord, Signal |
| **Media** | Spotify, VLC |
| **Browsers** | Firefox, Chrome |
| **Streaming** | Moonlight, Chiaki, Parsec |
| **Productivity** | VS Code, OBS |
| **Utilities** | 7-Zip, Everything, PowerToys |

### System Optimizations

- Windows Game Mode
- Hardware-accelerated GPU Scheduling
- Game DVR/Xbox Game Bar control
- Telemetry reduction
- Classic right-click menu
- ASUS-specific tools

---

## ROG Ally-Specific Tools

| Tool | Description |
|------|-------------|
| **Armoury Crate** | ASUS control center (pre-installed) |
| **MyASUS** | System updates and diagnostics |
| **Handheld Companion** | Alternative controller mapper |
| **RTSS** | Frame rate limiter and OSD |
| **HWiNFO** | Hardware monitoring |

Enable in config:

```yaml
install_rog_ally: true
install_handheld_companion: true
install_rtss: true
install_hwinfo: true
install_ghelper: true   # Lightweight Armoury Crate alternative
install_hidhide: true   # Hide physical gamepad from games (needs reboot)
```

!!! info "Canonical key reference"
    This page shows highlights only. The complete list of every key, type, and
    default lives in the [ROG Ally Configuration Reference](../configure/rog-ally.md).

---

## Windows Optimization

### Gaming Tweaks

```yaml
# Enable Windows Game Mode
enable_game_mode: true

# Hardware-accelerated GPU scheduling
enable_hardware_gpu_scheduling: true

# Disable Xbox Game Bar (less overhead)
disable_game_dvr: true
disable_xbox_game_bar: true

# Steam controller-friendly startup
steam_start_big_picture: true       # Start Steam in Big Picture mode
steam_disable_guide_focus: true     # Stop the Xbox button opening the Steam overlay
```

### Privacy & Debloating

```yaml
# Privacy settings
disable_telemetry: true
disable_activity_history: true
disable_location_tracking: true

# Remove Copilot
disable_copilot: true

# UI improvements
classic_right_click_menu: true
show_file_extensions: true
disable_lockscreen_junk: true
disable_bing_search: true
```

### Performance

```yaml
# Optional - security trade-off
disable_core_isolation: false  # Can improve game performance
disable_vm_platform: false     # Disable Virtual Machine Platform

# Network
prefer_ipv4: true
disable_teredo: true

# Maintenance
run_disk_cleanup: true
force_time_sync: true
```

---

## Game Streaming

### As a Client (Play from PC)

| App | Use Case |
|-----|----------|
| **Moonlight** | Stream from NVIDIA GPU PC |
| **Parsec** | Low-latency streaming |
| **Chiaki-ng** | PlayStation Remote Play |
| **Steam Link** | Stream from any Steam PC |

```yaml
install_streaming: true
install_moonlight: true
install_chiaki: true
install_parsec: true
install_steam_link: true
```

### As a Host (Stream to other devices)

Bootible does not install Sunshine on the Ally — Sunshine belongs on the gaming
PC you stream **from**. To stream from the Ally itself:

```yaml
install_parsec: true    # Parsec also works as a host
```

Or install [Sunshine](https://github.com/LizardByte/Sunshine/releases) manually. See [Game Streaming](../configure/features/streaming.md).

---

## Remote Access

### SSH

Windows OpenSSH server for remote management:

```yaml
install_ssh: true
ssh_server_enable: true
ssh_authorized_keys:
  - "desktop.pub"  # From private/ssh-keys/
```

### Tailscale

Access your ROG Ally from anywhere:

```yaml
install_tailscale: true
```

### RDP

Enable Windows Remote Desktop:

```yaml
enable_rdp: true
```

---

## Emulation

EmuDeck for Windows provides the same all-in-one emulation setup as on Steam Deck:

```yaml
install_emulation: true
```

**Post-Install:**

1. Run EmuDeck from Desktop
2. Choose installation options (EmuDeck configures emulators interactively)
3. Copy ROMs to the folder EmuDeck chooses
4. Use Steam ROM Manager to add to Steam

**Patreon/EA Version:**

Place your download in:

```
private/scripts/EmuDeck EA Windows.bat
```

---

## Network Configuration

### Static IP

```yaml
static_ip:
  enabled: true
  adapter: "Ethernet"  # Find names with Get-NetAdapter
  address: "192.168.1.100"
  prefix_length: 24
  gateway: "192.168.1.1"
  dns:
    - "1.1.1.1"
    - "8.8.8.8"
```

### Hostname

```yaml
hostname: "vengeance"
```

---

## Backup & Recovery

### System Restore Points

Before making changes, Bootible creates a restore point.

To restore if something goes wrong:

1. Search **Create a restore point** in Start
2. Click **System Restore**
3. Select the Bootible restore point
4. Follow the wizard

### Disable Restore Points

```yaml
# Not recommended, but available
create_restore_point: false
```

---

## Troubleshooting

### Winget Not Working

1. Open Microsoft Store > Library > Update all
2. Search for "App Installer" and update it
3. Restart Terminal

### Package Install Failed

Run dry-run to validate packages:

```powershell
cd $env:USERPROFILE\bootible\config\rog-ally
.\Run.ps1 -DryRun
```

Reset winget sources:

```powershell
winget source reset --force
```

### SSH Connection Refused

1. Check service: `Get-Service sshd`
2. Check firewall: `Get-NetFirewallRule -DisplayName "*SSH*"`
3. Start if needed: `Start-Service sshd`

### Debloat Settings Not Applied

Some settings require logout/reboot. UCPD-protected registry keys use a scheduled task that runs at next login.

### Armoury Crate Issues

Bootible doesn't modify Armoury Crate. For issues:

1. Update via MyASUS
2. Reinstall from ASUS support site
3. Check ROG Ally subreddit for known issues

---

## Command Line Usage

All `Run.ps1` commands are run from the bootible checkout:

```powershell
cd $env:USERPROFILE\bootible\config\rog-ally
```

### Dry Run

```powershell
.\Run.ps1 -DryRun
```

### Real Run

```powershell
.\Run.ps1
```

### Specific Modules

```powershell
# Only base and apps
.\Run.ps1 -Tags base,apps
```

There is no skip flag — to skip a module, either pass `-Tags` with every module
you *do* want, or disable it in config (e.g. `install_debloat: false`).

See the [CLI Reference](cli.md) for all parameters and the full tag list.

---

## Next Steps

<div class="grid cards" markdown>

-   :material-cog:{ .lg .middle } **Module Reference**

    ---

    Detailed documentation of each PowerShell module.

    [:octicons-arrow-right-24: Modules](rog-ally-modules.md)

-   :material-format-list-checks:{ .lg .middle } **Configuration**

    ---

    Full list of ROG Ally configuration options.

    [:octicons-arrow-right-24: Config Reference](../configure/rog-ally.md)

</div>
