---
description: Design for bootible v1.0 — own the Windows handheld first hour (feature cut, release engineering, launch)
tags: [rog-ally, windows, v1.0, hibernate, g-helper, smart-app-control, update-repair, release, launch]
audience: { human: 55, agent: 45 }
purpose: { design: 80, plan: 10, north-star: 10 }
---

# bootible v1.0 — The Missing First Hour (Windows Handhelds)

Grounded in `docs/research/handheld-community-landscape.md`: no tool credibly owns one-command Windows handheld setup; the community's converged 8–12 step checklist is entirely manual; the top pains are broken sleep, Smart App Control vs Armoury Crate, and Windows updates re-breaking configuration.

## Goal

A fresh Windows handheld goes from OOBE to fully configured in one command, with nothing from the community checklist left to do by hand — and a re-run repairs what Windows Update broke. Shipped as a tagged v1.0 with a community launch.

**Success criteria (testable):**
- Fresh Ally X: `irm bootible.dev/rog | iex` → dry-run → `bootible` completes every item on the parity checklist without manual steps
- After a simulated config regression (e.g. hibernate disabled, Game Bar reinstalled), re-running `bootible` detects and repairs it
- After a real run, `Bootible - Read Me.md` exists on the Desktop listing installed apps, applied config changes, and FAQ/first-aid for the documented pains (Smart App Control, winget sources, sleep/hibernate)
- A tagged v1.0 release exists; the one-liner serves it; main is the beta channel
- Launch post and creator pitches drafted in-repo, reviewed by Gavin
- The July Vengeance wipe+bootstrap runs on the v1.0 release candidate

## Components

### 1. Power module — sleep → hibernate (`config/rog-ally/modules/power.ps1`, new)

The #1 community pain: Modern Standby drains 10–23% battery in 12h and wakes unreliably.

Config keys (all default-off to preserve existing behavior):
```yaml
sleep_mode: "hibernate"          # hibernate | default — maps power buttons/lid to hibernate, disables standby timeouts
hibernate_after_minutes: 30      # 0 = immediately on idle-sleep boundary
power_button_action: "hibernate" # hibernate | sleep | shutdown
```
Implementation: `powercfg` (hibernate enable, button actions per power scheme, standby timeouts). Document explicitly what is NOT controllable (firmware-level Modern Standby behavior). Runs in module order after `optimization`.

### 2. G-Helper install (`config/rog-ally/modules/rog_ally.ps1`)

`install_ghelper: true` (default false). The 13.6k★ community-standard Armoury Crate alternative.
- Fetch latest release asset from `github.com/seerge/g-helper` via GitHub API; verify size/hash; install to a stable path; configure autostart (scheduled task or Startup shortcut, matching G-Helper's own convention)
- Idempotent: skip when present at expected path; update only with `-Force`
- Armoury Crate is left untouched — coexistence, not removal

### 3. Smart App Control detection (`lib/config-validation.ps1` + `modules/health.ps1`)

SAC silently and irreversibly breaks Armoury Crate components; users discover it via mystery failures.
- Read SAC state (`HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy`, VerifiedAndReputablePolicyState)
- Dry-run and health checks surface state with plain-language guidance (off = fine; evaluation/on = warn with documented trade-off and link)
- Detection + guidance only: SAC cannot be programmatically disabled (one-way switch, reset to restore)

### 4. Update guard / repair (`modules/health.ps1` + new `lib/state-snapshot.ps1`)

bootible's structural advantage over one-shot scripts: re-running repairs drift.
- After a successful real run, write `state.json` to the private device instance folder (`private/device/rog-ally/<Instance>/state.json`): applied debloat items, power config (hibernate/button mappings), wallpaper/lockscreen hashes, installed-package set, GPU driver version, relevant service start states
- On re-run, diff live system vs snapshot before modules execute; report drift in a "DRIFT" section; modules then re-apply (they are already idempotent) and the snapshot refreshes
- Driver version drift is report-only (no automatic driver rollback — too risky)
- Dry-run shows the drift report without repairing

### 5. Checklist parity audit (analysis task feeding small module gaps)

Walk the converged community checklist (XDA starter guide, HowToGeek 20 tips, baldsealion guide, ASUS official) against existing modules; implement small gaps as config keys in existing modules; document intentional exclusions with reasons. Output: a parity table in docs (`docs/checklist-parity.md`) usable as launch collateral ("every item, one command").

### 6. On-device receipt + help file (`lib/receipt.ps1`, new)

After every real run, write `Bootible - Read Me.md` to the device's Desktop (overwritten each run) so the answer to "what did this thing do, and why is X broken?" lives on the device itself.

Contents, generated from run data (no hand-maintained duplication):
- **What happened**: device/instance name, bootible version, run outcome — apps installed/skipped/failed (from `$Script:InstallResults` / `Write-Summary`), config changes applied per module (hibernate enabled, debloat items, wallpaper, SSH, etc.), and the drift/repair report once update guard lands
- **FAQ / first aid**: rendered from a maintained template (`config/rog-ally/files/receipt-faq.md`) covering the documented pains — Smart App Control breaking Armoury Crate (symptoms + trade-off), winget source failures (`winget source reset --force`), sleep vs hibernate behavior, where run logs live, how to re-run (`bootible`) and what re-running repairs
- **Links**: docs-site troubleshooting, GitHub issues, Discord

Dry runs write nothing to the Desktop. Pure-function tests cover receipt content generation (results → markdown) independent of filesystem.

## Release engineering

- Tagged releases (`v1.0.0`, semver) with changelogs (manual tag + GitHub release notes to start)
- Cloudflare worker (`cloudflare/_worker.js`) serves release-tagged raw URLs for the one-liner; `bootible.dev/rog-beta` serves main
- Checksum workflow extends to release assets; bootstrap validates fetched script checksums as today
- Devices clone at the bootstrapped release tag; the bootstrap's existing clone/git-pull step (`targets/ally.ps1:652`) changes to fetch + checkout the served release tag, so re-bootstrapping moves a device between releases deterministically

## Launch plan (drafted in-repo, nothing sent without review)

- README repositioned: "the missing first hour for Windows handhelds"; fix the contributor pointer at the gitignored `docs/ai-context/` (point to docs-site or un-ignore a public subset)
- 60-second demo: fresh Ally → configured (screen recording, docs-site + README)
- `docs/launch/reddit-rogally-post.md` — launch post draft
- `docs/launch/creator-pitches.md` — rogallylife + ETA PRIME pitch drafts
- Timing target: ROG Xbox Ally X20 cohort (H2 2026)

## Testing

- TDD per module: Pester units (suite runs locally on WSL via the winget-stub pattern); regression guards in the PrivateLayout style where path/layout assumptions exist
- State snapshot/diff logic gets pure-function tests (snapshot building, drift computation) independent of Windows APIs
- Hardware validation: dry-run + real run on Vengeance — the July refresh IS the v1.0 release-candidate test
- CI unchanged: windows-latest Pester + PSScriptAnalyzer + checksums

## Out of scope

SteamOS-on-Ally (approach B — separate spec), save sync / household features (C), Android, Armoury Crate removal, automatic driver rollback, Legion Go / MSI Claw native profiles (detection continues to map them to the rog-ally profile).

## Risks

- Windows-handheld segment leaking to SteamOS (mitigation: approach B is the planned fast-follow; the Ansible side already exists)
- `powercfg`/registry behavior differs across Windows builds — features ship default-off with per-key dry-run reporting
- G-Helper is a third-party binary: pin + verify releases; never auto-update silently
- Solo-maintainer surface growth: every feature lands with tests and config-key docs, or it doesn't land
