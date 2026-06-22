---
description: What a clean Windows install on a ROG Ally is missing, and whether the OG handheld experience (Xbox shell + ASUS function) can be restored on top of bootible's tuning
tags: [bootible, v2, findings, rog-ally, xbox-mode, armoury-crate, drivers, base-layer]
audience: { human: 55, agent: 45 }
purpose: { findings: 90, research: 10 }
---

# Findings — Restoring the OG Ally experience on a bootibled device

**Question:** A bootibled ROG Ally X boots to a bare Windows desktop, not the Xbox handheld experience it shipped with. What is actually missing, and can a user choose to get the original experience back — Xbox shell *and* working ASUS hardware — layered on top of bootible's debloat/tuning?

---

**Finding:** The factory experience is three separable layers, and **all three can be reconstructed on a clean install**:

1. **The Xbox full-screen shell is now a Windows feature, not an ASUS/OEM asset.** Microsoft shipped it as **"Xbox mode"** in Win11 24H2/25H2 (KB 5070297). It is a Settings toggle (Gaming → Xbox mode → pick a *home app* → optionally enter on startup) and is **automatable via registry**. A clean 25H2 install qualifies.
2. **The ASUS *function* (buttons, TDP, fan, brightness, RGB, gyro) comes from ASUS *drivers* — separate from Armoury Crate the app.** A clean install lacks them, so the hardware is only partly functional until they are staged. ASUS does not publish these on winget; they come from the device support page or through Armoury Crate's Update Center.
3. **Armoury Crate SE is optional on top of the drivers.** "Clean Xbox" = drivers **yes**, Armoury Crate **no**. "Full ROG" = drivers **+** Armoury Crate, debloated.

The layers stack without conflict: ASUS controls TDP/fan through the embedded controller, not `powercfg`, so bootible's power/registry tuning is **complementary**, not competing. "OG experience + bootible tuning" is viable.

The hard part is **driver staging** (no winget, volatile URLs); the Xbox-shell and Steam-shell layers are straightforward registry + winget work.

---

## Evidence

### Xbox mode is an OS feature with a documented, automatable toggle

Microsoft's support article defines Xbox mode as a built-in Windows gaming feature, lists the exact setup path, and states the OS requirement.

> [Microsoft Support KB 5070297 — Windows Gaming: Full screen experience](https://support.microsoft.com/en-us/topic/windows-gaming-full-screen-experience-67fb8d12-5467-4a95-8adf-0a10789576ab) — "Xbox mode requires Windows 11 version 24H2 or later." Setup on handhelds: **Settings → Gaming → Xbox mode → Choose home app → (optional) Enter Xbox mode on startup.** Selecting **None** turns it off. When start-on-boot is on, "Windows limits background processes to improve performance while gaming."

Key properties for bootible:

- **Home app is pluggable.** The shell launches a chosen "gaming home app" — Xbox is the factory one; the same mechanism could point at another launcher.
- **Win + F11** toggles in/out of Xbox mode; **Task View / Game Bar** return to desktop. So the shell is escapable, not a lock-in.
- **Startup app behaviour changes under Xbox mode** (Settings → Apps → Startup gains "Start at log in" / "Start when exiting to desktop" / "Off"), which matters for how bootible's installed apps are sequenced.

It went official (not Insider-only) in late 2025, confirming this is a stable, supported path rather than a leak/hack.

> [Xbox Wire — Full Screen Experience available for Xbox Insiders (Nov 21 2025)](https://news.xbox.com/en-us/2025/11/21/the-full-screen-experience-is-available-for-xbox-insiders-starting-today/) — positions it as a console-like experience for handhelds.

A community tool already automates the enablement by flipping the underlying flags, which confirms it is registry-drivable (exact keys to be lifted/verified, not yet captured here).

> [github.com/8bit2qubit/XboxFullscreenExperienceTool](https://github.com/8bit2qubit/XboxFullscreenExperienceTool) — one-click GUI that enables Xbox mode / Full Screen Experience. **🧠 Confidence: medium** — proves automatability; exact registry keys still need on-device confirmation.

### The ASUS layer is drivers (function) + Armoury Crate (app), and they are separable

ASUS's own setup guide treats Armoury Crate SE as the app that *delivers* driver/firmware updates and the control surface (operating modes, button remap, calibration, gyro) — distinct from the drivers themselves.

> [ROG — 15 tips to set up and optimize your ROG Ally](https://rog.asus.com/articles/guides/15-tips--shortcuts-to-set-up-and-optimize-your-rog-ally/) — "Most of your important updates will come through the Ally's Armoury Crate Special Edition software… From the Settings tab open the Update Center. Update everything available." Armoury Crate owns operating modes (Silent/Performance/Turbo), the Command Center quick settings, button remapping, stick/trigger calibration, and gyro — i.e. the hardware control surface.

What this establishes:

- **The drivers are what make the hardware work** (System Control Interface / MCU / AMD GPU). Armoury Crate is the *UI* over them plus the updater.
- **TDP and fan are governed by ASUS through the embedded controller**, not Windows power plans — so they sit beside bootible's `powercfg`/registry tuning rather than on top of it.
- ASUS distributes drivers through Armoury Crate's Update Center or the device support page — **not winget**. This is the staging problem.

### bootible already proves the driver-staging pattern

bootible stages the MediaTek MT7922 Wi-Fi driver onto the USB because it is absent from the stock ISO; the same `$WinPEDriver$` / staging mechanism applies to ASUS drivers.

> `packages/app/resources/prepare-usb.ps1` — `Resolve-Driver` fetches the MT7922 driver and stages it; the autounattend consumes staged drivers during install. ASUS drivers are the same shape of problem (fetch + stage), differing only in source and that there are several.

### The conflict check: complementary, not competing

bootible's tuning writes power/registry settings; the ASUS layer drives hardware through firmware/EC. The only nominal overlap is CPU boost.

> bootible `optimization`/`power` modules set `PERFBOOSTMODE` and `powercfg` values (`packages/core/src/power.ts`, `optimization.ts`); Armoury Crate's "Eco Assist" can also toggle CPU boost. Overlap is last-writer-wins on one setting, not a structural conflict. **🧠 Confidence: medium** — verified by domain reasoning, not by running both together on hardware.

---

## What is still open (gaps to close before building)

These are the volatile, must-verify-on-source items — flagged honestly rather than guessed:

- **Exact ASUS driver set + URLs for the Ally X (RC72LA).** System Control Interface, MCU/ACPI, AMD GPU (Adrenalin). Source: the ROG Ally X support/download page. Best fetched at build time (like the Wi-Fi driver), since URLs and versions move. **STUB — needs source capture.**
- **Whether Armoury Crate SE installs silently** (and without dragging the wider ASUS software suite). **STUB — needs verification.**
- **The exact registry keys** for Xbox mode + "enter on startup," and the **package id** for the Xbox home app (likely `Microsoft.GamingApp` via winget). **STUB — lift from the community tool / confirm on-device.**
- **Driver/Armoury-Crate install ordering and reboot needs** at first logon (some ASUS drivers want a reboot, as HidHide already does). **STUB.**

---

## Why this matters

This finding is what turns the user's "pick a base" goal from a wish into a buildable plan: it establishes that **the OG experience is reconstructable on a clean install**, names the **three layers** a base is composed from (shell, drivers, ASUS app), and isolates the **one genuinely hard engineering problem** (ASUS driver staging) from the easy registry/winget work. The design (`design-base-layer.md`) builds the base/modifier model on top of this.
