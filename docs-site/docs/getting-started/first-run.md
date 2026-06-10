---
title: First Run Walkthrough
description: Step-by-step guide to your first Bootible run
---

# First Run Walkthrough

This guide walks through every step of your first Bootible run, explaining what happens at each stage.

---

## Before You Begin

!!! tip "Set your sudo password (Steam Deck)"
    If you haven't set a sudo password on your Steam Deck, open Konsole and run:
    ```bash
    passwd
    ```
    Enter a password when prompted. You'll need this during the Bootible run.

---

## Step 1: Run the Bootstrap Command

=== "Steam Deck"

    ```bash
    curl -fsSL https://bootible.dev/deck | bash
    ```

=== "ROG Ally"

    ```powershell
    irm https://bootible.dev/rog | iex
    ```

### What Happens

1. **Script Download** — The bootstrap script is downloaded from `bootible.dev`
2. **Integrity Check** — SHA256 hash is verified to ensure the script wasn't tampered with
3. **Device Detection** — Bootible identifies your device type

---

## Step 2: Private Repository (Optional)

You'll be prompted:

```
Do you have a private configuration repository? [y/N]
```

### Option A: No Private Repo

Press ++enter++ or type `n` to use default settings.

- Bootible runs with sensible defaults
- Logs are saved locally but not synced
- Perfect for trying out Bootible

### Option B: Use Private Repo

Type `y` and enter your GitHub repository:

```
Enter your private repo (e.g., username/my-config): myuser/gaming
```

!!! info "First time? Set up your private repo first"
    See [Private Configuration](private-config.md) for how to set this up.

---

## Step 3: GitHub Authentication

If you specified a private repo, Bootible needs to access it.

### QR Code Login (Recommended)

A QR code appears on screen:

```
╭───────────────────────────────────────────────╮
│           GitHub Device Authentication        │
│                                               │
│  Scan this QR code with your phone:           │
│                                               │
│         ██████████████████████████            │
│         ██                      ██            │
│         ██  ████████████████    ██            │
│         ...                                   │
│                                               │
│  Or visit: https://github.com/login/device   │
│  Code: ABCD-1234                              │
╰───────────────────────────────────────────────╯
```

1. Scan the QR code with your phone
2. Authorize the Bootible device login
3. The script continues automatically

!!! tip "Why QR code?"
    Gaming handhelds have on-screen keyboards that make typing painful. The QR code lets you authenticate using your phone, where typing is much easier.

---

## Step 4: Configuration Selection

If your private repo has multiple device configurations, you'll choose one:

```
Multiple configurations found:

  1) MySteamDeck
  2) MyRogAlly

Select configuration [1-2]:
```

Select the configuration for this device.

---

## Step 5: Dry Run Preview

Bootible now runs in **dry-run mode**, showing what would happen:

```
╔════════════════════════════════════════════════════════════╗
║              Bootible - DRY RUN MODE                       ║
╚════════════════════════════════════════════════════════════╝

[DRY RUN] Would install: Discord
[DRY RUN] Would install: Spotify
[DRY RUN] Would install: VLC
[DRY RUN] Would configure: SSH server on port 22
[DRY RUN] Would enable: Decky Loader
[DRY RUN] Would install plugin: PowerTools
[DRY RUN] Would install plugin: ProtonDB Badges
...
```

### Review Carefully

- ✓ Check that expected apps are listed
- ✓ Verify system settings look correct
- ✓ Note any warnings or skipped items

!!! warning "Nothing has been changed yet"
    Dry-run mode only previews. No packages are installed, no settings are changed.

---

## Step 6: Apply Changes

If the preview looks good, apply your configuration:

=== "Steam Deck"

    ```bash
    bootible
    ```

=== "ROG Ally"

    ```powershell
    bootible
    ```

### What Happens During Apply

1. **Snapshot/Restore Point** — Creates a backup before making changes
2. **Package Installation** — Installs apps via Flatpak/winget
3. **Configuration** — Applies system settings
4. **Plugins** — Installs Decky plugins (Steam Deck)
5. **Cleanup** — Removes temporary files
6. **Log Push** — Uploads run log to your private repo

---

## Step 7: Review Results

After completion, you'll see a summary:

```
╔════════════════════════════════════════════════════════════╗
║              Installation Complete!                        ║
╚════════════════════════════════════════════════════════════╝

Installed:
  ✓ Discord
  ✓ Spotify
  ✓ VLC
  ✓ Decky Loader
  ✓ PowerTools plugin
  ✓ ProtonDB Badges plugin

Configured:
  ✓ SSH server enabled
  ✓ Tailscale installed

Next Steps:
  • Switch to Gaming Mode to see Decky plugins
  • Press ... button → Decky tab
  • Run 'bootible' again anytime to update
```

On Windows handhelds, Bootible also writes **`Bootible - Read Me.md`** to your Desktop: a receipt of every app installed and setting changed, plus first-aid steps for common issues (Smart App Control, winget failures, hibernate behavior).

!!! info "On later runs: drift detection"
    From your second run onward, Bootible compares the device against a snapshot of its last known-good state and reports what changed (hibernate setting, Game Bar reinstalls, GPU driver version, wallpaper, SSH state). Repairs only appear on the receipt after they are verified to have actually taken.

---

## What's Next?

<div class="grid cards" markdown>

-   :material-refresh:{ .lg .middle } **Re-running Bootible**

    ---

    Changed your config? Just run `bootible` again to apply updates.

-   :material-cog:{ .lg .middle } **Customize Further**

    ---

    Edit your config.yml to enable more features.

    [:octicons-arrow-right-24: Configuration](../configuration/index.md)

-   :material-controller:{ .lg .middle } **Platform Guides**

    ---

    Deep dive into platform-specific features.

    [:octicons-arrow-right-24: Platforms](../platforms/index.md)

</div>
