---
title: What Stays Manual
description: Things Bootible deliberately does not automate, why, and the exact clicks to finish each one
---

# What Stays Manual

Bootible automates what is safe and reliable to automate. A few things stay manual on purpose — usually because the "automated" version would be fragile, interactive by design, or owned by another tool. Here is the honest list, with what Bootible **did** do and what is left for you.

---

## Performance profiles & TDP

**What Bootible did:** verified Armoury Crate is present (it ships pre-installed; if missing, the run points you to the ASUS download page). If you enabled `install_ghelper`, it installed G-Helper from its GitHub releases.

**What's left:** choosing your performance mode and TDP. Live performance profiles are runtime state owned by Armoury Crate (or G-Helper, if you use it) — Bootible does not manage them.

**The clicks:** press the **Armoury Crate button** to open the control center, or the **Command Center (CC) button** for quick settings, and pick a mode. Rules of thumb from the run's own tips: Silent mode at ~15W TDP for battery life, Turbo (25W+) for performance. In G-Helper, the modes are on the main window.

!!! warning "Armoury Crate won't start?"
    Windows **Smart App Control** blocks Armoury Crate components. The health check at the end of each run flags this. Check it under Settings → Privacy & security → Windows Security → App & browser control — and note that turning Smart App Control off is one-way (re-enabling requires resetting Windows). Many Ally owners use G-Helper instead.

---

## Steam library folder registration

**What Bootible did:** created your `games_path` and `roms_path` directories if your config sets them (absolute drive-letter paths like `D:\Games`).

**What's left:** telling Steam about the folder. Editing `libraryfolders.vdf` programmatically is unreliable — Steam overwrites it — so Bootible deliberately does not touch it.

**The clicks:** Steam → **Settings** → **Storage** → the drive dropdown → **Add Drive** (or add a folder on an existing drive), then select your games folder. New installs can now target it.

---

## EmuDeck configuration

**What Bootible did** (when `install_emulation` is enabled): pre-installed EmuDeck's prerequisites (Git, Python) so your EmuDeck session is shorter, then downloaded and launched the EmuDeck installer — the EA (Patreon) installer if its script is in your private repo's `scripts/` folder, otherwise the public one.

**What's left:** EmuDeck's own setup. Its configuration is interactive by design — it walks you through emulator choices, ROM paths, and per-system settings that depend on your library and preferences. No flag bypasses that, and Bootible does not pretend otherwise.

**The clicks:** run the EmuDeck app, follow its wizard, point it at your ROMs folder (the `roms_path` Bootible created, if you set one). Re-run EmuDeck any time to update or reconfigure emulators.

---

## MyASUS installation

**What Bootible did** (when `install_myasus` is on, the default): MyASUS is only distributed through the Microsoft Store — it is not in winget — so Bootible opens its Microsoft Store page for you and says so in the run output.

**What's left:** one click. The Store window is open; press **Install** (or **Get**) and let it finish. Sign-in to the Store may be required first.

---

## Per-game tweaks

**What Bootible did:** the system-level groundwork — Game Mode, GPU scheduling, power plans, and whatever optimization options your config enables.

**What's left:** settings that live inside each game: resolution and FSR/upscaling choices, frame caps, controller layouts, cloud-save conflicts. These are per-game and per-taste; no configuration file can decide them for you. Steam's per-game properties (launch options, controller config) and each game's own settings menu are the places to look.

---

## And the sign-ins

Steam, Xbox/Game Pass, launchers, Discord, your password manager — Bootible installs them but never touches your credentials. The [first game checklist](index.md#first-game-checklist) covers the round of sign-ins.
