---
description: Prioritised work queue for bootible v2, re-baselined 27 Nov 2026 after the July hardware round + E2E harness. Reviewed by humans, executed by agents.
tags: [todo, plan, v2, roadmap]
audience: { human: 50, agent: 50 }
purpose: { plan: 90, reference: 10 }
---

# bootible v2 — TODO

What's next, in priority order. Each item is scoped to be picked up cold in a fresh
session. Detailed running context lives in `.claude/session-journal.md`.

## Status snapshot

- **Branch:** `docs/v2` (alpha line; merge to `main` when alpha-ready).
- **Deck Path A (provision-only):** hardware-validated end-to-end on a real Steam Deck.
- **Deck Path B (full reimage):** GPT relocation implemented (`resources/deck-gpt.ps1`,
  Pester-tested); **not yet boot-tested on a Deck.**
- **E2E harness:** `npm run test:e2e` against `ti` Hyper-V VMs — see
  [test/e2e/README.md](../../test/e2e/README.md).
- **Gate:** `npm test` (vitest) + Pester (`tests/*.Tests.ps1`). Run in a separate call
  before committing — the verify-gate stamps after the whole command.

## Build commands

| Goal | Command |
|------|---------|
| Staging exe | `$env:BOOTIBLE_API_BASE="https://api.staging.bootible.dev"; npm run dist -w @bootible/app` |
| Prod exe | `npm run dist -w @bootible/app` |
| Verify | `npm test` (separate call, before any commit) |
| E2E | `npm run test:e2e -- --vm <bazzite\|win11\|win11home>` |

The built portable lands at `packages/app/dist/bootible.exe`; copy to
`Downloads\bootible.exe` (ask to close the app first if it's running).

---

## 1. Hardware round (rebuild USBs first — fixes are in the scripts/core, not old sticks)

- **Deck Path B:** build a reimage USB with the new GPT code → boot the Deck from it →
  Reimage → confirm SteamOS boots AND the BOOTIBLE partition is readable.
- **ROG:** one real clean-install USB build + account setup (the account screen was
  rebuilt into shared Section cards, ID-preserving — re-validate the zero-touch path),
  then SSH in and read `C:\bootible\bootstrap.log`.
- Greenlight install on a real ROG (GitHub-release Setup.exe, RunOnce/silent).

## 2. Decompose `packages/app/src/main/index.ts` (~1,490 lines)

The renderer god-file is done (`renderer/src/main.ts` 4,022 → ~370). The main-process
file is the last one over the ~400-line standard
([coding-standards.md](standards/coding-standards.md) §4). Carve the USB writers,
Deck writers, discovery and IPC registration into their own modules.

## 3. Merge `docs/v2` → `main` + alpha exe on GitHub

After the hardware round passes.

## 4. Android (AYN Thor) — next device family

Scope as a new family (findings → registry entry) once the above is closed.

---

## Done since the 30 Jun baseline

- Unified "report back when done" beacon on the Deck (`beaconBlock` in `deck-provision.ts`).
- ROG account-screen convergence (shared Section cards + `ACCESS_LABELS`).
- `GroupedPicker` extracted and adopted on both devices.
- Device class/instance model: `deviceId` → `deviceModel` (migrated on read).
- Renderer decomposition (`features/rog/*`, `features/auth/*`).
- Default-browser picker (both OSes); E2E harness (`test/e2e`).
