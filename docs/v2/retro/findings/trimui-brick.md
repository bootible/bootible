---
description: Verified TrimUI Brick / Brick Hammer reality for bootible host-media-prep — hardware, current firmware landscape, SD layout, capabilities, legal content, footguns. Corrects the 15 Jun handover assumptions.
tags: [trimui, brick, retro, host-media-prep, findings, firmware]
audience: { human: 55, agent: 45 }
purpose: { findings: 85, research: 15 }
---

# Findings: TrimUI Brick (host-media-prep)

**Answer up front:** the architecture already scoped for retro devices holds — TrimUI is **host-media-prep**, bootible writes a **single microSD** on the desktop (format → firmware → folder scaffold → optional save/theme restore), legal-content-only. But the device-specific detail (deferred earlier as "lighter re-verify") had real errors. The corrected picture: **single SD slot** (no OS/games split), **FAT32+MBR** default, **NextUI** is the newcomer default, and **CrossMix-OS does NOT yet run on the Brick** — which the prior scoping listed as an option. Researched June 2026; every version is **verify-at-build-time**. See [[steamos-bazzite-provisioning]] for the methodology precedent and `docs/v2/flows/provision-host-media-prep.md` for the flow this grounds.

## Corrections to the 15 Jun handover / findings

| Prior assumption | Reality |
|---|---|
| CrossMix is a Brick firmware option | ❌ **CrossMix-OS v1.3.0 (latest) explicitly does not support the Brick.** v1.4.0 "will be the first Brick version" — not shipped as of mid-2026. Brick port = **SunnyMix-OS**, still **beta**. |
| (implied) possible OS-card / games-card split | ❌ **Single TF slot.** All firmware + content on one card. |
| "stockmix" as a firmware peer | ⚠️ StockMix/SunnyMix are stock/CrossMix overlays; the real peer set is **NextUI / MinUI / Stock / Knulli / muOS**. |
| Brick "Hammer" as possibly distinct hardware | ✅ Hammer = **same internals**, aluminium shell. ⚠️ But **"Brick Hammer Pro U"** is a *totally different* device (Snapdragon/Android) — must not be conflated. |

## Hardware (TrimUI Brick, model TG3040)

- **SoC** Allwinner A133P (quad A53 ~1.8 GHz) · **1 GB** LPDDR4x · 8 GB eMMC · **3.2" 1024×768 (4:3)** laminated IPS.
- **Controls: no analog sticks** (D-pad + ABXY + L1/L2/R1/R2). This is a *capability-shaping* fact, not cosmetic.
- **One microSD slot** (≤1 TB), WiFi b/g/n, BT, USB-C. **Brick Hammer** = identical board, metal shell — same firmware.

## Firmware landscape (the "OS choice")

| Firmware | Base | Install method | Card | Source (verify version) | Brick status |
|---|---|---|---|---|---|
| **NextUI** ⭐ default | MinUI fork (LoveRetro) | **file-extract** | FAT32/exFAT, MBR | `github.com/LoveRetro/NextUI` | ✅ active, Brick-focused |
| **MinUI** | standalone | file-extract (`MinUI.zip` stays zipped!) | FAT32 | `github.com/shauninman/MinUI` | ✅ |
| **Stock** | TrimUI | **two parts:** `.awimg` recovery-flash + `assets_brick` SD package (extract, needs 7-Zip) | FAT32 | `github.com/trimui/firmware_brick` + `…/assets_brick` | ✅ ships on device |
| **Knulli** | Batocera | **image-flash** (dd/Etcher), multi-partition | SHARE=exFAT (Gladiator+) | `github.com/knulli-cfw/distribution` | ⚠️ was pre-alpha at launch; Scarab `20260511` exists — verify tier |
| **muOS** | MustardOS | **image-flash** | multi-partition | `muos.dev` (TUI-BRICK image) | ✅ |
| **SunnyMix-OS** | CrossMix port | file-extract | FAT32 | `github.com/SunnyRetroGaming/SunnyMix-OS` | ⚠️ **beta only** |

**Newcomer default = NextUI**: file-extract (no dd), FAT32, WiFi + RetroAchievements + art scraping atop a minimal UI. Stock = safest if they want manufacturer support. The two install *methods* map cleanly onto the existing flow's **Path B (extract)** vs **Path C (image-flash)**.

## Host-prep mechanics

- **Format: FAT32 + MBR** for all file-extract firmware. exFAT "appears to work but corrupts over time on the Brick" — avoid. >32 GB FAT32 needs the Rufus "Large FAT32" path (`diskpart`/a lib, since Windows GUI caps at 32 GB).
- **Layout differs per firmware** (registry `layout` per option):
  - MinUI: `Roms/<Name (SYSCODE)>/`, `Bios/<SYS>/`, `Saves/`; `MinUI.zip` at root **unextracted**.
  - NextUI: `Roms/<system>/`, `BIOS/<SYS>/`, `Saves/`.
  - Stock: `Roms/`, `RetroArch/.retroarch/system/` (BIOS), `Imgs/`, `Emus/`.
  - Knulli/muOS: image-defined; ROMs into `/userdata/roms/<batocera-code>/` (exFAT SHARE, **lowercase, case-sensitive**) after flashing.
- **Save round-trip:** for MinUI/NextUI the `Saves/` tree is stable across versions → snapshot before rewrite, restore after. Knulli saves live on the exFAT SHARE partition (Windows-readable post-flash). This gives retro devices the backup story bootible currently lacks.

## Capability matrix (A133P) — for the registry

- **Great:** NES, SMS, GB, GBC, GBA, SNES, Genesis/MD, Game Gear, NGP/C, Atari 2600/7800, **PS1**.
- **Good:** Nintendo DS, Dreamcast (better than expected).
- **Marginal — *and poor controls (D-pad only)*:** N64, PSP. ⚠️ The Brick has **no analog sticks**, so these are "not recommended" on the Brick even where the SoC copes. (The **Smart Pro**, same SoC + sticks, rates these higher — a per-device control flag, not just SoC.)
- **Not viable:** Saturn (likely), PS2, GameCube, Wii, Xbox.

## Legal day-one content (no ROMs/BIOS, ever)

- **ScummVM freeware** — publisher-released, downloadable from `scummvm.org/games/` (Beneath a Steel Sky, Flight of the Amazon Queen, Drascula, Lure of the Temptress, DreamWeb, …). Cleanest "something playable" out of the box.
- **PortMaster "Ready to Run"** free/open titles — Cave Story (freeware), 2048, Celeste Classic. ⚠️ **Avoid** the IP-risky decomps (AM2R, SM64-decomp, Sonic decomps) even though PortMaster lists them.
- **Pico-8** runs great but the engine is **commercial** (~$15) → not day-one.

## Footguns a host-prep tool must handle

1. **Wrong-model firmware = brick.** Each model has its own repo (`firmware_brick`/`assets_brick`); refuse mismatched files. **F1, highest severity.**
2. **exFAT corruption** → default FAT32+MBR.
3. **`MinUI.zip` must stay a zip** (don't auto-extract).
4. **BIOS filename case + double-extension** (`scph1001.bin`, not `.bin.bin`).
5. **MinUI ROM folder naming** is load-bearing: ASCII `Name (SYSCODE)`, no trailing space/smart-quotes.
6. **Stock = two downloads** (firmware repo + assets repo, separate release cycles); 7-Zip required for the assets package.
7. **Knulli SHARE** may not get a Windows drive letter after expand; case-sensitive lowercase roms folders.
8. **CrossMix not on Brick yet** — don't offer it (offer SunnyMix as beta, or omit).
9. **1024×768 assets** — themes/bezels built for other models will be wrong.
10. **FAT32 4 GB/file** — irrelevant for ROMs, but image-firmware must be *flashed* (dd), never copied as a file.

## What this means for bootible

- **Registry entry (`registry/devices/trimui.yml`) is the main artifact** — and the schema needs a **firmware-options** block the current schema (Deck/Ally) lacks: per option `{ id, name, method: extract|image, source, layout, default? }` plus a per-device **control capability** flag (so N64/PSP read "poor controls"). A draft entry accompanies this findings doc.
- The **host-prep executor** is new code but small + bounded: format (FAT32+MBR via `diskpart`), download+verify a pinned release, extract-to-card *or* image-flash (`etcher-sdk`), lay the `layout` scaffold, optional save round-trip, health-check expected dirs. The validated SteamOS USB-writer machinery (decompress, elevated partitioning, safe drive pick) overlaps heavily.
- **Pin firmware versions in the registry** (deterministic builds) with a "check for newer" nudge — matches the retro-CFW lesson that versions drift. NextUI/Knulli/muOS/Stock versions above are all **verify-at-build-time**.
- **Generalises:** the same firmware-options + layout + method shape covers Anbernic/Miyoo/Smart Pro/Analogue later — TrimUI Brick is the first concrete host-media-prep device.

## Open (verify before building)

CrossMix v1.4.0 / SunnyMix stability; exact Knulli-Brick tier; stock `assets_brick` folder names + save paths; current NextUI/muOS versions + filenames; PortMaster install path per firmware (native on Knulli; wrapper on MinUI).
