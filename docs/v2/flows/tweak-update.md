---
description: The maintenance lifecycle journey — keep ~90% of a setup unchanged while editing one or two things (swap an emulator, flip a tweak) and re-applying idempotently
tags: [bootible, v2, flow, lifecycle, tweak, update, nl-config]
audience: { human: 50, agent: 50 }
purpose: { flow: 85, reference: 15 }
---

# Flow — Tweak & update

Changing one or two things without disturbing the other ~90%. This is the everyday loop that proves the declarative config is small, diffable, and safe to re-apply.

## Trigger

A user enters via the router with intent = **tweak** on an already-provisioned device.

## Stages

### 1. Edit the declarative config
- **Actor:** User (App: LLM · CLI: editor)
- **Action:** **Player** describes the change to the App — *"swap RetroArch for standalone PCSX2"* — and the LLM edits the config; **tinkerer** edits the file's one or two lines directly. `[NL→config]`
- **Output:** An updated Layer-1 config differing from the prior by a small delta.

### 2. Re-apply
- **Actor:** bootible
- **Action:** Apply idempotently — only the delta changes; the drift guard verifies the rest is untouched.
- **Output:** The device reflects the change; ~90% unchanged.

### 3. Push the updated config
- **Actor:** bootible
- **Action:** Push the new config to the target. `[point]`
- **Output:** The target holds the current config for the next wipe.

## Termination

The single change is applied, the rest of the setup is provably unchanged, and the target holds the updated config.

## Failure modes

- **Edit produces invalid config** → schema validation (`yaml-language-server` / CLI) rejects it before apply.
- **Re-apply would touch more than the delta** → the drift guard surfaces the unexpected change for confirmation.
- **Push fails** → the device is already updated; the config push retries so the target doesn't fall behind.
