---
title: Android Configuration
description: Complete configuration reference for Android gaming handhelds
---

# Android Configuration Reference <span class="beta-badge">ALPHA</span>

Complete reference for all Android configuration options.

!!! warning "Alpha Feature"
    Android provisioning is in alpha. Configuration options may change.

---

## Connection

### Wireless ADB

```yaml
connection:
  method: wireless          # wireless or usb
  ip: ""                    # Device IP (leave empty for runtime discovery)
  port: 5555                # ADB port (default: 5555)
  pairing_port: ""          # For auto-pair (optional)
  pairing_code: ""          # For auto-pair (optional)
```

---

## APK Installation

### Global Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `install_apks` | bool | `true` | Enable/disable APK installation |

### APK Sources

Each app supports three source types:

| Source | Description |
|--------|-------------|
| `url` | Direct download from URL (GitHub releases, etc.) |
| `fdroid` | Fetch latest from F-Droid repository |
| `local` | Install from local file in private repo |

### APK Configuration

```yaml
apks:
  retroarch:
    enabled: false           # Enable/disable this app
    source: fdroid           # url, fdroid, or local
    package_name: "org.libretro.RetroArch"  # Android package name

  moonlight:
    enabled: false
    source: url
    url: "https://github.com/moonlight-stream/moonlight-android/releases/latest/download/Moonlight.apk"
    package_name: "com.limelight"
    grant_permissions: []    # Permissions to auto-grant

  custom_app:
    enabled: false
    source: local
    local_path: "android/apks/MyApp.apk"  # Relative to private/
    package_name: "com.example.myapp"
```

### Available Apps

See `config/android/config.yml` for the complete list of 100+ pre-configured apps including:

- **Emulator Frontends**: Daijisho, Pegasus, ES-DE, LaunchBox
- **Emulators**: RetroArch, Dolphin, PPSSPP, DuckStation, melonDS, etc.
- **Streaming**: Moonlight, Steam Link, Chiaki-ng, Parsec
- **Utilities**: Tailscale, Termux, MiXplorer, ZArchiver
- **And many more...**

---

## System Settings

### Global Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `configure_settings` | bool | `true` | Enable/disable settings configuration |

### Settings Namespaces

Android settings are organized into three namespaces:

```yaml
settings:
  system:
    # UI settings
    screen_off_timeout: ""     # Screen timeout in ms (empty = don't change)

  secure:
    # Security settings
    install_non_market_apps: ""  # Allow unknown sources

  global:
    # Animation and performance
    window_animation_scale: ""      # 0, 0.5, 1, etc.
    transition_animation_scale: ""
    animator_duration_scale: ""
```

### Common Settings

#### Disable Animations (Performance)

```yaml
settings:
  global:
    window_animation_scale: "0"
    transition_animation_scale: "0"
    animator_duration_scale: "0"
```

#### Keep Screen On

```yaml
settings:
  system:
    screen_off_timeout: "2147483647"  # Max value (~24 days)
```

---

## File Push

### Global Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `push_files` | bool | `true` | Enable/disable file pushing |

### File Configuration

```yaml
files:
  roms:
    enabled: false
    local_path: "android/roms"           # Relative to private/
    device_path: "/sdcard/RetroArch/roms"

  saves:
    enabled: false
    local_path: "android/saves"
    device_path: "/sdcard/RetroArch/saves"

  custom:
    - enabled: false
      local_path: "android/configs/retroarch.cfg"
      device_path: "/sdcard/RetroArch/config/retroarch.cfg"
```

---

## Shell Commands

Execute arbitrary ADB shell commands before or after provisioning.

```yaml
execute_commands: true

commands:
  pre:
    - "echo 'Starting provisioning'"
    # Commands run before APK installation

  post:
    - "echo 'Provisioning complete'"
    # Commands run after everything else
```

---

## Device Profiles

Pre-configured profiles for specific devices:

| Profile | Device |
|---------|--------|
| `retroid_pocket` | Retroid Pocket 3/4/5/Mini |
| `ayaneo` | AYANEO Pocket devices |
| `odin` | Odin 2 and variants |
| `logitech_g_cloud` | Logitech G Cloud |
| `generic` | Generic Android device |

```yaml
device_profile: ""  # Leave empty to skip profile defaults
```

---

## Per-Device Configuration

Create device-specific configs in your private repo:

```
private/device/android/
├── retroid-5/
│   ├── config.yml       # Overrides for this device
│   ├── apks/            # Local APK files
│   └── Logs/            # Provisioning logs
└── odin-2/
    └── config.yml
```

### Example Device Config

```yaml
# private/device/android/retroid-5/config.yml

# Override connection for this specific device
connection:
  ip: "192.168.1.150"

# Enable specific apps for this device
apks:
  retroarch:
    enabled: true
  daijisho:
    enabled: true
  moonlight:
    enabled: true

# Disable animations for better performance
settings:
  global:
    window_animation_scale: "0.5"
    transition_animation_scale: "0.5"
    animator_duration_scale: "0.5"
```

---

## Full Example

```yaml
# connection
connection:
  method: wireless
  port: 5555

# APKs to install
install_apks: true
apks:
  retroarch:
    enabled: true
  daijisho:
    enabled: true
  moonlight:
    enabled: true
  tailscale:
    enabled: true

# System settings
configure_settings: true
settings:
  global:
    window_animation_scale: "0.5"
    transition_animation_scale: "0.5"
    animator_duration_scale: "0.5"

# File push
push_files: true
files:
  roms:
    enabled: true
    local_path: "android/roms"
    device_path: "/sdcard/RetroArch/roms"

# Post-install commands
execute_commands: true
commands:
  post:
    - "am start -n com.daijishou.daijishou/.MainActivity"
```
