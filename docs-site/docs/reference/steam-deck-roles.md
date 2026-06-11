---
title: Ansible Roles
description: Reference documentation for Steam Deck Ansible roles
---

# Steam Deck Ansible Roles

Bootible uses Ansible roles to configure your Steam Deck. Each role handles a specific aspect of the setup.

---

## Role Execution Order

Roles execute in this order (defined in `playbook.yml`):

```
1. base          # Foundation: Flathub, hostname, SD card
2. flatpak_apps  # Desktop applications
3. ssh           # SSH server configuration
4. tailscale     # VPN setup
5. remote_desktop # Sunshine/Moonlight
6. decky         # Decky Loader + plugins
7. proton        # Proton-GE, Protontricks
8. emulation     # EmuDeck setup
9. stickdeck     # Steam Deck as controller
10. waydroid     # Android apps
11. distrobox    # Container-based apps
```

---

## base

**Purpose:** System foundation and prerequisites

**Config Keys:**

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `hostname` | string | - | System hostname |
| `static_ip.enabled` | bool | `false` | Enable static IP |
| `static_ip.address` | string | - | IP address with CIDR |
| `static_ip.gateway` | string | - | Default gateway |
| `static_ip.dns` | list | - | DNS servers |
| `move_shader_cache` | bool | `false` | Move shader cache to SD card |

**What It Does:**

1. Verifies sudo access is working
2. Sets hostname if specified
3. Configures static IP via NetworkManager
4. Adds Flathub repository
5. Updates existing Flatpak apps
6. Detects SD card and sets facts for other roles
7. Optionally moves shader cache to SD card

**SD Card Detection:**

The role looks for SD cards at:

- `/run/media/mmcblk0p1` (unlabeled)
- `/run/media/deck/<label>` (labeled)

Sets these facts for other roles:

```yaml
sdcard_present: true/false
sdcard_writable: true/false
sdcard_path: "/run/media/..."
```

---

## flatpak_apps

**Purpose:** Desktop application installation via Flatpak

**Config Key:** `install_flatpak_apps` (default: `true`)

**Application Keys:**

| Key | Flatpak ID | Category |
|-----|------------|----------|
| `install_discord` | `com.discordapp.Discord` | Communication |
| `install_signal` | `org.signal.Signal` | Communication |
| `install_telegram` | `org.telegram.desktop` | Communication |
| `install_spotify` | `com.spotify.Client` | Media |
| `install_vlc` | `org.videolan.VLC` | Media |
| `install_plex` | `tv.plex.PlexDesktop` | Media |
| `install_firefox` | `org.mozilla.firefox` | Browser |
| `install_chromium` | `org.chromium.Chromium` | Browser |
| `install_obs` | `com.obsproject.Studio` | Productivity |
| `install_vscode` | `com.visualstudio.code` | Development |
| `install_moonlight` | `com.moonlight_stream.Moonlight` | Streaming |
| `install_chiaki` | `re.chiaki.Chiaki4deck` | Streaming |
| `install_heroic` | `com.heroicgameslauncher.hgl` | Gaming |
| `install_lutris` | `net.lutris.Lutris` | Gaming |
| `install_bottles` | `com.usebottles.bottles` | Gaming |

**Idempotency:** Yes - Flatpak checks if apps are installed before attempting install.

---

## ssh

**Purpose:** SSH server for remote access

**Config Keys:**

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_ssh` | bool | `true` | Enable SSH role |
| `ssh_port` | int | `22` | SSH server port |
| `ssh_generate_key` | bool | `false` | Generate new SSH key |
| `ssh_key_name` | string | `id_ed25519` | Key filename |
| `ssh_add_to_github` | bool | `false` | Add key to GitHub |
| `ssh_import_authorized_keys` | bool | `false` | Import from private repo |
| `ssh_authorized_keys` | list | `[]` | Key files to import |
| `ssh_configure_git` | bool | `false` | Configure git to use SSH |

**What It Does:**

1. Enables and starts sshd service
2. Optionally generates SSH keypair
3. Imports authorized keys from `private/ssh-keys/`
4. Can add public key to GitHub via API
5. Configures firewall for SSH access

**Example:**

```yaml
install_ssh: true
ssh_generate_key: true
ssh_add_to_github: true
ssh_import_authorized_keys: true
ssh_authorized_keys:
  - "desktop.pub"
  - "laptop.pub"
```

---

## tailscale

**Purpose:** Tailscale VPN for secure remote access

**Config Key:** `install_tailscale` (default: `false`)

**What It Does:**

1. Installs Tailscale via Flatpak
2. Enables the Tailscale service
3. Provides instructions for authentication

**Post-Install:**

```bash
# Authenticate with Tailscale
tailscale up

# Check status
tailscale status
```

---

## remote_desktop

**Purpose:** Remote desktop and game streaming host

**Config Keys:**

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_remote_desktop` | bool | `false` | Enable role |
| `install_sunshine` | bool | `false` | Sunshine streaming host |
| `install_vnc` | bool | `false` | VNC server |

**Sunshine:**

Sunshine lets you stream your Steam Deck to:

- Moonlight clients
- Other Steam Decks
- Phones/tablets

After install, access web UI at `https://localhost:47990` to pair devices.

---

## decky

**Purpose:** Decky Loader and Gaming Mode plugins

**Config Keys:**

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_decky` | bool | `true` | Install Decky Loader |
| `github_token` | string | - | Avoid API rate limits |
| `decky_plugins` | dict | - | Plugin configuration |

**Plugin Configuration:**

```yaml
decky_plugins:
  powertools:
    enabled: true
    description: "CPU/GPU power management"
  protondb_badges:
    enabled: true
    description: "ProtonDB compatibility ratings"
  steamgriddb:
    enabled: true
    description: "Custom game artwork"
  css_loader:
    enabled: true
    description: "Visual themes"
  hltb:
    enabled: true
    description: "How Long to Beat times"
  autosuspend:
    enabled: false
    description: "Auto-suspend on idle"
```

**Plugin Categories:**

| Category | Plugins |
|----------|---------|
| **Performance** | PowerTools, AutoSuspend, Battery Tracker |
| **Game Info** | ProtonDB Badges, HLTB, IsThereAnyDeal, PlayTime |
| **Customization** | CSS Loader, Animation Changer, SteamGridDB |
| **Connectivity** | Bluetooth, Tailscale Control, KDE Connect |
| **Sync** | Decky Cloud Save, DeckMTP, AutoFlatpaks |

**Rate Limiting:**

GitHub API limits unauthenticated requests. If installing 4+ plugins, add a token:

```yaml
github_token: "ghp_your_token_here"
```

Create at [github.com/settings/tokens](https://github.com/settings/tokens) (no permissions needed).

---

## proton

**Purpose:** Windows game compatibility tools

**Config Keys:**

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_proton_tools` | bool | `true` | Enable role |
| `install_protonup_qt` | bool | `true` | Proton version manager |
| `install_protontricks` | bool | `true` | Windows component installer |
| `install_proton_ge` | bool | `true` | GloriousEggroll's Proton |

**What It Does:**

1. **ProtonUp-Qt**: GUI for managing Proton versions
2. **Protontricks**: Install Windows components (vcrun, .NET, etc.)
3. **Proton-GE**: Downloads latest GloriousEggroll Proton

**Proton-GE Benefits:**

- Additional game fixes
- Media codec support (cutscenes)
- Faster updates than official Proton

**Using Proton-GE:**

1. Right-click game > Properties
2. Compatibility > Force specific compatibility tool
3. Select GE-Proton version

---

## emulation

**Purpose:** EmuDeck emulation setup

**Config Keys:**

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_emudeck` | bool | `false` | Enable EmuDeck |
| `emulation_storage` | string | `auto` | `internal`, `sdcard`, `auto` |

**What It Does:**

1. Creates emulation directory structure
2. Downloads EmuDeck installer (or uses Patreon version)
3. Places shortcut on Desktop

**Storage Options:**

| Value | Behavior |
|-------|----------|
| `auto` | SD card if present, else internal |
| `sdcard` | Force SD card (fails if none) |
| `internal` | Force internal storage |

**Patreon/EA Version:**

Place your Patreon download in:

```
private/scripts/EmuDeck EA SteamOS.desktop.download
```

Bootible will use it instead of the public version.

**Post-Install:**

EmuDeck must be run interactively:

1. Switch to Desktop Mode
2. Double-click EmuDeck on Desktop
3. Choose Easy Mode or Custom Mode
4. Select emulators and options

---

## stickdeck

**Purpose:** Use Steam Deck as wireless controller for PC

**Config Key:** `install_stickdeck` (default: `false`)

Installs StickDeck, which turns your Steam Deck into a controller for your PC. Useful for couch gaming on a TV connected to a PC.

---

## waydroid

**Purpose:** Android apps on Steam Deck

**Config Key:** `install_waydroid` (default: `false`)

**What It Does:**

1. Installs Waydroid container
2. Downloads Android image
3. Configures for Gaming Mode

**Post-Install:**

Initialize Waydroid:

```bash
sudo waydroid init -s GAPPS  # With Google Play
# or
sudo waydroid init            # Without Google Play
```

Launch from Gaming Mode library.

---

## distrobox

**Purpose:** Container-based applications

**Config Key:** `password_manager_install_method: "distrobox"`

Runs desktop apps in containers for better integration than Flatpak sandboxing.

**Use Case:** 1Password with browser integration works better via Distrobox than Flatpak.

```yaml
password_managers:
  - "1password"
password_manager_install_method: "distrobox"
```

---

## Selective Role Execution

Run specific roles using Ansible tags:

```bash
# Only SSH and Tailscale
ansible-playbook playbook.yml --tags "ssh,tailscale" --ask-become-pass

# Skip Decky plugins
ansible-playbook playbook.yml --skip-tags "decky" --ask-become-pass
```

Available tags match role names plus: `always`, `apps`, `remote`, `gaming`.
