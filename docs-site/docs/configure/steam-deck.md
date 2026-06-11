---
title: Steam Deck Configuration
description: Complete configuration reference for Steam Deck
---

# Steam Deck Configuration Reference

Complete reference for all Steam Deck configuration options.

---

## System

### Snapshots & Safety

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `create_snapshot` | bool | `true` | Create btrfs snapshot before changes |

### Hostname

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `hostname` | string | `""` | System hostname (empty = keep current) |

### Static IP

```yaml
static_ip:
  enabled: false          # Enable static IP
  connection: ""          # NetworkManager connection name
  address: ""             # IP with CIDR, e.g., "192.168.1.100/24"
  gateway: ""             # Gateway IP, e.g., "192.168.1.1"
  dns: []                 # DNS servers, e.g., ["1.1.1.1", "8.8.8.8"]
```

Find your connection name with `nmcli con show`.

---

## API Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `github_token` | string | `""` | GitHub token for API calls |

!!! tip "Automatic Authentication"
    If you enable >3 Decky plugins, the bootstrap script automatically shows a QR code for GitHub login. No manual token needed.

---

## Package Managers

```yaml
package_managers:
  flatpak: true    # Recommended - survives SteamOS updates
  pacman: false    # Requires unlocking filesystem, lost on updates
  nix: false       # Survives updates, for advanced users
```

---

## Desktop Applications

### Master Switch

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_flatpak_apps` | bool | `true` | Enable Flatpak app installation |

### Communication

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_discord` | bool | `false` | Discord |
| `install_signal` | bool | `false` | Signal |
| `install_telegram` | bool | `false` | Telegram |
| `install_slack` | bool | `false` | Slack |
| `install_element` | bool | `false` | Element (Matrix) |
| `install_zoom` | bool | `false` | Zoom |

### Media

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_spotify` | bool | `false` | Spotify |
| `install_vlc` | bool | `false` | VLC media player |
| `install_plex` | bool | `false` | Plex |
| `install_jellyfin` | bool | `false` | Jellyfin |

### Browsers

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_firefox` | bool | `false` | Firefox (Flatpak version) |
| `install_chromium` | bool | `false` | Chromium |

### Productivity

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_obs` | bool | `false` | OBS Studio |
| `install_vscode` | bool | `false` | Visual Studio Code |
| `install_libreoffice` | bool | `false` | LibreOffice |
| `install_gimp` | bool | `false` | GIMP |
| `install_thunderbird` | bool | `false` | Thunderbird |

### Utilities

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_flatseal` | bool | `true` | Flatpak permission manager |
| `install_syncthing` | bool | `false` | File sync |
| `install_qbittorrent` | bool | `false` | BitTorrent client |
| `install_filezilla` | bool | `false` | FTP client |
| `install_neovim` | bool | `false` | Neovim editor |

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
| `password_manager_install_method` | string | `"flatpak"` | `flatpak` or `distrobox` |

**Available managers:** `1password`, `bitwarden`, `keepassxc`, `protonpass`

!!! tip "Distrobox for 1Password"
    Use `distrobox` method for 1Password to get full browser integration and SSH agent support.

---

## Remote Access

### SSH

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_ssh` | bool | `false` | Enable SSH configuration |
| `ssh_port` | int | `22` | SSH server port |
| `ssh_import_authorized_keys` | bool | `false` | Import keys from private repo |
| `ssh_authorized_keys` | list | `[]` | Key files to authorize |
| `ssh_generate_key` | bool | `false` | Generate SSH keypair |
| `ssh_key_name` | string | `""` | Key filename (default: hostname) |
| `ssh_add_to_github` | bool | `false` | Add key to GitHub |
| `ssh_save_to_private` | bool | `false` | Save key to private repo |
| `ssh_configure_git` | bool | `false` | Configure git for SSH |

### VPN & Remote Desktop

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_tailscale` | bool | `false` | Tailscale VPN |
| `install_remote_desktop` | bool | `false` | Enable remote desktop |
| `install_sunshine` | bool | `false` | Sunshine streaming host |
| `install_vnc` | bool | `false` | VNC server |
| `install_anydesk` | bool | `false` | AnyDesk |

---

## Gaming Enhancements

### Decky Loader

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_decky` | bool | `true` | Install Decky Loader |

### Decky Plugins

```yaml
decky_plugins:
  powertools:
    enabled: true
    store_name: "PowerTools"
    description: "CPU/GPU control, per-game profiles"
```

Available plugins:

| Plugin Key | Store Name | Description |
|------------|-----------|-------------|
| `powertools` | PowerTools | CPU/GPU control |
| `autosuspend` | AutoSuspend | Auto-suspend on idle |
| `battery_tracker` | Battery Tracker | Battery health |
| `protondb_badges` | ProtonDB Badges | Compatibility ratings |
| `steamgriddb` | SteamGridDB | Custom artwork |
| `hltb` | HLTB for Deck | How Long to Beat |
| `playtime` | PlayTime | Play time tracking |
| `isthereanydeal` | IsThereAnyDeal for Deck | Deal notifications |
| `css_loader` | CSS Loader | Visual themes |
| `animation_changer` | Animation Changer | Boot animations |
| `bluetooth` | Bluetooth | Bluetooth management |
| `tailscale_control` | Tailscale Control | VPN control |
| `kde_connect` | KDE Connect | Phone integration |
| `decky_cloud_save` | Decky Cloud Save | Cloud saves |
| `deckmtp` | DeckMTP | MTP transfer |
| `autoflatpaks` | AutoFlatpaks | Auto-update Flatpaks |
| `discord_status` | Discord Status | Discord presence |
| `decky_notifications` | Decky Notifications | Notifications |
| `magicpods` | MagicPods | AirPods support |

### Proton Tools

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_proton_tools` | bool | `true` | Enable Proton tools |
| `install_protonup_qt` | bool | `true` | Proton version manager |
| `install_proton_ge` | bool | `true` | GloriousEggroll's Proton |
| `install_protontricks` | bool | `true` | Windows component installer |

---

## Game Streaming

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_moonlight` | bool | `false` | Moonlight client |
| `install_chiaki` | bool | `false` | PlayStation Remote Play |
| `install_greenlight` | bool | `false` | Xbox streaming |

---

## Gaming Launchers

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_heroic` | bool | `false` | Epic/GOG launcher |
| `install_lutris` | bool | `false` | Game launcher |
| `install_bottles` | bool | `false` | Wine prefix manager |

---

## Emulation

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_emudeck` | bool | `false` | EmuDeck installer |

---

## Android

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_waydroid` | bool | `false` | Android container |

---

## Controller Utilities

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_stickdeck` | bool | `false` | Use Deck as PC controller |
| `install_cryoutilities` | bool | `false` | Performance tweaks |

---

## SD Card & Storage

| Key | Type | Default | Options |
|-----|------|---------|---------|
| `emulation_storage` | string | `"auto"` | `auto`, `internal`, `sdcard` |
| `move_shader_cache` | bool | `false` | Move cache to SD card |

**Storage Options:**

- `auto`: Use SD card if present, else internal
- `internal`: Always use internal storage
- `sdcard`: Force SD card (fails if none present)

---

## Paths

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `deck_home` | string | `"/home/deck"` | Home directory |

The `emulation_path` is computed automatically based on `emulation_storage`.

---

## Example Configurations

### Minimal Gaming Setup

```yaml
hostname: "gamedeck"

install_discord: true
install_spotify: true

install_decky: true
decky_plugins:
  powertools:
    enabled: true
  protondb_badges:
    enabled: true
```

### Full-Featured Setup

```yaml
hostname: "gamedeck"
create_snapshot: true

# Apps
install_discord: true
install_spotify: true
install_vlc: true
install_firefox: true
password_managers:
  - "1password"
password_manager_install_method: "distrobox"

# Remote Access
install_ssh: true
ssh_generate_key: true
ssh_add_to_github: true
install_tailscale: true

# Decky
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
  hltb:
    enabled: true

# Streaming
install_moonlight: true
install_chiaki: true

# Emulation
install_emudeck: true
emulation_storage: "sdcard"
move_shader_cache: true
```

### Travel/Minimal Setup

```yaml
hostname: "traveldeck"

# Minimal apps
install_discord: true
install_spotify: true

# No SSH - not on trusted networks
install_ssh: false

# Tailscale for secure remote access
install_tailscale: true

# Minimal Decky
install_decky: true
decky_plugins:
  powertools:
    enabled: true

# Use SD card for everything
emulation_storage: "sdcard"
move_shader_cache: true
```
