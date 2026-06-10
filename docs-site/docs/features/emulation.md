---
title: Emulation
description: Set up retro gaming on your handheld
---

# Emulation

Play classic games from retro consoles on your gaming handheld.

---

## EmuDeck: The All-in-One Solution

[EmuDeck](https://www.emudeck.com/) is the recommended way to set up emulation. It downloads, configures, and optimizes emulators automatically for your device.

### Enable EmuDeck

=== "Steam Deck"

    ```yaml
    install_emudeck: true
    emulation_storage: "sdcard"  # Recommended - save internal space
    ```

=== "ROG Ally"

    ```yaml
    install_emulation: true
    ```

    The single `install_emulation` key gates the EmuDeck install on Windows.

### Patreon/Early Access Version

If you have EmuDeck Patreon access, place your installer in:

```
private/scripts/EmuDeck EA SteamOS.desktop.download  # Steam Deck
private/scripts/EmuDeck EA Windows.bat               # ROG Ally
```

Bootible will use the EA version automatically.

### After Bootible Runs

EmuDeck requires interactive setup:

1. Switch to Desktop Mode (Steam Deck) or open EmuDeck (Windows)
2. Run the EmuDeck installer
3. Choose **Easy Mode** (recommended) or **Custom Mode**
4. Select which emulators to install
5. Wait for download and configuration

---

## Storage Location

### Steam Deck

| Option | Use When |
|--------|----------|
| `emulation_storage: "auto"` | SD card if present, else internal |
| `emulation_storage: "sdcard"` | Always use SD card |
| `emulation_storage: "internal"` | Always use internal storage |

**Recommendation:** Use SD card. ROMs and saves can use 100GB+.

### ROG Ally

EmuDeck chooses and configures its own storage locations during its interactive setup — Bootible doesn't configure EmuDeck.

Separately, Bootible can pre-create game/ROM directories for you (directory scaffolding only — both default to `""`, meaning nothing is created):

```yaml
games_path: "D:\\Games"          # e.g. secondary drive
roms_path: "D:\\Emulation\\ROMs"
```

See the [ROG Ally Configuration Reference](../configuration/rog-ally.md) for details.

---

## Documentation & Support

For detailed guides on ROM management, BIOS files, hotkeys, and emulator-specific settings:

- [EmuDeck Wiki](https://emudeck.github.io/): Complete documentation
- [EmuDeck Discord](https://discord.gg/b9F7GpXtFP): Community support
- [Emulation Wiki](https://emulation.gametechwiki.com/): General emulation reference

---

## Decky Plugins for Emulation

=== "Steam Deck Only"

    | Plugin | Purpose |
    |--------|---------|
    | **PowerTools** | Per-game TDP and GPU limits |
    | **SteamGridDB** | Fix missing game artwork |
