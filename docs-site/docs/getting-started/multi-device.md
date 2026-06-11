---
title: Multi-Device Setup
description: Manage multiple devices from a single configuration repository
---

# Multi-Device Setup

Configure all your gaming devices—Steam Decks, ROG Allys, Android handhelds, and more—from a single private repository.

---

## How It Works

Each physical device gets its own folder in your private repo:

```
private/
└── device/
    ├── android/
    │   ├── Retroid5/           # Retroid Pocket 5
    │   │   └── config.yml
    │   └── Odin2/              # Odin 2
    │       └── config.yml
    ├── rog-ally/
    │   ├── Vengeance/          # ROG Ally X #1
    │   │   └── config.yml
    │   └── Vixen/              # ROG Ally X #2
    │       └── config.yml
    └── steamdeck/
        ├── GameDeck/           # Steam Deck OLED
        │   └── config.yml
        └── TravelDeck/         # Steam Deck LCD
            └── config.yml
```

When you run Bootible, it detects the platform (from the URL) and prompts you to select which device instance:

```
Multiple configurations found:

  1) Vengeance
  2) Vixen

Select configuration [1-2]:
```

---

## Adding a New Device

!!! info "Where these commands run"
    Run these on any machine with a clone of your **private repo** — your desktop/laptop is easiest, but an existing device works too. The new device picks the config up from git; you never have to create files on it directly.

### Method 1: Using init-private-repo.sh

If this is your first device, run the init script:

```bash
cd ~/bootible
./init-private-repo.sh
```

### Method 2: Manual Creation

For additional devices, create the folder structure manually inside your private repo.

=== "Web editor"

    GitHub's web editor works without cloning. Typing `/` in the filename field creates folders:

    1. In your private repo, click **Add file → Create new file**
    2. In the filename field, type `device/rog-ally/Vixen/config.yml` — each `/` creates a folder
    3. Paste or adapt a config from an existing device (or copy the [default template](https://raw.githubusercontent.com/bootible/bootible/main/config/rog-ally/config.yml))
    4. Commit directly to main — done

    The new device will pick up its config the next time you run Bootible on it.

=== "Terminal"

    Each platform has its own config template — copy the one matching the new device.

    === "Steam Deck"

        ```bash
        # Create device folder
        mkdir -p private/device/steamdeck/TravelDeck/{Logs,Images}

        # Copy config from an existing device of the same platform
        cp private/device/steamdeck/GameDeck/config.yml \
           private/device/steamdeck/TravelDeck/config.yml

        # Or download a fresh template
        curl -fsSL https://raw.githubusercontent.com/bootible/bootible/main/config/steamdeck/config.yml \
          -o private/device/steamdeck/TravelDeck/config.yml
        ```

    === "ROG Ally"

        ```bash
        # Create device folder
        mkdir -p private/device/rog-ally/Vixen/{Logs,Images}

        # Copy config from an existing device of the same platform
        cp private/device/rog-ally/Vengeance/config.yml \
           private/device/rog-ally/Vixen/config.yml

        # Or download a fresh template
        curl -fsSL https://raw.githubusercontent.com/bootible/bootible/main/config/rog-ally/config.yml \
          -o private/device/rog-ally/Vixen/config.yml
        ```

Then customize the config for your new device.

### Commit and Push

The new device folder must reach your private repo's remote before the device can see it:

```bash
cd private
git add device/
git commit -m "Add new device instance"
git push
```

### Run Bootible on the New Device

On the new device, run the platform one-liner and select the new instance when prompted:

=== "Steam Deck"

    ```bash
    curl -fsSL https://bootible.dev/deck | bash
    ```

=== "ROG Ally"

    ```powershell
    irm https://bootible.dev/rog | iex
    ```

The dry run shows what would change; run `bootible` to apply.

---

## Device-Specific vs Shared Configuration

### Device-Specific Settings

Things that typically differ per device:

```yaml
# Hostname
hostname: "travel-deck"

# Hardware-specific
emulation_storage: "sdcard"  # Has SD card
move_shader_cache: true      # Small internal storage

# Location-specific
static_ip:
  enabled: true
  address: "192.168.1.102/24"  # Different IP than other devices
```

### Shared Settings

Things that are usually the same across devices:

```yaml
# Apps you want everywhere
install_discord: true
install_spotify: true
password_managers:
  - "1password"

# Gaming setup
install_moonlight: true
install_chiaki: true

# Common Decky plugins
decky_plugins:
  powertools:
    enabled: true
  protondb_badges:
    enabled: true
```

!!! tip "Copy and modify"
    Start by copying an existing device's config, then adjust the device-specific settings.

---

## Shared Resources

Some files are shared across all devices:

### SSH Keys (`ssh-keys/`)

Public keys for all your devices and computers:

```
ssh-keys/
├── desktop.pub         # Your gaming PC
├── laptop.pub          # Your laptop
├── vengeance.pub       # ROG Ally #1
├── vixen.pub           # ROG Ally #2
├── gamedeck.pub        # Steam Deck #1
└── traveldeck.pub      # Steam Deck #2
```

Each device can authorize whichever keys it needs:

```yaml
# On GameDeck - allow SSH from desktop and laptop
ssh_import_authorized_keys: true
ssh_authorized_keys:
  - "desktop.pub"
  - "laptop.pub"
```

### Scripts (`scripts/`)

Shared scripts like EmuDeck Early Access:

```
scripts/
├── EmuDeck EA SteamOS.desktop.download
└── EmuDeck EA Windows.bat
```

All devices automatically use these if they're present.

---

## Example: Two Steam Decks

You have a primary Steam Deck OLED (GameDeck) and a travel Steam Deck LCD (TravelDeck).

### GameDeck (Primary)

```yaml
# private/device/steamdeck/GameDeck/config.yml

hostname: "gamedeck"

# Full app suite
install_discord: true
install_spotify: true
install_obs: true
install_vscode: true

# Internal storage (512GB OLED)
emulation_storage: "internal"

# Performance plugins
decky_plugins:
  powertools:
    enabled: true
  battery_tracker:
    enabled: true

# Remote access for home network
install_ssh: true
install_tailscale: true
ssh_import_authorized_keys: true
ssh_authorized_keys:
  - "desktop.pub"
```

### TravelDeck (Travel)

```yaml
# private/device/steamdeck/TravelDeck/config.yml

hostname: "traveldeck"

# Minimal apps for travel
install_discord: true
install_spotify: true
# No OBS/VSCode - saves space

# Use SD card (64GB internal)
emulation_storage: "sdcard"
move_shader_cache: true

# Fewer plugins
decky_plugins:
  powertools:
    enabled: true
  # No battery tracker - travels light

# Remote access via Tailscale only
install_tailscale: true
# No SSH - not on trusted networks
```

---

## Example: ROG Ally + Steam Deck

You have an ROG Ally for Windows gaming and a Steam Deck for couch gaming.

### Vengeance (ROG Ally)

```yaml
# private/device/rog-ally/Vengeance/config.yml

hostname: "vengeance"

# Windows-specific
install_gaming: true
install_steam: true
install_xbox_app: true

# Windows streaming
install_parsec: true
install_moonlight: true

# Windows optimization
disable_telemetry: true
disable_copilot: true
classic_right_click_menu: true
```

### GameDeck (Steam Deck)

```yaml
# private/device/steamdeck/GameDeck/config.yml

hostname: "gamedeck"

# Linux gaming
install_decky: true
install_proton_ge: true

# Linux streaming (receive FROM PC)
install_moonlight: true
install_chiaki: true

# Couch gaming focus
decky_plugins:
  steamgriddb:
    enabled: true
  css_loader:
    enabled: true
```

---

## Tips for Multi-Device Management

### Use Descriptive Names

Choose names that help you remember which device is which:

| Good Names | Bad Names |
|------------|-----------|
| `LivingRoom`, `Bedroom`, `Office` | `Deck1`, `Deck2`, `Deck3` |
| `Primary`, `Travel`, `Kids` | `New`, `Old`, `Backup` |
| `Vengeance`, `Vixen` (hostnames) | `A`, `B`, `C` |

### Keep Configs in Sync

When you add a new app to one device, consider if others need it too:

```bash
# See differences between configs
diff private/device/steamdeck/GameDeck/config.yml \
     private/device/steamdeck/TravelDeck/config.yml
```

### Review Logs Together

All device logs are in one repo, making it easy to compare:

```
device/
├── rog-ally/Vengeance/Logs/
├── rog-ally/Vixen/Logs/
├── steamdeck/GameDeck/Logs/
└── steamdeck/TravelDeck/Logs/
```
