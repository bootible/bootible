---
title: Configure Your Device
description: Platform-specific configuration guides and comparison for Bootible
---

# Configure Your Device

Bootible supports multiple gaming platforms with platform-specific optimizations and tooling.

---

## Current Platforms

<div class="grid cards" markdown>

-   :material-controller:{ .lg .middle } **Steam Deck**

    ---

    Valve's Linux-based gaming handheld running SteamOS.

    - Ansible-based configuration
    - Flatpak application management
    - Decky Loader plugins
    - Btrfs snapshots for rollback

    [:octicons-arrow-right-24: Steam Deck Guide](../reference/steam-deck-platform.md)

-   :material-laptop:{ .lg .middle } **ROG Ally**

    ---

    ASUS's Windows-based gaming handheld.

    - PowerShell module system
    - Winget package management
    - Windows optimization & debloating
    - System Restore Points

    [:octicons-arrow-right-24: ROG Ally Guide](../reference/rog-ally-platform.md)

-   :material-android:{ .lg .middle } **Android** <span class="beta-badge">ALPHA</span>

    ---

    Android gaming handhelds via Wireless ADB.

    - Retroid Pocket, AYANEO, Odin, Logitech G Cloud
    - APK installation from URLs, F-Droid, or local files
    - System settings configuration
    - File push for ROMs/saves

    [:octicons-arrow-right-24: Android Guide](../reference/android-platform.md)

</div>

---

## Platform Comparison

| Feature | Steam Deck | ROG Ally | Android |
|---------|------------|----------|---------|
| **OS** | SteamOS (Arch Linux) | Windows 11 | Android 11+ |
| **Package Manager** | Flatpak | Winget/Chocolatey | APK (ADB) |
| **Config Language** | YAML (Ansible) | YAML (PowerShell) | YAML (Bash) |
| **Provisioning** | On device | On device | From host via ADB |
| **Emulation** | EmuDeck | EmuDeck | RetroArch, standalone |
| **Remote Play** | Moonlight, Chiaki | Moonlight, Chiaki, Parsec | Moonlight, Chiaki, Steam Link |

---

## How Platform Detection Works

When you run the bootstrap command, Bootible detects your platform from the URL:

```bash
# Steam Deck - downloads deck.sh
curl -fsSL https://bootible.dev/deck | bash

# ROG Ally - downloads ally.ps1
irm https://bootible.dev/rog | iex

# Android - downloads android.sh (run from host machine)
curl -fsSL https://bootible.dev/android | bash
```

The platform determines:

1. **Which configuration template** to use (`config/steamdeck/`, `config/rog-ally/`, or `config/android/`)
2. **Which installer** to run (Ansible playbook, PowerShell runner, or Bash/ADB)
3. **Which package manager** installs applications

---

## Planned Platforms

Future platforms under consideration:

| Platform | OS | Status |
|----------|-----|--------|
| Bazzite | Fedora Atomic | Planned |
| CachyOS | Arch Linux | Planned |
| Windows Desktop | Windows 11 | Planned |
| Legion Go | Windows 11 | Uses ROG Ally config |

!!! tip "Request a Platform"
    Want Bootible support for another device? [Open an issue](https://github.com/bootible/bootible/issues) with your platform details.
