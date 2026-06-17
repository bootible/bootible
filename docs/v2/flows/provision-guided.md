---
description: Provisioning a device whose custom firmware requires an on-device exploit — bootible preps the media on a host and hands off to a maintained external guide for the exploit chain
tags: [bootible, v2, flow, provisioning, guided, cfw, exploit, hand-off]
audience: { human: 50, agent: 50 }
purpose: { flow: 85, reference: 15 }
---

# Flow — Provision: guided (exploit chain)

The host preps the media; the user runs an on-device exploit by following a **maintained external guide**. bootible automates what is automatable (media prep + config/state) and **never hard-codes the exploit steps** — they drift, and the maintained guide is the durable source. **Species (from registry):** New 3DS XL (MSET9 → Luma3DS), PSP-2002 (FasterARK → ARK-5 / Infinity).

## Trigger

Router hands off with model = `guided` and a device whose registry entry carries a `guide:` URL and (optionally) `questions:`.

## Stages

### 1. Prep the media on the host
- **Actor:** Host (App/CLI)
- **Action:** Download the CFW core `[pinned/verified]`, lay down the structure, and run any host-side exploit-prep (e.g. 3DS `mset9.py`, configured per model/firmware). `[safe]`
- **Output:** A card/Memory Stick staged with the CFW core + structure.

### 2. Device-specific branch
- **Actor:** User + registry
- **Action:** Answer registry `questions:` — e.g. PSP board-revision → cIPL/CustomIPL vs Infinity 2.0.
- **Output:** The correct on-device path selected for this unit.

### 3. Hand off to the maintained guide
- **Actor:** User (App: LLM can answer questions)
- **Action:** App/CLI opens the maintained guide (`3ds.hacks.guide` / `pspunk.com`) and the user runs the on-device exploit. `[legal]`
- **Output:** CFW installed on the device by the user.

### 4. Post-exploit finalize
- **Actor:** Device + (host cleanup if any)
- **Action:** On-device finalize (3DS finalize *auto-installs the homebrew apps* `[regen]`); host-side cleanup where required (3DS `mset9.py` removal).
- **Output:** A finished CFW environment.

### 5. Connect your target
- **Actor:** Host/App
- **Action:** Sync saves + capability-aware content from the user's target. `[point][cap][legal]`
- **Output:** Saves restored; only content the device can run is pulled.

### 6. Verify
- **Action:** Confirm the device boots CFW and the expected structure is present.
- **Output:** Done.

## Termination

The device runs CFW (installed by the user via the guide), durable data is restored, and only legal, user-owned content has been synced.

## Failure modes

- **Guide is unreachable / changed** → the App surfaces the canonical URL and recent status; bootible never substitutes hard-coded steps. (Findings flags `psp.hacks.guide` dead → use `pspunk.com`.)
- **Wrong board-revision path (PSP)** → registry `questions:` force the choice up front; the guide's warnings are surfaced.
- **Version drift** → registry pins + build-time re-verify; the staged core is checksum-verified `[pinned/verified]`.
