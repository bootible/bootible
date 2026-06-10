---
title: Private Configuration
description: Set up your own private repository for custom configuration
---

# Private Configuration

Store your personal Bootible configuration in a private GitHub repository. This keeps your settings secure, synced across devices, and version-controlled.

---

## Why Use a Private Repo?

| Without Private Repo | With Private Repo |
|---------------------|-------------------|
| Default settings only | Fully customized setup |
| Logs saved locally | Logs synced to GitHub |
| Manual config each device | Same config across all devices |
| No version history | Full git history of changes |

---

## Quick Setup

### 1. Create a Private Repository

Go to [github.com/new](https://github.com/new) and create a new repository:

- **Repository name**: Something like `gaming`, `bootible-config`, or `dotfiles`
- **Visibility**: :material-lock: **Private** (recommended)
- **Initialize**: Leave empty (Bootible will set it up)

### 2. Run the Init Script

On any machine with Bootible cloned:

```bash
cd ~/bootible
./init-private-repo.sh
```

This interactive script will:

1. Ask which device type you're configuring
2. Ask for a name for this device
3. Create the proper folder structure
4. Pull the latest config template
5. Initialize a git repository

### 3. Push to GitHub

```bash
cd private
git remote add origin git@github.com:YOUR_USER/YOUR_REPO.git
git push -u origin main
```

### 4. Customize Your Config

Edit your device configuration:

```bash
# For Steam Deck
nano private/device/steamdeck/MyDeck/config.yml

# For ROG Ally
nano private/device/rog-ally/MyAlly/config.yml
```

---

## Repository Structure

After setup, your private repo will look like this:

```
private/
├── device/
│   ├── rog-ally/
│   │   └── MyRogAlly/              # Your device name
│   │       ├── config.yml          # Device configuration
│   │       ├── Images/             # Wallpapers, avatars
│   │       └── Logs/               # Run logs (auto-pushed)
│   └── steamdeck/
│       └── MySteamDeck/
│           ├── config.yml
│           ├── Images/
│           └── Logs/
├── scripts/                        # Shared scripts (EmuDeck EA, etc.)
├── ssh-keys/                       # SSH public keys
└── README.md
```

### Key Directories

| Directory | Purpose |
|-----------|---------|
| `device/<platform>/<name>/` | Per-device configuration and files |
| `scripts/` | Shared scripts across all devices |
| `ssh-keys/` | SSH public keys for all devices |

---

## Configuration File

Each device has a `config.yml` that overrides defaults:

=== "Steam Deck Example"

    ```yaml
    # private/device/steamdeck/MySteamDeck/config.yml

    # Apps
    install_discord: true
    install_spotify: true
    password_managers:
      - "1password"
    password_manager_install_method: "distrobox"

    # Streaming
    install_moonlight: true
    install_chiaki: true

    # Decky Plugins
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

    # Remote Access
    install_ssh: true
    ssh_generate_key: true
    ssh_add_to_github: true
    install_tailscale: true
    ```

=== "ROG Ally Example"

    ```yaml
    # private/device/rog-ally/MyRogAlly/config.yml

    # Apps
    install_discord: true
    install_spotify: true
    password_managers:
      - "1password"

    # Gaming
    install_steam: true
    install_playnite: true

    # Streaming
    install_moonlight: true
    install_chiaki: true
    install_parsec: true

    # Optimization
    disable_telemetry: true
    disable_copilot: true
    disable_game_dvr: true
    classic_right_click_menu: true

    # Remote Access
    install_ssh: true
    ssh_server_enable: true
    install_tailscale: true
    ```

---

## Adding Files

### Wallpapers & Images

Place images in your device's `Images/` folder:

```
device/rog-ally/MyRogAlly/Images/
├── wallpaper.jpg
├── lockscreen.jpg
└── avatar.png
```

Then reference them in your config:

```yaml
wallpaper_path: "Images/wallpaper.jpg"
lockscreen_path: "Images/lockscreen.jpg"
```

### EmuDeck Early Access

If you have EmuDeck Patreon access, place the scripts in `scripts/`:

| Platform | File |
|----------|------|
| Steam Deck | `EmuDeck EA SteamOS.desktop.download` |
| ROG Ally | `EmuDeck EA Windows.bat` |

Bootible automatically uses EA versions if found.

### SSH Keys

Place SSH public keys in `ssh-keys/`:

```
ssh-keys/
├── desktop.pub
├── laptop.pub
└── vengeance.pub
```

Then configure which keys to authorize:

```yaml
ssh_import_authorized_keys: true
ssh_authorized_keys:
  - "desktop.pub"
  - "laptop.pub"
```

---

## Using Your Private Repo

When you run Bootible, it will prompt for your private repo:

```
Do you have a private configuration repository? [y/N] y
Enter your private repo (e.g., username/repo): myuser/gaming
```

!!! tip "GitHub Authentication"
    Bootible uses GitHub Device Flow for authentication. A QR code appears that you can scan with your phone—no typing on the on-screen keyboard needed.

---

## Syncing Changes

### Editing Config

1. Edit your config file:
   ```bash
   nano ~/bootible/private/device/steamdeck/MySteamDeck/config.yml
   ```

2. Commit and push:
   ```bash
   cd ~/bootible/private
   git add -A
   git commit -m "Enable Discord and Moonlight"
   git push
   ```

3. Run Bootible to apply:
   ```bash
   bootible
   ```

### Run Logs

Bootible automatically pushes run logs to your private repo:

```
device/steamdeck/MySteamDeck/Logs/
├── 2025-01-08_143022_mysteamdeck_run.log
├── 2025-01-07_091544_mysteamdeck_dryrun.log
└── ...
```

These logs are invaluable for debugging and seeing what changed over time.

---

## Security Notes

!!! warning "Keep it private"
    Your config repo should be **private** on GitHub. It may contain:

    - SSH key references
    - Device names and hostnames
    - Your personal preferences

!!! danger "Never commit secrets"
    Never put these in your config:

    - Passwords
    - API tokens
    - Private SSH keys (only `.pub` files!)

    If you need a GitHub token, use the QR code authentication instead.
