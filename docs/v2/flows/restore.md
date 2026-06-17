---
description: The headline lifecycle journey — a freshly wiped device is restored to ~90% of its prior state by pointing bootible at one target and entering one credential
tags: [bootible, v2, flow, lifecycle, restore, wipe, point-at-target]
audience: { human: 50, agent: 50 }
purpose: { flow: 85, reference: 15 }
---

# Flow — Restore after wipe ("point at your target")

The journey that justifies the whole redesign. A user wipes a device (every ~6 months) and wants it back to ~90% of where it was. The restore primitive is **"point at your target"**: one credential unlocks config, durable data, and capability-filtered content.

## Trigger

A fresh/post-wipe device enters via the router with intent = **restore**.

## Stages

### 1. Locate your stuff
- **Actor:** User
- **Action:** *"Where's your stuff?"* — connect the target and enter **the one credential** it needs. `[secret][point]`
- **Output:** An authenticated connection to the target.

### 2. Pull and apply declarative config
- **Actor:** bootible
- **Action:** Pull Layer-1 config from the target; re-apply it, reinstalling tools fresh. `[regen]`
- **Output:** Apps/emulators/tweaks restored to the declared state.

### 3. Restore durable data
- **Actor:** bootible
- **Action:** Pull saves/BIOS from the target. `[carry]`
- **Output:** Irreplaceable data back in place.

### 4. Capability-aware content sync
- **Actor:** bootible
- **Action:** Pull only the content this device can run. `[cap][legal]`
- **Output:** A library matched to the device.

### 5. Re-enter remaining secrets
- **Actor:** User
- **Action:** Provide any other secrets (Wi-Fi, etc.) as prompted. `[secret]`
- **Output:** Device fully operational.

### 6. Receipt
- **Action:** Write a receipt of what was restored.
- **Output:** A ~90%-identical device.

## Termination

The device is ~90% identical to its pre-wipe state: declarative config re-applied, saves/BIOS restored, content matched to capability, with only a credential (and any non-target secrets) re-entered by hand.

## Failure modes

- **Wrong/missing credential** → cannot reach the target; restore halts cleanly with a retry, nothing half-applied.
- **Partial target (config present, saves absent)** → restore what exists; receipt states what was missing.
- **Tool reinstall fails** (`[regen]`) → reported per-tool; durable data is still restored regardless.
