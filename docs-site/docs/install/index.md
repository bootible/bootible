---
title: Install & Run
description: Run the bootstrap, review the dry run, and apply your configuration
---

# Install & Run

This is step 3 of the journey. You have optionally set up a config repo — if you skipped it, that is fine. You can run with defaults now and add a private repo any time.

Not sure what will happen yet? The [Try It in 5 Minutes](../getting-started/quick-try.md) walkthrough covers what a dry run is and why it is safe to paste the command.

---

## Run the bootstrap

=== "ROG Ally"

    ### Prerequisites

    Open an **Administrator terminal**. Right-click the Start button (or press ++win+x++) and select **Terminal (Admin)** or **PowerShell (Admin)**.

    ### The one-liner

    ```powershell
    irm https://bootible.dev/rog | iex
    ```

    ### What happens next

    **1. Bootstrap downloads and verifies itself.** The server serving bootible.dev pins a SHA-256 checksum at deploy time. What you download matches exactly what was released.

    **2. Tooling is set up.** Git and supporting scripts are placed under `~\.bootible`. The `bootible` command is registered on your PATH. This tooling is the only permanent change made during the preview run.

    **3. Private repo question.** Bootible prints a blank line then asks:

    ```
    Do you have a private config repo? (y/N)
    ```

    Press **++enter++** to run with the default configuration (empty answer means No). If you have a private config repo, type `y` and press Enter. You will then be asked for:

    ```
    Your GitHub username: 
    Private repo (e.g., owner/repo): 
    ```

    After entering those, Bootible opens a GitHub device-flow login — a QR code appears alongside a short code and a URL. Scan the QR code with your phone, or visit `github.com/login/device` on any device and enter the code. Once you authorize, the clone proceeds automatically.

    **4. Instance selection (private repo with multiple configs only).** If your private repo contains more than one device configuration, Bootible lists them and asks you to choose:

    ```
    Multiple configurations found:

      1) ROGAlly
      2) AllyX

    Select configuration [1-2]:
    ```

    Enter the number for this device. If only one configuration is found, it is selected automatically.

    **5. Dry run begins.** Bootible walks through the full setup in preview mode — no changes are made yet. See [Reading the dry run](#reading-the-dry-run) below for what to look for.

=== "Steam Deck"

    ### Prerequisites

    Bootible runs from Desktop Mode. Press the **Steam button**, go to Power, and select **Switch to Desktop**. Open **Konsole** from the application menu (System → Konsole).

    If you have not set a sudo password yet, run `passwd` in Konsole first. You will need it during the run.

    ### The one-liner

    ```bash
    curl -fsSL https://bootible.dev/deck | bash
    ```

    ### What happens next

    **1. Bootstrap downloads.** The script is fetched from bootible.dev.

    **2. Tooling is set up.** Ansible, Git, and the `bootible` command are placed under `~/.bootible`.

    **3. Private repo question.** Bootible asks:

    ```
    Do you have a private config repo? (y/N): 
    ```

    Press **Enter** for No. If you answer `y`, you are prompted for your GitHub username and the repo path in `owner/repo` format. Bootible then opens GitHub device-flow auth — a QR code and a short code. Authorize on your phone or another device and the clone proceeds automatically.

    **4. Instance selection (private repo with multiple configs only).** Same as ROG Ally: if multiple device configurations exist in your repo, Bootible lists them and asks you to choose. A single configuration is selected automatically.

    **5. Dry run begins.** Ansible runs in check mode — no packages are installed, no settings are changed. See [Reading the dry run](#reading-the-dry-run) below.

=== "Android (ALPHA)"

    Android support is in alpha. The bootstrap provisions your handheld wirelessly over ADB from a computer connected to the same network.

    ```bash
    curl -fsSL https://bootible.dev/android | bash
    ```

    The private-repo prompt and instance selection follow the same pattern as the other platforms. The dry run shows what APKs and settings would be pushed. Press **Enter** at the private repo question to try with defaults.

---

## Reading the dry run

The dry run makes no changes. Here is what to look for in the output.

### Package preview and validation (ROG Ally)

Before the main preview, a **Package Source Validation** section runs and tests every winget package ID against the available sources:

```
[OK] All N packages validated successfully
```

or, if some packages cannot be found:

```
[!] Validated: X/N packages

  Packages not found in sources:
    - Some.PackageId (App Name)
```

`Package not found` entries mean those apps will not install during the real run. You can look up the correct winget ID and update your config before applying.

Each package that *would* install appears in the main output as:

```
-> [DRY RUN] Would install: Discord from winget
```

### Smart App Control status (ROG Ally)

At the end of the validation section, Bootible reads and reports your Smart App Control state:

- `[OK] Smart App Control: off` — no impact on the run.
- `-> Smart App Control is in evaluation mode` — it may switch on by itself and silently block Armoury Crate components.
- `[!] Smart App Control is ON` — it silently blocks ROG Live Service and ACSetup. The warning includes the path to disable it if you choose to.

### Drift report (re-runs only)

If you are re-running Bootible after a previous successful run, the dry run also shows a **drift report** — a comparison against the state snapshot taken at the end of the last real run. This section only appears when a snapshot exists. On a first run, there is no snapshot yet and no drift section appears.

---

## Apply for real

When the preview looks right, run:

```
bootible
```

The same command works on every platform. Before making any changes, Bootible creates a safety net first:

- **ROG Ally:** creates a Windows System Restore Point. This is on by default (`create_restore_point: true` in your config) and can be disabled in config but rarely should be.
- **Steam Deck:** creates a btrfs snapshot of your home folder (skipped automatically if the filesystem is not btrfs).

Bootible then installs packages, applies settings, and finishes. On Windows, a **`Bootible - Read Me.md`** receipt file is written to your Desktop with a summary of every app installed, every change applied, and first-aid steps. See [Post Install](../post-install/index.md) for a full walkthrough of what the receipt contains and what to do next.

**If a run is interrupted**, re-running `bootible` is safe — the run is idempotent. Packages already installed are skipped and nothing is duplicated.

!!! tip "Re-running is always safe"
    Run `bootible` any time after the initial setup. It re-applies your configuration and compares the current device state against the last known-good snapshot (hibernate setting, Game Bar presence, GPU driver version, wallpaper, SSH state) — particularly useful after a Windows Update quietly reverts your setup.

??? note "Beta channel"
    `irm https://bootible.dev/rog | iex` serves the latest tagged release. To try the newest unreleased code from `main`, use `irm https://bootible.dev/rog-beta | iex`. On Steam Deck: `curl -fsSL https://bootible.dev/deck-beta | bash`. Both channels are served with checksum verification.

---

## Multiple devices

If you manage more than one handheld from the same private config repo, each device gets its own directory in the repo — that is what the instance selection prompt is choosing between. See [Multi-Device](../getting-started/multi-device.md) for how to structure your repo for multiple instances.
