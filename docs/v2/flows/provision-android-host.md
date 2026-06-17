---
description: Provisioning an Android handheld from a host over (wireless) ADB — installing frontends/emulators and pushing settings/files, generalizing bootible's existing config/android stack
tags: [bootible, v2, flow, provisioning, android, adb, host]
audience: { human: 50, agent: 50 }
purpose: { flow: 85, reference: 15 }
---

# Flow — Provision: android-host (ADB)

The host reaches an Android device over (wireless) ADB and pushes apps, settings, and files. This generalizes bootible's existing `config/android/` stack — the in-tree proof that host-side provisioning already works. **Species (from registry):** Retroid, AYN Odin.

## Trigger

Router hands off with model = `android-host` and a device whose registry entry carries a `connection:` block (host/port/transport).

## Stages

### 1. Pair the device
- **Actor:** User + host
- **Action:** Pair over ADB (wireless or USB) per the `connection:` block.
- **Output:** An authorised ADB session to the device.

### 2. Apply declarative config
- **Actor:** Host (App/CLI)
- **Action:** Install APKs (frontends/emulators), push settings and files per the declarative config.
- **Output:** The device configured to the declarative config.

### 3. Connect your target
- **Actor:** Host
- **Action:** Sync saves + capability-aware content from the user's target. `[cap][legal]`
- **Output:** Saves restored; only runnable content pulled.

### 4. Verify
- **Action:** Confirm apps installed and settings applied.
- **Output:** Done.

## Termination

The Android device has its frontends/emulators installed, settings applied, and legal user-owned content synced.

## Failure modes

- **ADB pairing fails / device offline** → surface the pairing steps; nothing partial is left in an unknown state.
- **APK install blocked** (unknown sources, signature) → report per-app and continue; the receipt records what installed.
- **Wireless ADB drops mid-run** → idempotent re-run resumes from current device state.
