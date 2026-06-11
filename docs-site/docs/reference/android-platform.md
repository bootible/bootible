---
title: Android
description: Configure Android gaming handhelds with Bootible via Wireless ADB
---

# Android <span class="beta-badge">ALPHA</span>

!!! warning "Alpha Feature"
    Android provisioning is currently in **alpha**. Features may change and some functionality is still being tested. Please [report issues](https://github.com/bootible/bootible/issues) if you encounter problems.

Bootible provisions Android gaming handhelds via **Wireless ADB** from a host machine (Linux, macOS, or WSL). Unlike Steam Deck and ROG Ally which run scripts on the device itself, Android provisioning runs from your computer and connects to the Android device over the network.

---

## Supported Devices

| Device | Status |
|--------|--------|
| Retroid Pocket (3/4/5/Mini) | Supported |
| AYANEO Pocket | Supported |
| Odin 2 | Supported |
| Logitech G Cloud | Supported |
| Any Android 11+ device | Should work |

---

## Quick Start

### 1. Enable Wireless Debugging on Android

1. Go to **Settings → About phone** and tap **Build number** 7 times to enable Developer Options
2. Go to **Settings → Developer options**
3. Enable **USB debugging**
4. Enable **Wireless debugging**
5. Tap **Wireless debugging** to see the IP address and port

### 2. Run Bootible from Your Computer

```bash
curl -fsSL https://bootible.dev/android | bash
```

This runs a **dry run** first, showing what would be installed. The script will guide you through:

1. Pairing with your Android device (first time only)
2. Connecting via ADB
3. Showing what would be provisioned

### 3. Apply Configuration

```bash
bootible-android
```

---

## What Gets Installed

### Emulator Frontends

| App | Description |
|-----|-------------|
| **Daijisho** | Modern game launcher with artwork scraping |
| **Pegasus Frontend** | Customizable cross-platform frontend |
| **ES-DE** | EmulationStation Desktop Edition |

### Emulators

| System | Emulator |
|--------|----------|
| Multi-system | RetroArch, Lemuroid |
| Nintendo DS | melonDS |
| Nintendo 3DS | Lime3DS |
| GameCube/Wii | Dolphin |
| PlayStation 1 | DuckStation |
| PlayStation 2 | nethersx2 |
| PSP | PPSSPP |
| Dreamcast | Flycast |

### Streaming Apps

| App | Description |
|-----|-------------|
| **Moonlight** | NVIDIA GameStream client |
| **Steam Link** | Steam Remote Play |
| **Chiaki-ng** | PlayStation Remote Play |

### Utilities

| App | Description |
|-----|-------------|
| **Tailscale** | Mesh VPN for secure access |
| **Termux** | Linux terminal emulator |
| **MiXplorer** | Advanced file manager |

---

## Configuration

Android configuration uses YAML files, similar to other platforms:

```
config/android/
├── config.yml           # Default configuration (100+ apps)
├── Run.sh               # Provisioning engine
└── lib/
    ├── adb-helpers.sh   # ADB wrapper functions
    ├── apk-install.sh   # APK installation logic
    ├── settings.sh      # Settings configuration
    └── files.sh         # File push logic
```

### Per-Device Configuration

Create device-specific configs in your private repo:

```
private/device/android/
├── retroid-5/
│   └── config.yml       # Overrides for this device
└── odin-2/
    └── config.yml
```

### Example Configuration

```yaml
# Enable specific apps
apks:
  retroarch:
    enabled: true
  moonlight:
    enabled: true
  tailscale:
    enabled: true

# Configure system settings
settings:
  global:
    window_animation_scale: "0.5"
    transition_animation_scale: "0.5"
    animator_duration_scale: "0.5"

# Push files to device
files:
  roms:
    enabled: true
    local_path: "android/roms"
    device_path: "/sdcard/RetroArch/roms"
```

---

## APK Sources

Bootible supports three APK sources:

| Source | Description |
|--------|-------------|
| **url** | Direct download from GitHub releases or other URLs |
| **fdroid** | Fetches latest APK from F-Droid repository |
| **local** | Install from local file in your private repo |

---

## Architecture

```
┌─────────────────────┐         ┌─────────────────────┐
│   Host Machine      │         │   Android Device    │
│  (Linux/Mac/WSL)    │         │  (Gaming Handheld)  │
│                     │   ADB   │                     │
│  bootible-android ──┼────────►│  Wireless Debugging │
│                     │         │                     │
│  - Install APKs     │         │  - Receives APKs    │
│  - Push files       │         │  - Settings applied │
│  - Configure        │         │  - Files pushed     │
└─────────────────────┘         └─────────────────────┘
```

---

## Troubleshooting

### Device not found

```bash
# Check ADB connectivity
adb devices

# Reconnect
adb connect <device-ip>:5555
```

### Pairing failed

Ensure Wireless Debugging is enabled and you're entering the correct pairing code from your device.

### APK installation failed

Check that "Install unknown apps" is enabled for ADB:

1. Go to **Settings → Apps → Special app access → Install unknown apps**
2. Enable for **Shell** or **ADB**

---

## Requirements

The bootstrap script will check for and help install:

- `adb` - Android Debug Bridge
- `curl` - HTTP client
- `jq` - JSON parser
- `yq` - YAML parser

---

## Coming Soon

Features planned for future releases:

- [ ] Automatic device discovery on local network
- [ ] Backup/restore of app data
- [ ] ROM organization and scraping
- [ ] Per-game controller profiles
