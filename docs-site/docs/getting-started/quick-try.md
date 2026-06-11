---
title: Try It in 5 Minutes
description: See exactly what Bootible would do to your device — before you let it do any of it
---

# Try It in 5 Minutes

You don't have to commit to anything to try Bootible. The first run is a **preview** (a "dry run"): it walks through the entire setup and shows you every change it *would* make — without making any of them. You read the list, and nothing is applied until you decide to type `bootible`.

This page is the zero-config version: no GitHub account, no YAML, no preparation. Just the preview.

---

## What will happen

When you run the one-liner below, Bootible:

1. **Downloads itself** — served from bootible.dev with SHA-256 checksum verification.
2. **Sets up its own tooling** — Git on Windows, Ansible on Steam Deck. This tooling (and the `bootible` command below) is the only thing actually installed during the preview.
3. **Asks you one question** — about a private config repo. Just press ++enter++ ([more below](#the-one-question-it-asks)).
4. **Installs the `bootible` command** — so applying later is one word.
5. **Shows you the full preview** — every app the default setup would install and every setting it would change, labeled `[DRY RUN]`.

## What won't happen

- **Nothing from the preview is applied.** No apps from the list are installed, no settings are changed. When the preview ends, you can simply close the window.
- **Nothing is ever applied without a second command.** Changes only happen when you type `bootible` yourself, after you've seen the list.
- **And when you do apply**, Bootible first creates a System Restore Point (Windows) or a btrfs snapshot of your home folder (Steam Deck) — so there's a way back.

---

## Run the preview

=== "ROG Ally / Windows"

    Open **Terminal as Administrator** (right-click the Start button → *Terminal (Admin)*) and paste:

    ```powershell
    irm https://bootible.dev/rog | iex
    ```

=== "Steam Deck"

    Switch to Desktop Mode (Steam button → Power → *Switch to Desktop*), open **Konsole**, and paste:

    ```bash
    curl -fsSL https://bootible.dev/deck | bash
    ```

    You'll need a sudo password set — if you've never set one, run `passwd` first.

The preview is the fast part. A real run's length depends on how many apps your config installs and your connection speed.

---

## The one question it asks

Partway through, Bootible asks:

```
Do you have a private config repo? (y/N)
```

**Just press ++enter++.** That answers "no", and Bootible carries on with the default setup. A private config repo is how you customize Bootible later — you can add one any time, and nothing about today's run is wasted.

---

## What Bootible never touches

- **Your personal files.** Documents, photos, videos, music, downloads — Bootible installs and configures apps; it does not read, move, or delete your files. One cosmetic exception you'll see in the preview: the default Windows setup tidies app *shortcuts* off the Desktop (the shortcuts, not the apps), and it's a config key you can turn off (`clean_desktop_shortcuts: false`).
- **Your game saves and game libraries.** Installing Steam or other launchers doesn't touch existing game installs or save files.
- **Your Windows license.** Nothing in Bootible interacts with Windows activation or licensing.

---

## "Should I really paste a command from the internet?"

A healthy question. Three honest answers:

- **The delivery is verified.** bootible.dev serves the script with a SHA-256 checksum pinned at deploy time, so what you download is exactly what was released.
- **The code is open source.** MIT-licensed, on [GitHub](https://github.com/bootible/bootible) — every line is auditable.
- **The preview is the safety net.** Nothing applies until you've read what would happen and typed `bootible` yourself.

The full trust story — release pinning, verification headers, and how to check the checksum yourself — is at [Release Channels & Integrity](../reference/integrity.md).

---

## Ready to make it yours?

The defaults are a curated gaming baseline. The moment you want *your* picks — Discord, Moonlight, a different browser — your settings live in a small private GitHub repo you can edit from any web browser.

[:octicons-arrow-right-24: Your Config Repo](config-repo.md)
