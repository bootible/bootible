---
title: Decky Loader
description: Enhance Gaming Mode with plugins
---

# Decky Loader

Decky Loader adds a plugin system to Gaming Mode on Steam Deck, letting you customize and enhance your experience.

---

## What is Decky?

Decky Loader is a homebrew plugin framework that:

- Adds features Steam doesn't include
- Works entirely within Gaming Mode
- Plugins install from a built-in store
- Easy to use, no technical knowledge needed

---

## Accessing Decky

1. In Gaming Mode, press the **...** button (Quick Access Menu)
2. Scroll to the bottom
3. Look for the **plug icon** (Decky tab)

If you don't see it, restart Steam: **Power button > Restart Steam**

---

## Enabling Plugins

Configure which plugins to install in your config:

```yaml
install_decky: true

decky_plugins:
  powertools:
    enabled: true
    store_name: "PowerTools"
    description: "CPU/GPU control"

  protondb_badges:
    enabled: true
    store_name: "ProtonDB Badges"
    description: "Compatibility ratings"

  css_loader:
    enabled: true
    store_name: "CSS Loader"
    description: "Visual themes"
```

---

## Recommended Plugins

### Essential

| Plugin | What It Does |
|--------|--------------|
| **PowerTools** | Control CPU/GPU, TDP limits, per-game profiles |
| **ProtonDB Badges** | Show compatibility ratings in your library |

### Customization

| Plugin | What It Does |
|--------|--------------|
| **CSS Loader** | Apply visual themes to Gaming Mode |
| **Animation Changer** | Custom boot and suspend animations |
| **SteamGridDB** | Custom artwork for games |

### Information

| Plugin | What It Does |
|--------|--------------|
| **HLTB** | How Long to Beat game times |
| **PlayTime** | Detailed play time tracking |
| **IsThereAnyDeal** | Game deal notifications |
| **Battery Tracker** | Battery health over time |

### Utilities

| Plugin | What It Does |
|--------|--------------|
| **AutoSuspend** | Suspend after inactivity |
| **Bluetooth** | Better Bluetooth management |
| **Tailscale Control** | VPN toggle in Gaming Mode |
| **DeckMTP** | MTP file transfer |
| **AutoFlatpaks** | Auto-update Flatpak apps |

### Social

| Plugin | What It Does |
|--------|--------------|
| **Discord Status** | Show game status on Discord |
| **KDE Connect** | Phone/desktop integration |

### Audio

| Plugin | What It Does |
|--------|--------------|
| **MagicPods** | AirPods battery and controls |

---

## Plugin Details

### PowerTools

The most useful plugin. Control performance per-game:

**Features:**

- Set CPU/GPU clock speeds
- Limit TDP (power draw)
- Enable/disable SMT
- Per-game profiles (saves automatically)
- Fan curve control

**Usage:**

1. Open Decky in game's Quick Access Menu
2. Open PowerTools
3. Adjust settings
4. They save automatically for that game

**Example Settings:**

| Game Type | CPU | GPU | TDP |
|-----------|-----|-----|-----|
| **Indie/2D** | 4 cores, no SMT | 400 MHz | 6W |
| **AAA/Demanding** | All cores, SMT | 1600 MHz | 15W |
| **Balanced** | All cores | 1200 MHz | 10W |

### CSS Loader

Apply visual themes to Gaming Mode UI.

**Installation:**

1. Enable CSS Loader
2. Open plugin settings
3. Browse themes in the store
4. Apply and enjoy

**Popular Themes:**

- Clean gaming interfaces
- Retro console styles
- Minimalist designs
- Color schemes

### ProtonDB Badges

Shows compatibility ratings directly in your library.

**Badges:**

| Badge | Meaning |
|-------|---------|
| 🟣 Native | Linux native, no Proton needed |
| 🟢 Platinum | Perfect with Proton |
| 🟡 Gold | Minor issues |
| 🟠 Silver | Playable with tweaks |
| 🔴 Bronze | May have problems |
| ⚫ Borked | Doesn't work |

Tap the badge to open ProtonDB page for fix suggestions.

### SteamGridDB

Replace game artwork with custom images.

**Use Cases:**

- Fix missing artwork for non-Steam games
- Use alternate art styles
- Animated logos (if supported)
- Consistent visual themes

### Tailscale Control

Toggle Tailscale VPN without leaving Gaming Mode.

**Features:**

- Quick toggle on/off
- See connection status
- View Tailscale IP

---

## GitHub Rate Limits

Installing many plugins requires GitHub API calls. Without authentication, you're limited to 60 requests/hour.

### Automatic Authentication

If you enable >3 plugins, Bootible's bootstrap script automatically shows a QR code for GitHub login. No config needed!

### Manual Token

Alternatively, add a token to your config:

```yaml
github_token: "ghp_your_token_here"
```

Create at [github.com/settings/tokens](https://github.com/settings/tokens) (no permissions needed).

---

## Managing Plugins

### In Gaming Mode

1. Open Decky (... button > plug icon)
2. Click the store icon (shopping bag) for new plugins
3. Click gear icon for settings
4. Individual plugins have their own settings

### Updating Plugins

Decky checks for updates automatically. When available:

1. Open Decky
2. Look for update indicator
3. Click to update

### Removing Plugins

1. Open Decky settings (gear icon)
2. Find the plugin
3. Click uninstall

---

## Troubleshooting

### Decky Tab Not Showing

1. **Restart Steam:** Power button > Restart Steam
2. **Re-run Bootible:** If still missing after restart
3. **Check install:** Look for `~/homebrew/plugins/` folder

### Plugin Not Working

1. **Update it:** Check for plugin updates
2. **Disable/enable:** Toggle plugin off and on
3. **Check GitHub:** Look for known issues
4. **Reinstall:** Remove and re-add from store

### Plugins Disappeared After Update

SteamOS updates can reset homebrew. Re-run Bootible:

```bash
bootible
```

Decky and plugins will be reinstalled.

### Rate Limit Errors

If you see "API rate limit exceeded":

1. Wait an hour, or
2. Add GitHub authentication (see above)

---

## All Available Plugins

For the complete list of plugins, see the config reference or browse:

- [Decky Plugin Store](https://plugins.deckbrew.xyz/)
- [Decky GitHub](https://github.com/SteamDeckHomebrew)

```yaml
decky_plugins:
  # Performance
  powertools:
    enabled: true
    store_name: "PowerTools"
  autosuspend:
    enabled: false
    store_name: "AutoSuspend"
  battery_tracker:
    enabled: false
    store_name: "Battery Tracker"

  # Game Info
  protondb_badges:
    enabled: true
    store_name: "ProtonDB Badges"
  steamgriddb:
    enabled: false
    store_name: "SteamGridDB"
  hltb:
    enabled: false
    store_name: "HLTB for Deck"
  playtime:
    enabled: false
    store_name: "PlayTime"
  isthereanydeal:
    enabled: false
    store_name: "IsThereAnyDeal for Deck"

  # Customization
  css_loader:
    enabled: false
    store_name: "CSS Loader"
  animation_changer:
    enabled: false
    store_name: "Animation Changer"

  # Connectivity
  bluetooth:
    enabled: false
    store_name: "Bluetooth"
  tailscale_control:
    enabled: false
    store_name: "Tailscale Control"
  kde_connect:
    enabled: false
    store_name: "KDE Connect"

  # Sync & Transfer
  decky_cloud_save:
    enabled: false
    store_name: "Decky Cloud Save"
  deckmtp:
    enabled: false
    store_name: "DeckMTP"
  autoflatpaks:
    enabled: false
    store_name: "AutoFlatpaks"

  # Social
  discord_status:
    enabled: false
    store_name: "Discord Status"
  decky_notifications:
    enabled: false
    store_name: "Decky Notifications"

  # Audio
  magicpods:
    enabled: false
    store_name: "MagicPods"
```
