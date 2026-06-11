---
title: Updates & Channels
description: Stable vs beta in plain words, how to check which channel you're on, and how to switch
---

# Updates & Channels

Bootible's one-liner is served on two channels. Same scripts, different freshness guarantee.

| Channel | URLs | What you get |
|---------|------|--------------|
| **Stable** | `bootible.dev/rog`, `/deck`, `/android` | A release **pinned at deploy time**. The server serves one fixed version of Bootible and verifies its checksum on every request — what you get cannot silently change between your runs. |
| **Beta** | `bootible.dev/rog-beta`, `/deck-beta`, `/android-beta` | The **newest main** — every merged change, as soon as it lands. Fresher, less soaked. |

Stable is the right default. Beta is for trying fixes before they ship, or helping test.

!!! note "Before the first tagged release"
    Until Bootible's first release is activated, the stable channel is also pinned to main — the two channels serve the same content. They diverge from the first release onward.

How the pinning and checksum verification actually work is on [Release Channels & Integrity](../reference/integrity.md).

---

## Which channel am I on?

**The receipt.** Open `Bootible - Read Me.md` on your Desktop and read the **bootible version** line: a version number (like `1.0.0`) means a stable release; `main` means the beta channel (or a pre-first-release install).

**Ask the server.** Each channel URL answers with an `X-Bootible-Ref` header naming the exact git ref it serves. From PowerShell:

```powershell
(Invoke-WebRequest https://bootible.dev/rog).Headers['X-Bootible-Ref']       # stable: the release tag
(Invoke-WebRequest https://bootible.dev/rog-beta).Headers['X-Bootible-Ref']  # beta: main
```

This tells you what each channel *serves* right now; the receipt tells you what your device *ran* last.

---

## Switching channels (and updating)

Re-run the one-liner for the channel you want. That is also how you **update** — the installed `bootible` command on Windows runs from the copy already on your device and never pulls, so a newer Bootible only arrives via the one-liner.

=== "Go to beta"

    ```powershell
    irm https://bootible.dev/rog-beta | iex
    ```

    The bootstrap fetches and checks out the newest main in your existing Bootible directory — the switching code explicitly supports returning from a pinned release to main.

=== "Go to (or update) stable"

    ```powershell
    irm https://bootible.dev/rog | iex
    ```

    The bootstrap fetches the release tags and checks out the pinned release. Re-running the same command after a new release activates moves you to that release.

Both directions are a clean switch on the ROG Ally: the bootstrap pins your local Bootible copy (under `%USERPROFILE%\bootible`) to the channel's ref each time you run it. Your private config repo is untouched by channel switches — channels only choose which version of the Bootible engine runs your config.

After the bootstrap's dry-run preview, run `bootible` to apply with the switched version.

!!! note "Steam Deck caveat"
    On the Steam Deck, channel pinning applies to the bootstrap script you download; the Bootible engine it installs tracks the newest main regardless of channel, and the installed `bootible` command pulls the newest main on each run. Full engine pinning on stable is a ROG Ally (Windows) behavior today.

---

## Where next

- [Release Channels & Integrity](../reference/integrity.md) — checksum pinning, verification headers, and the trust model behind `irm | iex`
- [Re-running & Drift](re-running.md) — re-running the version you already have
