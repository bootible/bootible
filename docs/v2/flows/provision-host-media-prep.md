---
description: Provisioning a retro handheld by writing its microSD from a host computer — file-copy firmware (the common path) and image-flash firmware (Knulli-class)
tags: [bootible, v2, flow, provisioning, host-media-prep, microsd, firmware]
audience: { human: 50, agent: 50 }
purpose: { flow: 85, reference: 15 }
---

# Flow — Provision: host-media-prep (microSD retro)

The host writes a microSD; the device boots firmware from it; no exploit is involved. **Species (from registry):** TrimUI (NextUI/CrossMix/StockMix), Anbernic, Miyoo, Analogue (FPGA cores). Most firmware is **extract-to-card** (Path B); a minority ships as a **disk image** (Path C).

## Path B — file-copy firmware (the common path)

### Trigger
Router hands off with model = `host-media-prep` and a device whose chosen firmware uses `method: extract`.

### Stages

1. **Choose firmware** — registry lists options + recommends a default; App/LLM explains the trade-off.
2. **Insert card; safe drive pick.** `[safe]`
3. **Format** FAT32 (or as the firmware requires).
4. **Extract-to-card** — download the firmware release `[pinned/verified]`, lay down the folder structure from the registry `layout`.
5. **Connect your target** (optional) — sync saves/themes; capability-aware content pull. `[point][cap][legal]`
6. **Verify** — expected dirs/key files present (health check).
7. **Eject** → *"put it in and turn it on."*

### Termination
The card carries the chosen firmware + folder scaffold (+ optional saves/content); the health check passed.

## Path C — image-flash firmware

### Trigger
Same as B, but the chosen firmware uses `method: image` (e.g. Knulli, Batocera-class).

### Stages
Identical to Path B, except stages 3–4 collapse into a single **image-flash via `etcher-sdk`** (write + verify). Heightened `[safe]` emphasis — this overwrites the whole card.

## Fork (both paths)

- **Tinkerer:** `bootible trimui --firmware nextui --target /dev/sdX`.
- **Player:** clicks through; the LLM explains the firmware choice and narrates.

## Failure modes

- **Wrong/auto-picked drive** → prevented by `[safe]`: explicit `--target`/selection, size + label shown, confirm required.
- **Firmware download fails checksum** → abort before writing; nothing touches the card.
- **Verify finds missing dirs** → report and offer re-run; card is not declared ready.
