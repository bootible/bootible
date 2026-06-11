---
title: Quick Start
description: Get Bootible running in under 5 minutes
---

# Quick Start

!!! info "Content being consolidated"
    This page is being merged into [Install & Run](../install/index.md). The steps here are accurate; a unified per-device tab view is coming in the next docs update.

Get your gaming handheld configured in minutes with a single command.

---

## Steam Deck

### 1. Open Desktop Mode

Hold the **Power** button and select **Switch to Desktop**.

### 2. Open Konsole

Click the application menu → System → Konsole (Terminal)

### 3. Run Bootible

```bash
curl -fsSL https://bootible.dev/deck | bash
```

!!! info "First run is a dry run"
    This previews all changes without applying them. You'll see exactly what would be installed and configured.

### 4. Review the Output

Bootible will show you:

- Apps that would be installed (Flatpak)
- Decky plugins that would be added
- System settings that would change
- SSH/network configuration

### 5. Apply Changes

If you're happy with the preview, run:

```bash
bootible
```

This applies your configuration. A btrfs snapshot is created first, so you can always roll back.

---

## ROG Ally (Windows)

### 1. Open PowerShell as Administrator

Press ++win+x++ and select **Terminal (Admin)** or **PowerShell (Admin)**

### 2. Run Bootible

```powershell
irm https://bootible.dev/rog | iex
```

!!! info "First run is a dry run"
    This previews all changes without applying them. You'll see exactly what would be installed and configured.

### 3. Review the Output

Bootible will show you:

- Apps that would be installed (winget/Chocolatey)
- Gaming optimizations that would be applied
- Privacy/debloat changes
- System settings

### 4. Apply Changes

If you're happy with the preview, run:

```powershell
bootible
```

This applies your configuration. A System Restore Point is created first, so you can always roll back.

When the run finishes, Bootible leaves **`Bootible - Read Me.md`** on your Desktop — a receipt listing every app installed, every setting changed, and first-aid steps if something looks off.

!!! tip "Re-running is always safe"
    Run `bootible` again any time. It re-applies your configuration and reports anything that changed since your last run (hibernate setting, Game Bar reinstalls, GPU driver version, wallpaper, SSH state) — useful after a Windows Update undoes your setup.

??? note "Beta channel"
    `irm https://bootible.dev/rog | iex` serves the latest tagged release. To run the newest unreleased code instead, use `irm https://bootible.dev/rog-beta | iex` (Steam Deck: `bootible.dev/deck-beta`).

---

## What's Next?

<div class="grid cards" markdown>

-   :material-cog:{ .lg .middle } **Customize Your Config**

    ---

    Set up a private repo and customize what gets installed.

    [:octicons-arrow-right-24: Your Config Repo](config-repo.md)

-   :material-format-list-checks:{ .lg .middle } **See All Options**

    ---

    Browse the complete configuration reference.

    [:octicons-arrow-right-24: Config Basics](config-basics.md)

-   :material-help-circle:{ .lg .middle } **Troubleshooting**

    ---

    Having issues? Check the troubleshooting guide.

    [:octicons-arrow-right-24: Troubleshooting](../post-install/troubleshooting.md)

</div>
