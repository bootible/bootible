---
description: Provisioning a Windows or SteamOS handheld that can run bootible itself — either on the device, or by building a setup USB from a host that the device boots and self-applies
tags: [bootible, v2, flow, provisioning, on-device, host-prep, setup-usb]
audience: { human: 50, agent: 50 }
purpose: { flow: 85, reference: 15 }
---

# Flow — Provision: on-device (Windows / SteamOS)

A general-purpose-OS handheld that can run bootible. **Species (from registry):** ROG Ally, AYN Loki (Windows); Steam Deck (SteamOS). The same device supports two entry paths — **Path A** runs setup on the device; **Path A2** builds a setup USB from a host and the device self-applies on first boot (this folds in the zero-touch-wizard idea). The router decides which path the user takes.

## Path A — run setup on the device

### Trigger
The user reaches this flow from the router with intent = provision/restore and model = `on-device`, running the App (installed) or `curl | bash` on the handheld.

### Stages

1. **Connect your target** (recommended) — if restoring, pull the declarative config; else start from defaults/answers. `[point][secret]`
2. **Apply declarative config** — install apps/emulators (EmuDeck *staged fresh* `[regen]`), system tweaks, power/display, debloat.
3. **Restore durable data** if present — saves/BIOS from the target. `[carry]`
4. **Capability-aware content sync** from the target. `[cap][legal]`
5. **Receipt + drift baseline** written.

### Termination
The device is configured to the declarative config, durable data restored, a receipt written, and a drift baseline captured.

## Path A2 — setup USB (host-media-prep for a general-purpose OS)

### Trigger
The user chooses, at router stage 4, to build install/setup media from a host rather than run on the device.

### Stages

1. **Build setup media** (on a host, App/CLI):
   - **Windows** = `autounattend.xml` + first-boot bootstrap on a USB (+ fetch the Wi-Fi driver, e.g. MT7922).
   - **Deck** = recovery image + first-boot hook.
2. **Safe drive pick.** `[safe]`
3. **Write media** — file-copy (Windows unattended USB) or image (Deck recovery, via `etcher-sdk`).
4. **Boot the device from the media** — OOBE/recovery runs → first-boot bootstrap **pulls config from the target and self-applies** (= Path A stages 1–5, unattended).

Secrets (Wi-Fi) are staged onto the user's *own* media, never hosted. `[secret]`

### Termination
The device boots a clean OS and self-applies the config without further host interaction; end state is identical to Path A.

## Fork (both paths)

- **Player:** App with LLM narration; on Path A2 the App walks media creation and the boot step.
- **Tinkerer:** `curl | bash` / `bootible provision`; on Path A2 a CLI media-build command.

## Failure modes

- **No network on first apply** → retry loop; Wi-Fi from `[secret]` store or staged profile.
- **A2 first-boot bootstrap can't reach the target** → device lands usable but unconfigured; user re-runs Path A to finish.
- **Destructive write (A2)** is gated by `[safe]` (confirm, size/label shown).
