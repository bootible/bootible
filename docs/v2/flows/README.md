---
description: Index and shared conventions for the bootible v2 flow set — one flow per file, written against provisioning models rather than device SKUs
tags: [bootible, v2, flows, index, conventions, provisioning, registry]
audience: { human: 50, agent: 50 }
purpose: { flow: 30, reference: 70 }
---

# bootible v2 — Flows

The concrete journeys bootible v2 must make real. Each flow lives in its own file (it is discussed individually, evolves at its own rate, and is referenced independently by design sections).

Flows are written against **provisioning models (the genus), not device SKUs (the species)**. Device-specific data — supported models, firmware options, folder layout, capability matrix, guide URLs, board-revision questions — comes from the **device registry**; flows reference it generically. Adding Anbernic / Retroid / Miyoo / Analogue / AYN / the next twelve devices is *registry data*, not new flows.

## The flow set

| Flow | File | Covers |
|---|---|---|
| **Router** | `router.md` | The front door: who/why/what-device → branch |
| **Provision — on-device** | `provision-on-device.md` | Device runs bootible itself (Win/SteamOS), plus the setup-USB variant |
| **Provision — host-media-prep** | `provision-host-media-prep.md` | Host writes a microSD (file-copy and image-flash firmware) |
| **Provision — guided** | `provision-guided.md` | Host preps media + user runs an on-device exploit via a maintained guide |
| **Provision — android-host** | `provision-android-host.md` | Host pushes to an Android device over ADB |
| **Restore after wipe** | `restore.md` | The headline lifecycle: point at your target, get everything back |
| **Tweak & update** | `tweak-update.md` | Keep ~90%, change one or two things |
| **Connect a target** | `connect-target.md` | One-time storage hookup |
| **Troubleshoot** | `troubleshoot.md` | LLM-assisted diagnosis and fix |

## Conventions

**Surfaces.** **App** = the LLM-assisted desktop app (player-leaning); **CLI** = `curl | bash` / `bootible <verb>` (tinkerer-leaning). Both are available to both personas; only the emphasis differs.

**Principle tags** (shown inline in each flow):

| Tag | Meaning |
|---|---|
| `[carry]` | Persist durable data (saves, BIOS) |
| `[regen]` | Reinstall tools fresh, never restore stale config |
| `[point]` | Point-at-your-target restore primitive |
| `[cap]` | Capability-aware selection (device only gets what it can run) |
| `[legal]` | User's own content only; never source/index/link game content |
| `[secret]` | Secrets local-only, never hosted |
| `[safe]` | Destructive-write safety: dry-run default, size/label shown, explicit confirm, **never auto-pick a block device** |
