---
title: Architecture Overview
description: Technical architecture of Bootible's platform implementations
---

# Architecture Overview

<!-- Built in docs plan Task 2 — content extracted from old platforms/index.md -->

This page describes the internal code structure for each platform implementation. For a comparison of what Bootible does on each platform, see [Configure Your Device](../configure/index.md).

---

## Steam Deck (Ansible)

```
targets/deck.sh          # Bootstrap script
config/steamdeck/
├── playbook.yml         # Main Ansible playbook
├── config.yml           # Default configuration
└── roles/
    ├── base/            # Flathub, hostname, SD card
    ├── flatpak_apps/    # Application installation
    ├── ssh/             # SSH server setup
    ├── tailscale/       # VPN configuration
    ├── decky/           # Decky Loader + plugins
    ├── proton/          # Proton-GE, Protontricks
    ├── emulation/       # EmuDeck setup
    └── ...
```

## ROG Ally (PowerShell)

```
targets/ally.ps1         # Bootstrap script
config/rog-ally/
├── Run.ps1              # Main orchestrator
├── config.yml           # Default configuration
├── lib/
│   └── helpers.ps1      # Utility functions
└── modules/
    ├── validate.ps1     # Package validation
    ├── base.ps1         # Hostname, network, winget
    ├── apps.ps1         # Application installation
    ├── gaming.ps1       # Game platforms
    ├── streaming.ps1    # Streaming clients
    ├── ssh.ps1          # OpenSSH server
    ├── optimization.ps1 # Gaming tweaks
    ├── debloat.ps1      # Privacy settings
    └── ...
```

## Android (Bash + ADB) <span class="beta-badge">ALPHA</span>

```
targets/android.sh       # Bootstrap script (runs on host)
config/android/
├── Run.sh               # Provisioning engine
├── config.yml           # Default configuration (100+ apps)
└── lib/
    ├── adb-helpers.sh   # ADB wrapper functions
    ├── apk-install.sh   # APK installation
    ├── settings.sh      # Settings configuration
    └── files.sh         # File push logic
```

!!! note "Host-based provisioning"
    Unlike Steam Deck and ROG Ally, Android provisioning runs **from your computer** and connects to the Android device via Wireless ADB.
