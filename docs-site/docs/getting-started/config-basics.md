---
title: Config Basics
description: How Bootible configuration works - file layers, precedence, structure, and validation
---

# Config Basics

Bootible uses YAML configuration files to define what gets installed and configured on your device.

---

## Configuration Hierarchy

Configuration is loaded in this priority order (later overrides earlier):

```
1. Default config       config/<platform>/config.yml
2. Local config         ~/.config/bootible/<platform>/config.yml
3. Private repo config  private/device/<platform>/<instance>/config.yml
```

!!! note "Fine print: the first one-liner run on Windows"
    On Windows, the initial bootstrap hands the setup script an explicit config (the private instance it selected, or the defaults), which bypasses the local `~/.config` layer. The local layer applies on every `bootible` run after that. On Steam Deck, the local layer applies on every run including the first.

---

## Where your config lives on each device

Your private repo is cloned alongside Bootible itself:

=== "ROG Ally / Windows"

    ```
    %USERPROFILE%\bootible\private\device\rog-ally\<DeviceName>\config.yml
    ```

    Local (no-GitHub) config: `%USERPROFILE%\.config\bootible\rog-ally\config.yml`

=== "Steam Deck"

    ```
    ~/bootible/private/device/steamdeck/<DeviceName>/config.yml
    ```

    Local (no-GitHub) config: `~/.config/bootible/steamdeck/config.yml`

---

## Configuration Files

### Default Configuration

The default configuration lives in the Bootible repository:

```
config/
├── android/
│   └── config.yml      # Android defaults
├── steamdeck/
│   └── config.yml      # Steam Deck defaults
└── rog-ally/
    └── config.yml      # ROG Ally defaults
```

**Don't edit these directly** unless you've forked the repo. Use a private config instead.

### Private Configuration

Your personal overrides live in your private repository:

```
private/device/
├── android/
│   └── MyAndroid/
│       └── config.yml  # Your Android config
├── steamdeck/
│   └── MySteamDeck/
│       └── config.yml  # Your Steam Deck config
└── rog-ally/
    └── MyRogAlly/
        └── config.yml  # Your ROG Ally config
```

You only need to include settings you want to change from defaults.

---

## Configuration Structure

Both platforms use similar structure organized by category:

```yaml
# =============================================================================
# SYSTEM
# =============================================================================
hostname: "my-device"
create_snapshot: true  # or create_restore_point on Windows

# =============================================================================
# APPLICATIONS
# =============================================================================
install_discord: true
install_spotify: true

# =============================================================================
# GAMING
# =============================================================================
install_steam: true

# ... and so on
```

---

## Platform-Specific References

<div class="grid cards" markdown>

-   :material-android:{ .lg .middle } **Android** <span class="beta-badge">ALPHA</span>

    ---

    Full reference for Android configuration options.

    [:octicons-arrow-right-24: Android Config](../configure/android.md)

-   :fontawesome-brands-steam:{ .lg .middle } **Steam Deck**

    ---

    Full reference for Steam Deck configuration options.

    [:octicons-arrow-right-24: Steam Deck Config](../configure/steam-deck.md)

-   :material-laptop:{ .lg .middle } **ROG Ally**

    ---

    Full reference for ROG Ally configuration options.

    [:octicons-arrow-right-24: ROG Ally Config](../configure/rog-ally.md)

</div>

---

## Common Patterns

### Enabling/Disabling Features

Most features use `install_*` or `enable_*` boolean keys:

```yaml
# Enable a feature
install_discord: true

# Disable a feature
install_discord: false
```

### Nested Configuration

Some features have sub-options:

```yaml
# Static IP configuration
static_ip:
  enabled: true
  address: "192.168.1.100/24"
  gateway: "192.168.1.1"
  dns:
    - "1.1.1.1"
    - "8.8.8.8"
```

### Lists

Lists are specified with `-` prefix:

```yaml
ssh_authorized_keys:
  - "desktop.pub"
  - "laptop.pub"
```

### Choices/Enums

Some options accept specific values:

```yaml
# Install one or more password managers: "1password", "bitwarden", "keepassxc", "protonpass"
password_managers:
  - "1password"

# Must be one of: "auto", "internal", "sdcard"
emulation_storage: "auto"
```

---

## Validation

Bootible validates your configuration before running. Invalid values cause clear error messages:

```
═══════════════════════════════════════════════════════════════
                    CONFIGURATION ERRORS FOUND
═══════════════════════════════════════════════════════════════

The following configuration values have incorrect types:

  - ssh_port: expected int, got string ('22')
  - install_discord: expected bool, got string ('yes')

Fix the above errors in your config.yml before continuing.
```

### Common Mistakes

| Wrong | Correct | Issue |
|-------|---------|-------|
| `ssh_port: "22"` | `ssh_port: 22` | Port should be number, not string |
| `install_discord: yes` | `install_discord: true` | Use `true`/`false`, not `yes`/`no` |
| `password_managers: ["1Password"]` | `password_managers: ["1password"]` | Use exact lowercase values |

---

## Example Configurations

### Minimal Config

A minimal private config might look like:

```yaml
# private/device/steamdeck/MySteamDeck/config.yml

# Just the things I want different from defaults
hostname: "mysteamdeck"

# Apps I want
install_discord: true
install_spotify: true
install_moonlight: true

# Decky plugins I want enabled
decky_plugins:
  css_loader:
    enabled: true
  hltb:
    enabled: true
```

Everything else uses defaults.

### Full Config

For complete examples with all available options, see the default configuration files:

- [Android config.yml](https://github.com/bootible/bootible/blob/main/config/android/config.yml)
- [Steam Deck config.yml](https://github.com/bootible/bootible/blob/main/config/steamdeck/config.yml)
- [ROG Ally config.yml](https://github.com/bootible/bootible/blob/main/config/rog-ally/config.yml)

---

## Applying changes

The loop is: **edit → commit → push → run `bootible`**.

1. Edit your device's `config.yml` — in the GitHub web editor or directly on the device.
2. If you edited on GitHub: commit, then re-run the one-liner on the device so it pulls your changes (answer `y` and the same `owner/repo` at the prompt). If you edited the file on the device, skip this step.
3. Run `bootible` to apply.

The same loop repairs settings that drift after a Windows update — details in [Re-running & Drift](../post-install/re-running.md).
