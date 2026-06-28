---
description: What "great" looks like for bootible provisioning a Steam Deck (SteamOS) and Bazzite handheld — testable outcomes, honest about what SteamOS forces a human to do.
tags: [linux, steamos, bazzite, north-star, steam-deck]
audience: { human: 70, agent: 30 }
purpose: { north-star: 100 }
---

# North star: Linux handheld provisioning

What great looks like, from the user's seat. Each line is checkable yes/no against a running system. Grounded in two facts established before this was written: the **USB data-partition carrier is validated on real hardware**, and **v1 already provisions the Deck end-to-end via Ansible** (`deck.sh` + roles) — so v2 reuses that engine rather than rebuilding the payload. See [[steamos-bazzite-provisioning]] findings.

## The core promise

> A user configures their handheld **once, on the desktop**, and a single USB takes a bare device to a fully set-up gaming handheld — installing the OS and applying their exact choices — with only the few hands-on steps SteamOS genuinely requires, named honestly.

## Outcome declarations

**Build (desktop app)**
1. A user can pick **Steam Deck** in the app and choose what they want — apps, emulation, Decky plugins, streaming, SSH, password manager, SD-card layout — **without hand-editing any YAML**. (v1 required editing a private-repo `config.yml`; v2 makes that a UI.)
2. The app produces **one USB** that both installs SteamOS *and* carries the user's configuration.
3. The USB writer **downloads, decompresses, and writes Valve's stock recovery image unmodified**, then appends a `BOOTIBLE` exFAT partition holding the generated config — we never hack Valve's image.

**Install + apply (on the device)**
4. Booting the USB and choosing **Reimage** installs **stock SteamOS** — bootible has changed nothing about the OS itself.
5. After install, **one command** (minimal typing, per the project's core rule) applies the user's entire configuration from the USB partition — **no internet needed for the config itself** (only for the package downloads it triggers).
6. What gets applied **matches what was chosen in the app**, with the coverage v1 already delivers: Flatpak apps, Decky + selected plugins, Proton tools (GE/protontricks/ProtonUp-Qt), EmuDeck, Sunshine/Moonlight/Chiaki, SSH, Tailscale, password managers, SD-card emulation + shader-cache placement.
7. Changes are **safe by construction**: a **btrfs snapshot** is taken before any change, and only **update-surviving** install methods are used (Flatpak / pip-user / Nix / Distrobox) — never `pacman`-into-rootfs that a SteamOS update silently wipes. Any `/etc` change is added to the atomic-update allowlist so it survives updates.
8. A **dry-run preview** shows exactly what will change before anything is applied, and re-running is **idempotent** (same as v1).

**Honest finish (no pretending)**
9. The steps SteamOS truly requires a human for are shown as a short, explicit **"finish on the device" checklist**, not hidden: **set a device password** (`passwd`, before sudo works), the **EmuDeck wizard**, **Steam ROM Manager** (parse → save shortcuts), the **Waydroid installer**, and a **Gaming Mode restart** to see Decky. "Zero-touch" is not claimed for Linux; "guided finish" is.

**Reach (data, not rewrite)**
10. The same flow extends to **Bazzite** (and **ROG Ally on Bazzite**, the stronger Ally target) by **adding data to the `DeviceProfile` seam**, not rewriting — the device picker offers it, and the payload maps onto Bazzite's `ujust` / Flatpak equivalents.
11. A user with a **bootible cloud account** can optionally **pull their saved configuration** to the device instead of carrying it on the USB — reusing the E2E profile sync already built (see [[bootible-cloud-auth-stack]]).

## Explicitly NOT in v1 (so the promise stays honest)

- **No pre-baked custom Bazzite image** (that's a GitHub-Actions/GHCR cloud build; bare-metal `bootc` is currently broken). v1 Bazzite uses stock ISO + on-device, same as SteamOS.
- **No fully hands-off Linux install** — the guided finish (declaration 9) is the honest ceiling SteamOS/EmuDeck impose.
- **No modification of Valve's recovery image** — we add a partition beside it; we never repack it.

## How we'll know it's true

The validated carrier (declarations 2–5) + the existing v1 Ansible engine (declaration 6) mean most of this is **wiring proven parts together**. The new work is: the app's config-generating UI (1), the USB writer's decompress + append-partition step (3), and the on-device entry that reads config from the `BOOTIBLE` partition and runs the v1 playbook (5). The flows and design will specify those seams.
