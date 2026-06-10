---
title: ROG Ally Configuration
description: Complete configuration reference for ROG Ally
---

# ROG Ally Configuration Reference

Complete reference for all ROG Ally configuration options.

---

## System

### Backup & Safety

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `create_restore_point` | bool | `true` | Create System Restore point before changes |
| `post_install_health_checks` | bool | `true` | Run health checks after install |

### Hostname

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `hostname` | string | `""` | System hostname (empty = keep current) |

!!! note "Restart Required"
    Hostname changes require a restart to take effect.

### Static IP

```yaml
static_ip:
  enabled: false
  adapter: "Ethernet"     # Or "Wi-Fi"
  address: ""             # IP address, e.g., "192.168.1.101"
  prefix_length: 24       # Subnet prefix (24 = 255.255.255.0)
  gateway: ""             # Gateway IP
  dns:
    - ""                  # Primary DNS
    # - ""                # Secondary DNS
```

Find adapter names with `Get-NetAdapter`.

---

## Package Managers

```yaml
package_managers:
  winget: true       # Always available (built into Windows 11)
  chocolatey: true   # Fallback for some packages
  scoop: false       # User-level package manager
```

---

## Desktop Applications

### Master Switch

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_apps` | bool | `true` | Enable application installation |

### Communication

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_discord` | bool | `false` | Discord |
| `install_signal` | bool | `false` | Signal |

### Media

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_spotify` | bool | `false` | Spotify |
| `install_vlc` | bool | `false` | VLC media player |

### Browsers

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_firefox` | bool | `false` | Firefox |
| `install_chrome` | bool | `false` | Google Chrome |
| `install_edge` | bool | `true` | Microsoft Edge (ensures latest) |

### Productivity

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_obs` | bool | `false` | OBS Studio |
| `install_vscode` | bool | `false` | Visual Studio Code |
| `install_powertoys` | bool | `true` | Microsoft PowerToys |

### Utilities

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_7zip` | bool | `true` | 7-Zip |
| `install_everything` | bool | `true` | Everything search |
| `install_windows_terminal` | bool | `true` | Windows Terminal |
| `install_powershell7` | bool | `true` | PowerShell 7 |

### Password Managers

```yaml
# Install one or more password managers
password_managers:
  - "1password"
  - "bitwarden"
```

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `password_managers` | list | `[]` | Password managers to install |

**Available managers:** `1password`, `bitwarden`, `keepassxc`

---

## Gaming

### Master Switch

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_gaming` | bool | `true` | Enable gaming platforms |

### Platforms

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_steam` | bool | `true` | Steam |
| `install_gog_galaxy` | bool | `false` | GOG Galaxy |
| `install_epic_launcher` | bool | `false` | Epic Games Launcher |
| `install_ea_app` | bool | `false` | EA App |
| `install_ubisoft_connect` | bool | `false` | Ubisoft Connect |
| `install_battle_net` | bool | `false` | Battle.net |
| `install_amazon_games` | bool | `false` | Amazon Games |

### Launchers & Managers

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_playnite` | bool | `false` | Playnite (unified library) |
| `install_launchbox` | bool | `false` | LaunchBox |

### Utilities

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_ds4windows` | bool | `false` | DualShock/DualSense support |
| `install_hidmanager` | bool | `false` | HID device management |
| `install_nexus_mods` | bool | `false` | Vortex mod manager |
| `install_reshade` | bool | `false` | ReShade |

---

## Game Streaming

### Master Switch

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_streaming` | bool | `true` | Enable streaming apps |

### Local Streaming

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_moonlight` | bool | `false` | Moonlight (NVIDIA GameStream) |
| `install_parsec` | bool | `false` | Parsec |
| `install_steam_link` | bool | `false` | Steam Link |

### Console Streaming

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_chiaki` | bool | `false` | Chiaki-ng (PlayStation) |
| `install_greenlight` | bool | `false` | Xbox streaming |

### Cloud Gaming

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_xbox_app` | bool | `true` | Xbox app (Cloud Gaming) |
| `install_geforcenow` | bool | `false` | GeForce NOW |

---

## Remote Access

### Master Switch

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_remote_access` | bool | `false` | Enable remote access tools |

### VPN

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_tailscale` | bool | `false` | Tailscale VPN |
| `install_protonvpn` | bool | `false` | ProtonVPN |

### Remote Desktop

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_anydesk` | bool | `false` | AnyDesk |
| `install_rustdesk` | bool | `false` | RustDesk |
| `install_parsec_remote` | bool | `false` | Parsec (remote desktop) |

---

## SSH

### Master Switch

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_ssh` | bool | `false` | Enable SSH configuration |

### Server

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `ssh_server_enable` | bool | `false` | Enable OpenSSH Server |
| `ssh_import_authorized_keys` | bool | `false` | Import keys from private repo |
| `ssh_authorized_keys` | list | `[]` | Key files to authorize |

### Key Generation

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `ssh_generate_key` | bool | `true` | Generate SSH keypair |
| `ssh_key_name` | string | `""` | Key filename (default: hostname) |
| `ssh_add_to_github` | bool | `true` | Add key to GitHub |
| `ssh_save_to_private` | bool | `true` | Save key to private repo |
| `ssh_configure_git` | bool | `true` | Configure git for SSH |

---

## Emulation

### Master Switch

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_emulation` | bool | `false` | Enable emulation |

### EmuDeck

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_emudeck` | bool | `false` | EmuDeck installer |

### Frontends

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_retroarch` | bool | `false` | RetroArch |
| `install_emulationstation` | bool | `false` | EmulationStation DE |

### Standalone Emulators

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_dolphin` | bool | `false` | Dolphin (GameCube/Wii) |
| `install_pcsx2` | bool | `false` | PCSX2 (PS2) |
| `install_rpcs3` | bool | `false` | RPCS3 (PS3) |
| `install_yuzu` | bool | `false` | Yuzu (Switch) |
| `install_ryujinx` | bool | `false` | Ryujinx (Switch) |
| `install_cemu` | bool | `false` | Cemu (Wii U) |
| `install_duckstation` | bool | `false` | DuckStation (PS1) |
| `install_ppsspp` | bool | `false` | PPSSPP (PSP) |

---

## ROG Ally Specific

### Master Switch

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_rog_ally` | bool | `true` | Enable ROG Ally tools |

### ASUS Software

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_armoury_crate` | bool | `true` | Armoury Crate (usually pre-installed) |
| `install_myasus` | bool | `true` | MyASUS support app |
| `install_ghelper` | bool | `false` | G-Helper — lightweight open-source Armoury Crate alternative (TDP, fans, RGB) |

### Alternative Controllers

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_handheld_companion` | bool | `false` | Handheld Companion |

### Monitoring Tools

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_rtss` | bool | `false` | RivaTuner Statistics Server |
| `install_hwinfo` | bool | `true` | HWiNFO |
| `install_msi_afterburner` | bool | `true` | MSI Afterburner |
| `install_cpuz` | bool | `true` | CPU-Z |
| `install_gpuz` | bool | `true` | GPU-Z |

### Power Management

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `configure_power_plans` | bool | `true` | Configure Windows power plans |
| `sleep_mode` | string | `"default"` | `default` keeps Windows sleep; `hibernate` converts idle/lid sleep to hibernate |
| `hibernate_after_minutes` | int | `0` | Minutes asleep before hibernating (0 = don't change) |
| `power_button_action` | string | `""` | Power button override: `sleep`, `hibernate`, or `shutdown` (empty = keep current) |
| `disable_cpu_boost_on_battery` | bool | `false` | Disable CPU boost on battery only (DC `PERFBOOSTMODE 0`); plugged-in behavior untouched |

---

## System Optimization

### Master Switch

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_optimization` | bool | `true` | Enable optimizations |

### Gaming Tweaks

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `enable_game_mode` | bool | `true` | Windows Game Mode |
| `enable_hardware_gpu_scheduling` | bool | `true` | Hardware GPU Scheduling. AMD frame generation (AFMF) requires this ON; drift-monitored. |
| `disable_fullscreen_optimizations` | bool | `false` | Disable FSO |

### Xbox/Game Bar

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `disable_xbox_game_bar` | bool | `false` | Disable Game Bar |
| `disable_game_dvr` | bool | `true` | Disable Game DVR |

### Performance (Security Trade-offs)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `disable_core_isolation` | bool | `false` | Disable Memory Integrity |
| `disable_vm_platform` | bool | `false` | Disable VM Platform |
| `disable_bitlocker` | bool | `false` | Disable BitLocker |

!!! warning "Security Implications"
    Disabling Core Isolation or VM Platform improves gaming performance but reduces security. Only disable if you understand the risks.

### AMD Display

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `disable_amd_varibright` | bool | `true` | Disable Vari-Bright |

### Steam Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `steam_disable_guide_focus` | bool | `true` | Prevent guide button overlay |
| `steam_start_big_picture` | bool | `true` | Start in Big Picture mode |

### Display

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `configure_hdr` | bool | `false` | HDR settings |
| `set_refresh_rate` | int | `0` | Refresh rate (0 = don't change) |

### Storage & Maintenance

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `enable_storage_sense` | bool | `true` | Auto-cleanup temp files |
| `compact_os` | bool | `false` | Compact OS (saves space) |
| `run_disk_cleanup` | bool | `false` | Run Disk Cleanup |
| `force_time_sync` | bool | `true` | Force NTP sync |
| `generate_battery_report` | bool | `false` | Generate battery report |

### Debloat

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `disable_tips` | bool | `true` | Windows tips |
| `disable_cortana` | bool | `false` | Cortana |

---

## Debloat & Privacy

### Master Switch

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_debloat` | bool | `true` | Enable debloat tweaks |

### Privacy

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `disable_telemetry` | bool | `true` | Windows telemetry |
| `disable_activity_history` | bool | `true` | Activity history |
| `disable_location_tracking` | bool | `true` | Location services |
| `disable_copilot` | bool | `true` | Microsoft Copilot |

### UI Tweaks

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `disable_lockscreen_junk` | bool | `true` | Lock screen ads/tips |
| `classic_right_click_menu` | bool | `true` | Windows 10 context menu |
| `disable_bing_search` | bool | `true` | Bing in Start Menu |
| `show_file_extensions` | bool | `true` | File extensions in Explorer |
| `show_hidden_files` | bool | `false` | Hidden files in Explorer |
| `clean_desktop_shortcuts` | bool | `true` | Remove desktop shortcuts |

### Personalization

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `wallpaper_path` | string | `""` | Custom wallpaper |
| `wallpaper_style` | string | `"Fill"` | Fill, Fit, Stretch, Center, Tile, Span |
| `lockscreen_path` | string | `""` | Custom lock screen |

### Edge

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `debloat_edge` | bool | `true` | Remove Edge bloat |
| `disable_edge` | bool | `true` | Disable Edge completely |

### Network

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `prefer_ipv4` | bool | `true` | Prefer IPv4 over IPv6 |
| `disable_teredo` | bool | `true` | Disable Teredo tunneling |

### Performance

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `set_services_manual` | bool | `true` | Non-essential services to manual |

### PowerShell

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `powershell7_default_terminal` | bool | `true` | PS7 as default terminal |
| `disable_powershell7_telemetry` | bool | `true` | Disable PS7 telemetry |

---

## Development Tools

### Master Switch

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_dev_tools` | bool | `true` | Enable dev tools |

### Tools

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_git` | bool | `true` | Git |
| `install_python` | bool | `true` | Python 3 |
| `install_nodejs` | bool | `true` | Node.js LTS |
| `install_java` | bool | `true` | Eclipse Temurin (OpenJDK) |

---

## System Utilities

### Master Switch

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_system_utilities` | bool | `true` | Enable system utilities |

### Tools

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_revo_uninstaller` | bool | `true` | Revo Uninstaller |
| `install_ccleaner` | bool | `true` | CCleaner |
| `install_wiztree` | bool | `true` | WizTree |
| `install_drivereasy` | bool | `false` | Driver Easy |

---

## Runtimes

### Master Switch

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_runtimes` | bool | `true` | Enable runtime installation |

### Runtimes

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_dotnet_runtime` | bool | `true` | .NET Runtime |
| `install_dotnet_desktop` | bool | `true` | .NET Desktop Runtime |
| `install_vcredist` | bool | `true` | Visual C++ Redistributable |
| `install_directx` | bool | `true` | DirectX End-User Runtime |

---

## Paths

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `user_home` | string | `"%USERPROFILE%"` | User home directory |
| `games_path` | string | `"C:\\Games"` | Games directory |
| `roms_path` | string | `"C:\\Emulation\\ROMs"` | ROMs directory |
| `bios_path` | string | `"C:\\Emulation\\BIOS"` | BIOS directory |

---

## Example Configurations

### Gaming-Focused Setup

```yaml
hostname: "vengeance"

# Gaming platforms
install_steam: true
install_gog_galaxy: true
install_playnite: true

# Streaming
install_moonlight: true
install_chiaki: true

# Optimization
enable_game_mode: true
enable_hardware_gpu_scheduling: true
disable_game_dvr: true
steam_start_big_picture: true

# Debloat
disable_telemetry: true
disable_copilot: true
classic_right_click_menu: true
```

### Full-Featured Setup

```yaml
hostname: "vengeance"
create_restore_point: true

# Apps
install_discord: true
install_spotify: true
password_managers:
  - "1password"

# Gaming
install_steam: true
install_gog_galaxy: true
install_epic_launcher: true
install_playnite: true

# Streaming
install_moonlight: true
install_chiaki: true
install_parsec: true

# Remote access
install_ssh: true
ssh_generate_key: true
ssh_add_to_github: true
install_tailscale: true

# ROG Ally specific
install_rog_ally: true
install_hwinfo: true
install_rtss: true

# Emulation
install_emulation: true
install_emudeck: true

# Optimization
enable_game_mode: true
enable_hardware_gpu_scheduling: true
disable_game_dvr: true
disable_amd_varibright: true

# Debloat
disable_telemetry: true
disable_copilot: true
classic_right_click_menu: true
wallpaper_path: "Images/wallpaper.jpg"
```

### Minimal Gaming Setup

```yaml
hostname: "ally"

# Just gaming essentials
install_steam: true
install_xbox_app: true

# Performance
enable_game_mode: true
disable_game_dvr: true

# Basic debloat
disable_telemetry: true
classic_right_click_menu: true
```
