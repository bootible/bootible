---
description: Prioritised work queue for bootible v2 after the 30 Jun hardware-validation + shared-component pass. Reviewed by humans, executed by agents.
tags: [todo, plan, v2, roadmap]
audience: { human: 50, agent: 50 }
purpose: { plan: 90, reference: 10 }
---

# bootible v2 — TODO

What's next, in priority order. Each item is scoped to be picked up cold in a fresh
session. Detailed running context lives in `.claude/session-journal.md`.

## Status snapshot

- **Branch:** `docs/v2` (alpha line; merge to `main` when alpha-ready).
- **Deck Path A (provision-only):** HARDWARE-VALIDATED end-to-end (app-built USB →
  boot → `provision.sh`) on a real Steam Deck.
- **Shared device-setup components — done + adopted:** `ProfileBar`,
  `NetworkSettings`, `SshAccessEditor`, `PasswordField`, `StreamingSettings`,
  `RemoteAccessSettings`. The Deck device-setup screen is fully composed of them.
- **Tests:** ~319 green. Gate = `npm test` (run in a separate call before committing —
  the verify-gate stamps after the whole command).

## Build commands

| Goal | Command |
|------|---------|
| Staging exe | `BOOTIBLE_API_BASE=https://api.staging.bootible.dev npm run dist -w @bootible/app` |
| Prod exe | `npm run dist -w @bootible/app` |
| Verify | `npm test` (separate call, before any commit) |

The built portable lands at `packages/app/dist/bootible.exe`; copy to
`Downloads\bootible.exe` (ask to close the app first if it's running).

---

## 1. Unified "report back when done" beacon — DO FIRST

Lower-risk and additive; gives the satisfying "the device reports done to the host"
payoff. Every device should announce completion the same way (the ROG headless flow
already does; the Deck doesn't).

- **Device side:** `generateDeckProvision` / `buildDeckBundle` take a `buildId`;
  `provision.sh` broadcasts `{bootible:1, buildId, ip, hostname, username, status:"done"}`
  over UDP on `BEACON_PORT` (50474) via `python3` (always present on SteamOS). Mirror
  the `beaconBody` in `packages/core/src/strip.ts`.
- **Build side:** `writeDeckProvisionUsb` (and the reimage writer) set `lastBuildId`
  (see the ROG path, `packages/app/src/main/index.ts:712`).
- **Host side (the missing piece):** the host only listens while `discovery:start` is
  active, and the Deck flow has no watch screen. Add a watch screen after the Deck
  write that calls `startDiscovery` and surfaces `beacon:device` — reuse the ROG watch
  screen pattern.
- **Done when:** a Deck running `provision.sh` shows up as "done" on the host watch
  screen, flagged "mine" via the matching `buildId`.

## 2. ROG account-screen convergence

Behaviour-neutral cohesion refactor — do it when NOT mid-hardware-testing (it rewires
the build path). Goal: one shared device-setup composition across ROG + Deck.

- Expand `StreamingSettings` with `showHost` (the "also set up Sunshine/Moonlight on
  this PC (host)" toggles).
- Use `RemoteAccessSettings` for RDP (option `disabled` when `edition !== "pro"`).
- Replace the static `ra-*` HTML on the account screen with the mounted components;
  consolidate the separate `#rog-sunshine-pass-mount` into `StreamingSettings`.
- Rewire `captureBuildChoice` (`remoteAccess` / `remoteAccessHost` / `sunshineUser`)
  and profile capture/apply to read JS state — same pattern the Sunshine password
  already uses (`rogSunshinePass` / `rogSunshinePromptPass`).
- **Watch out:** the `ra-sunshine` checkbox currently drives the host + creds reveal;
  preserve that. It all feeds the USB build — verify a built config is unchanged.

## 3. Hardware validation (rebuild USBs first — fixes are in core, not on old sticks)

- Greenlight install on a real ROG (GitHub-release Setup.exe, RunOnce/silent).
- Deck Path B (full reimage) flash on real hardware.
- Re-test Tailscale + StickDeck on the Deck with a freshly-built USB (the `deck-tailscale`
  + non-`win`-zip fixes landed in `deck-provision.ts`).

## 4. `GroupedPicker` (cohesion finding U6)

The app / emulator / password-manager pickers are still hand-built per device
(ROG `renderApps` vs Deck `renderDeckApps` etc.) — the last big duplication. Extract a
shared grouped-picker component and adopt on both.

## 5. Finish the device class/instance profile model

The model+family dropdown grouping is shipped. Remaining: rename `profile.deviceId`
→ `deviceModel`, add a true `instanceId` for devices we communicate with
(ssh/wifi/usb), and move the family-grouping main-side so the renderer needn't
re-implement `deviceFamilyOf`. See the `device-class-vs-instance` memory.

## 6. Decompose the `main.ts` / `index.ts` god-files

The standards now mandate it ([coding-standards.md](standards/coding-standards.md) §4:
no file over ~400 lines without a recorded reason; changes near the god-files must
leave them smaller). Reality: `renderer/src/main.ts` ≈ 4,000 lines and
`main/index.ts` ≈ 1,500. Carve features out into `app/` / `state/` / `components/`
/ `features/` / `devices/`. **This is P3 of the unified review** —
[standards/remediation-plan.md](standards/remediation-plan.md) — which holds the
full P0→P3 plan (security fixes, finishing the device convergence, retiring the
parallel seam, then decomposition as a consequence of those slices). Execute
against that plan, P0 first.

## 7. Merge `docs/v2` → `main`

When the alpha is ready (and after a clean visual sweep + hardware passes above).
