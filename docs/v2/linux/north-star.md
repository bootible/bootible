---
description: What "great" looks like for bootible provisioning a Steam Deck (SteamOS) and Bazzite handheld — testable outcomes, honest about what SteamOS forces a human to do.
tags: [linux, steamos, bazzite, north-star, steam-deck]
audience: { human: 70, agent: 30 }
purpose: { north-star: 100 }
---

# North star: Linux handheld provisioning

What great looks like, from the user's seat. Each line is checkable yes/no against a running system. Grounded in two facts established before this was written: the **USB data-partition carrier is validated on real hardware**, and **v1 already provisions the Deck end-to-end via Ansible** (`deck.sh` + roles).

**Engine decision:** v2 **ports the proven v1 logic into a native runner** (single TS + bash stack, under the test gate) — using the v1 Ansible roles as the *spec*, not running Ansible on-device, and not inventing the payload from scratch. Chosen for long-term project health (one stack, gated, vitest-covered, clean carrier/cloud integration) over the lower-effort "reuse Ansible at runtime" path; the cost is one hardware re-validation pass (which the carrier+install flow needs anyway). See [[steamos-bazzite-provisioning]] findings.

## The core promise

> A user configures their handheld **once, on the desktop**, and a single USB takes a bare device to a fully set-up gaming handheld — installing the OS and applying their exact choices — with only the few hands-on steps SteamOS genuinely requires, named honestly.

## Outcome declarations

**Build (desktop app)**
1. A user can pick **Steam Deck** in the app and choose what they want — apps, emulation, Decky plugins, streaming, SSH, password manager, SD-card layout — **without hand-editing any YAML**. (v1 required editing a private-repo `config.yml`; v2 makes that a UI.)
2. The user picks one of **two delivery paths** (like the Windows method-picker):
   - **Provision-only USB ("post-setup")** — bootible formats a stick to exFAT `BOOTIBLE` and writes the payload. The user resets/installs SteamOS themselves ([Valve recovery](https://help.steampowered.com/en/faqs/view/1B71-EDF2-EB6D-2BB3)) or uses their existing install, then runs `provision.sh`. **No image fetch/flash** — also works on an already-set-up Deck. The simpler, lower-risk path; ship first.
   - **Full reimage USB** — bootible fetches the recovery `.img.zip` from the open CDN index, writes it unmodified, and appends the `BOOTIBLE` payload partition. One USB that wipes, installs, and provisions.
3. For the full-reimage path the writer **downloads, decompresses, and writes Valve's stock recovery image unmodified**, then appends a `BOOTIBLE` exFAT partition holding the generated config — we never hack Valve's image. (Provision-only skips straight to the partition.)

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

The validated carrier (declarations 2–5) plus the v1 Ansible roles as a **proven spec** mean the risk is in re-validation, not invention. The new work is: the app's config-generating UI (1), the USB writer's decompress + append-partition step (3), and a **native on-device runner ported from the v1 roles** that reads config from the `BOOTIBLE` partition and applies it (5–7) — single stack, under the test gate, validated in one hardware pass. The flows and design will specify those seams.
