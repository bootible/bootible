---
title: Re-running & Drift
description: The fix for "Windows Update broke my settings" — re-run bootible — plus the apply-loop for config changes
---

# Re-running & Drift

Re-running Bootible is always safe. It re-applies your configuration and skips anything already in place. This page covers the two reasons you'll come back: **Windows Update changed something**, and **you changed your config**.

---

## After a Windows Update

The symptoms are familiar:

- The battery drains in sleep again
- Xbox Game Bar is back
- Settings you remember fixing have reverted

This is normal, unfortunately — Windows updates reinstall bloat, reset power settings, and occasionally downgrade drivers. The fix is one word:

```powershell
bootible
```

What happens:

1. **A drift report appears** — if a previous run saved a baseline (see the note below), the run opens with `DRIFT DETECTED SINCE LAST RUN`, listing each monitored setting with the expected value and what Windows changed it to.
2. **Your configuration re-applies** — the same modules run as on install day; anything already correct is skipped.
3. **The receipt tells you what was verified fixed** — after the run, the Configuration changes section of `Bootible - Read Me.md` lists `Repaired drift: <setting>` for each drifted item whose post-run state verifiably matches the baseline again. Bootible is honest about the rest: anything still off is listed as `Drift detected (not repaired): <setting>`.

!!! note "When the drift report appears"
    Bootible compares against a baseline (`state.json`) saved at the end of the last full real run. You get a drift report only when all of these hold:

    - a previous **real** run saved a baseline (dry runs read it but never write it)
    - you ran with a private config repo instance (defaults-only runs have nowhere to keep a baseline)
    - this run is a full run, not a `-Tags` partial run (a partial run cannot honestly claim repairs)

    No baseline? No report — but re-running still re-applies your configuration and fixes the same problems. The report is the receipt's proof, not the repair itself.

### What drift detection watches

| Monitored setting | Notes |
|-------------------|-------|
| Hibernate setting | the usual Windows Update casualty |
| Xbox Game Bar presence | detects it being reinstalled |
| GPU driver version | **report-only** — Bootible tells you the driver changed but never rolls drivers back |
| Desktop wallpaper | only monitored when your config sets `wallpaper_path` |
| SSH server state | whether `sshd` is running |
| Hardware-accelerated GPU scheduling | the HAGS toggle |

Everything else Bootible manages is simply re-applied on every run, watched or not. For the mechanics — where the baseline lives, why it stays local to the device, and how repairs are verified — see [How Drift Detection Works](../reference/drift.md).

---

## Changing your config

The loop depends on where you edit. The key fact: the installed `bootible` command runs from the copy of your repos already on the device — **it does not pull from GitHub**. Edits made on the web need the one-liner to land on the device first.

### Edited on the device

Edit the file, then run `bootible`. Done.

=== "ROG Ally"

    Your config lives at:

    ```
    %USERPROFILE%\bootible\private\device\rog-ally\<DeviceName>\config.yml
    ```

    (Usually `C:\Users\you\bootible\private\...`.) Edit, save, then in PowerShell:

    ```powershell
    bootible
    ```

    Using the no-GitHub local config instead? Same loop with `%USERPROFILE%\.config\bootible\rog-ally\config.yml` — see [Config Basics](../getting-started/config-basics.md) for the layering fine print.

=== "Steam Deck"

    Your config lives at:

    ```
    ~/bootible/private/device/steamdeck/<DeviceName>/config.yml
    ```

    Edit, save, then in Konsole:

    ```bash
    bootible
    ```

    Local (no-GitHub) config: `~/.config/bootible/steamdeck/config.yml`.

!!! tip "Commit your device edits"
    Edits made directly on the device work immediately but live only on the device until you commit and push them. If you later re-run the one-liner, it pulls from GitHub — commit first so your edits and the remote don't diverge.

### Edited on GitHub (web)

Commit your change on GitHub, then **re-run the one-liner on the device** — it updates your private repo (answer `y` and the same `owner/repo` when asked), shows a fresh dry-run preview, and refreshes the `bootible` command:

=== "ROG Ally"

    ```powershell
    irm https://bootible.dev/rog | iex
    ```

=== "Steam Deck"

    ```bash
    curl -fsSL https://bootible.dev/deck | bash
    ```

When the preview looks right, run `bootible` to apply. The full web-editing flow is on [Your Config Repo](../getting-started/config-repo.md).

---

## Where next

- [How Drift Detection Works](../reference/drift.md) — the contract: probes, baseline location, verified repairs
- [Updates & Channels](channels.md) — getting a newer Bootible, not just re-running the one you have
- [Troubleshooting](troubleshooting.md) — when a re-run doesn't fix it
