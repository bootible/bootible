---
description: What is true today about bootible before v2 design — repo survey, June-2026 device/CFW truth, constraints, and the decided direction
tags: [bootible, v2, findings, provisioning, emulation, cfw, sync, declaration]
audience: { human: 50, agent: 50 }
purpose: { findings: 80, reference: 20 }
---

# bootible v2 — Findings

**Status:** Findings (ODAD step 1 — current truth, before design)
**Author context:** Written from a live survey of the bootible repo + June-2026 device/CFW research + a recorded brainstorm with Gavin. This is *what is true*, not *what we will build*. The north star, flows, design, and plan follow.

---

**Question**: What is true about bootible today — its architecture, the new target devices, the constraints, and the direction already settled in brainstorm — before any v2 design begins?

---

**Answer**: bootible today is *a script that runs on your handheld*; v2 makes it *a tool that provisions any handheld and makes your setup portable*, serving a non-technical player and a power user with the same artifacts. The repo survey shows two on-device targets (ROG Ally, Steam Deck), one already-working host-side target (`android.sh`), a three-layer config merge, and a private-repo mechanism that v2 exists to delete. EmuDeck is already *staged, not snapshotted* — confirming the brainstorm call. Three new retro targets (TrimUI, PSP-2002, New 3DS XL) introduce a `provisioning_model` field with three values (`on-device` / `host-media-prep` / `guided`); the device/CFW truth is volatile and corrected the stale handover doc in several places (ARK-4 retired, board-rev matters, 3DS finalize auto-installs apps, N64 not viable). Five constraints (legal, EmuDeck, free-tier, client-side secrets, two personas) wall in the design. The driving problem is one thing wearing three hats: **bootible has no portable, declarative representation of *your setup***. The direction is decided (portable artifact in three durability layers, "carry don't snapshot", orchestrate-never-host bulk data, one "point at your target" restore primitive, RomM link-not-provision, build order Config Foundation → Retro targets → Sync backends → bootible.dev). Eight questions remain open for the design layer.

---

## 0. What v2 is

**One-line**: bootible today is *a script that runs on your handheld*; v2 makes it *a tool that provisions any handheld and makes your setup portable*.

**Who it serves**: the same artifacts serve both a **non-technical person who wants a great emulation experience** and a **power user**.

**The redesign, scoped whole, then sliced into phases:**

1. **Config Foundation** — the portable config artifact + the wipe/restore lifecycle (kills the private repo)
2. **Retro targets** — TrimUI / PSP / 3DS via a new `provisioning_model` concept
3. **Sync backends** — USB → Syncthing / S3 / NAS / RomM, with capability-aware selection
4. **bootible.dev** — the free-tier, account-based authoring/storage surface

---

## 1. Current architecture (from repo survey, `path:line` cited)

### 1.1 Target model

- `targets/ally.ps1` and `targets/deck.sh` are **bootstrap scripts** that set up the environment then hand off to a device runner; `config/` never references them (one-way). `targets/android.sh` exists as an **ALPHA host-side target** (see §1.5).
- **Why `ally.ps1` re-invokes itself**: `irm | iex` kills stdin and breaks Git Credential Manager (`ally.ps1:20-35`).
- **Release channel**: `$Script:BootibleRef` (`ally.ps1:61`) drives `Clone-Bootible` (`ally.ps1:519-570`) — `"main"` pulls main, a tag checks out that tag.
- **Cloudflare Worker** `cloudflare/_worker.js` routes `/rog /deck /android` (`_worker.js:12-33`), serves `STABLE_REF` (`_worker.js:54,80-82`) on stable and `main` on `*-beta`, verifies SHA256 before caching (`_worker.js:113-128`). **Device-agnostic and reusable for v2.**
- **Device detection**: `detect_device()` (`ally.ps1:103-132`, `deck.sh:226-267`) — all Windows handhelds → `"rog-ally"`; SteamOS/Arch → `"steamdeck"`. Called first in `Main` because it sets the log path.

### 1.2 Config model

- **Shape**: flat YAML with boolean feature toggles. Ally `config/rog-ally/config.yml` (~290 lines, sectioned SYSTEM/GAMING/EMULATION/…); Deck `config/steamdeck/config.yml` (Flatpak-first, nested `decky_plugins`).
- **Three-layer merge** (defaults → local override → private instance):
  - Ally: `config.yml` → `~/.config/bootible/rog-ally/config.yml` → `private/device/rog-ally/<Instance>/config.yml` (`Run.ps1:990-1019`). `-ConfigFile` collapses the last two.
  - Deck: `vars_files` → `include_vars` from `~/.config/...` → `-e @<private>/config.yml` (`playbook.yml:20-75`).
- **Engine**: parsed by `powershell-yaml`, deep-merged by pure `Merge-Configs` (`lib/helpers.ps1:13-29`).

### 1.3 The private-repo mechanism (the thing v2 replaces)

- **Layout**: `private/device/<device>/<Instance>/{config.yml, Logs/, Images/, state.json}` + `private/scripts/` + `private/ssh-keys/`, scaffolded by `init-private-repo.sh`.
- **Activation**: `$env:BOOTIBLE_PRIVATE` (`ally.ps1:55`) or interactive `y/N` + `owner/repo` prompt.
- **GitHub Device Flow auth** (both platforms), OAuth client id `178c6fc778ccc68e1d6a` (the public `gh` CLI id): POST device code → show **QR** (WinForms popup on Ally `ally.ps1:218-268`; terminal `qrencode` on Deck) → poll for token → `gh auth login --with-token` → `gh auth setup-git`.
- **Instance discovery**: pure `Find-PrivateDeviceConfigs` (`lib/helpers.ps1:66-96`), new layout + legacy fallback; drives `Select-Config` (`ally.ps1:717-777`) and a re-run prompt (`Run.ps1:81-112`).
- **Log push**: transcript captured, moved into `…/Logs/`, then git `add/commit/push` at end of run.

**Every touch-point to remove:** `Setup-Private`, `Select-Config`/`select_config`, `Find-PrivateDeviceConfigs`, the device-flow auth, the log move/push blocks, `init-private-repo.sh`, `$env:BOOTIBLE_PRIVATE`, `$Script:PrivateRoot`.

### 1.4 EmuDeck handling (confirms the brainstorm decision)

- **Finding**: EmuDeck is **staged, not installed**. Ally `modules/emulation.ps1`: gate `install_emulation`, idempotent already-installed detection (`:13-28`), EA launcher resolved from `private/scripts/` then device fallback (`:44-54`), launched via `Start-Process` (`:67-70`) or the public installer is `iex`'d (`:76-78`). bootible **returns without waiting for the wizard.**
- **Deck mirrors this**: stages `EmuDeck.desktop`/`.AppImage` from `private/scripts/` with fallbacks; **the wizard is manual.** Deck *does* create `{roms,bios,saves,states}` scaffolding; Windows does not.
- **Implication for v2**: bootible already does *not* own or snapshot EmuDeck's config — it stages a launcher and the user runs the wizard. Gavin's "carry it, don't snapshot" is already the de-facto model; v2 formalizes it.

> Gavin, brainstorm 2026-06-15/16 — on keeping the installer but not the config: *"install is fine and its nice to be able to install"* and *"Emudeck changes too much and it would just go stale"*

### 1.5 The on-device assumption — and its one exception

- **The assumption**: Ally and Deck are **fully on-device** (PowerShell on the Windows handheld; Ansible `connection=local` on the Deck). No abstraction permits host-side execution.
- **The exception (the v2 blueprint)**: `targets/android.sh` + `config/android/` is a **working HOST-SIDE provisioning model** — runs on the host, reaches the device over wireless ADB (`config/android/lib/adb-helpers.sh`, `apk-install.sh`, `files.sh`, `settings.sh`), with a `connection:` block (host/port/transport) in its config. **This is the v2 blueprint for `host-media-prep` — the pattern is not greenfield.**

> Gavin, brainstorm 2026-06-15/16 — the question that opened up host-side provisioning: *"do those have to be on device, could they be host provisioned?"*

### 1.6 Tech debt that blocks the v2 abstraction

- **Dual `Get-ConfigValue`:** `lib/helpers.ps1:37-57` (3-param, explicit `$Config`, pure/testable) vs `Run.ps1:486-504` (2-param, implicit `$Script:Config`, shadows the lib version). Modules can't be lifted host-side until this is resolved.
- **Dual schema validators:** `lib/config-validation.ps1:Validate-Config` (~27 rules) and inline `Run.ps1:Validate-ConfigSchema` (~80 entries, enum support) both run every execution, overlapping.
- **14 modules use dot-sourced `$Script:Config` globals** (`Run.ps1:1130-1158`) — no injection boundary, so they only run in the runner's scope.
- **Reusable as-is:** `lib/helpers.ps1` pure fns, `lib/state-snapshot.ps1` (drift logic), `cloudflare/_worker.js`, the `config/android/` host-side stack.

### 1.7 Docs

- **Internal** (archived under `docs/v1/` during the v2 redesign): `architecture.md`, `releasing.md`, `superpowers/{specs,plans}/`. The v2 declaration chain lives at `docs/v2/`.
- **Published**: `docs-site/` (MkDocs).
- **Most directly describes what v2 removes**: `docs-site/getting-started/config-repo.md`.

---

## 2. The new targets — device & CFW truth (June 2026, re-verify at build time)

A new first-class field, **`provisioning_model`**, branches the framework:

| Model | Meaning | Devices |
|---|---|---|
| `on-device` | bootible runs on the device (today) | Steam Deck, ROG Ally |
| `host-media-prep` | bootible runs on a host, writes the device's removable media | TrimUI Brick/Hammer |
| `guided` | host preps media **and** the user runs an on-device exploit via a maintained external guide | PSP-2002, New 3DS XL |

- **Invocation**: these are **explicitly invoked** (`bootible.dev/trimui|psp|3ds`), kept out of `detect_device()`.
- **Safety**: dry-run-by-default becomes **safety-critical** (destructive media writes); never auto-pick a block device.

> Gavin, brainstorm 2026-06-15/16 — the device universe in scope: *"Im thinking about Anbernic/Retroid/Miyoo/Analogue/AYN/Trimui"* (the three retro targets below are the first cut; the registry-entry approach must generalise to the rest).

### 2.1 TrimUI Brick / Brick Hammer — `host-media-prep`

- **Hardware**: Allwinner A133P, Linux-on-microSD, no analog sticks.
- **Firmware is the "OS choice"**: `nextui` (default, MinUI fork, minimalist, extract-to-card), `crossmix` (feature-rich + RetroAchievements), `knulli` (Batocera fork, **needs image-flash/`dd`**), `stockmix`.
- **Host's job**: write the card (format → write firmware → folder structure → optional save/theme sync).
- **Confidence / staleness**: firmware specifics from the handover doc; **lighter re-verify than PSP/3DS.**

### 2.2 Sony PSP-2002 — `guided` — **scene in flux, handover doc was stale**

- **Finding (CFW path moved)**: **ARK-4 is RETIRED** (final v4.20.69 r206, 15 May 2026). Current path = **ARK-5** (`github.com/PSP-Arkfive/ARK-5`), **pre-release only, no stable tag** (first pre-release 22 May 2026); bootstrap installer = **FasterARK** (`PSP-Arkfive/FasterARK`).
- **Finding (guide is dead)**: **`psp.hacks.guide` is DEAD** (ECONNREFUSED). Link **pspunk.com/psp-cfw** (covers ARK-5, updated June 2026) + the FasterARK GitHub instead.
- **Correction (board revision matters)**: handover doc said it didn't. Most 2000-series use cIPL/CustomIPL, but **TA-088v3 must use Infinity 2.0** (cIPL blocked at Tachyon). One-question branch. *ARK-5 + Infinity on TA-088v3 is UNVERIFIED — flag.*
- **Host/device split**: **host** formats Memory Stick (FAT32; PRO Duo via microSD adapter), copies the `PSP/` folder + payloads + `/ISO /SEPLUGINS` structure. **Device**: user runs FasterARK → CustomIPL (or Infinity) on OFW 6.61.
- **Legal day-one content**: **ScummVM ships 11 freeware games** (Beneath a Steel Sky, Flight of the Amazon Queen…) — nameable. RetroArch-on-PSP is poor (use standalone emus); POPS = PS1 *capability* only.
- **Version strategy**: ARK-5 in flux → embed ARK-4-final as frozen known-good baseline + link ARK-5 forward (preferred), or fetch-latest.

### 2.3 New Nintendo 3DS XL — `guided` — **healthy, frozen scene (lowest-risk first retro target)**

- **Finding (scene frozen)**: firmware frozen at 11.17.0 since May 2023; scene in maintenance mode. Exploit = **MSET9** (zoogie), works on **all models, fw 11.4–11.17, no hardware/serial gate** (handover doc's "not gated" claim CONFIRMED). super-skaterhax = inconsistent fallback; safecerthax does NOT work on New models.
- **Finding (guide is canonical AND maintained)**: **`3ds.hacks.guide`** — last commit 1 June 2026, the opposite of PSP's dead guide. Sole hand-off link.
- **Finding (exploit is part host-automatable)**: **MSET9 has a host-side `mset9.py` step** (configures the exploit per model/fw on the PC). Flow: host prep + `mset9.py` → on-device Mii-Maker/Data-Management trigger + SD eject/reinsert → host cleanup → on-device finalize.
- **Correction (finalize auto-installs apps → simplifies bootible)**: the **on-device finalize script auto-installs the homebrew apps** (Checkpoint, Universal-Updater, GodMode9-as-CIA, etc.). So the handover doc's per-tool `install_X: true` toggles mostly **don't** map to host-staging — bootible host-stages only the **CFW core** (MSET9 bundle, `boot.firm`, `GodMode9.firm`, finalize payloads, optional `open_agb_firm.firm`); the apps arrive on-device free. **Simplifies bootible's job.**
- **Correction (N64 not viable)**: handover doc said "attemptable" — **wrong**. DaedalusX64-3DS is unplayable; omit from capability claims. Viable: native 3DS/DS, hardware GBA via open_agb_firm, NES/SNES/Genesis/GG via native apps/TWiLightMenu, PS1 partial (New only).
- **Media**: microSD under back plate (JIS-00 screws). FAT32/MBR, official cap 128GB. Pin named releases (Luma3DS v13.4, GodMode9 v2.2.3, boot9strap v1.4 constant; open_agb_firm still beta).

### 2.4 Cross-cutting for the new targets

- **Confidence / staleness**: versions drift fast (PSP especially) → **re-verify at build time.**
- **Design preference**: prefer maintained external guides over hard-coded exploit steps.
- **What's precious**: firmware/media is regenerable, **saves are the precious durable thing.**

---

## 3. Constraints (the walls v2 builds within)

| # | Constraint | What it forbids / allows |
|---|---|---|
| 1 | **Legal** | bootible is a *pipe* between a handheld and *the user's own storage*. It never ships, indexes, or sources ROMs/ISOs/CIAs/BIOS. Where content is named, only legal first-party / homebrew / public-domain. (RomM = the user's *own* self-hosted library.) |
| 2 | **EmuDeck** | The EA binary can't be redistributed or its setup scripted; bootible *can* install/stage it (and that's worth keeping). Its config is **not** snapshotted (it drifts too fast to restore cleanly). |
| 3 | **Free tier** | The eventual bootible.dev account/storage must fit Cloudflare's free tier — so it stores only the **kilobyte** config, never the gigabyte bulk. |
| 4 | **Secrets client-side** | Wi-Fi passwords and storage credentials never leave the user's device/keystore — never hosted. (Carried over from the wizard trust property.) |
| 5 | **Two personas, both first-class** | Non-technical ("great emulation experience, no terminal, no GitHub") *and* power user ("it's just a file I own, version it how I like"). Easy for both, robust for both. |

> Gavin, brainstorm 2026-06-15/16 — the legal line, verbatim: *"if we talk about ROMS at any point we only ever mention legal first party accepted ones. I dont need Nintendo suing me"*

---

## 4. Why v2 (the problem)

**The core finding**: the private repo, the "EmuDeck-can't-be-scripted" pain, and "how do retro configs survive a wipe" are **the same problem wearing three hats** — bootible has no portable, declarative representation of *your setup*. The private repo was a workaround.

**The driving scenario**:

- A user wipes every ~6 months and wants to keep their setup **~90% identical**.
- They want to tweak one or two things, swap one emulator.
- That demands a **small, human-readable, diffable artifact** plus a **clean restore path** — not a repo to maintain.

---

## 5. Decided direction

Settled in brainstorm — formalized in Declaration/Design, recorded here so Findings is self-contained.

- **Portable artifact = three layers by durability + sensitivity**: declarative config (KB, portable, account-storable) / secrets (local-only, never hosted) / durable bulk data (GB, on the user's sync-target, never bootible-hosted).
- **"Carry, don't snapshot"**: persist durable + version-independent data (saves, BIOS, declarative config); regenerate tool-owned config (EmuDeck, CFW) fresh each wipe.
- **Bulk data = orchestrate, never host** ("B with a hard wall").
- **One restore primitive — "point at your target"**: USB/local folder is the zero-infra floor; NAS / S3-compatible / RomM / Syncthing are richer targets; bootible.dev is just a *managed config-only* target. One credential unlocks the restore.
- **Capability-aware selection**: reuse the per-device capability matrices so a device pulls only what it can run.
- **RomM = link, don't provision**: a first-class backend we link & recommend, never one we provision.
- **Build order**: Config Foundation → Retro targets (3DS first) → Sync backends → bootible.dev. **Scope all, then slice.**

> Gavin, brainstorm 2026-06-15/16 — on RomM: *"not every one wants romm but we should totally link to them and suggest people check out and and use it"*

---

## 6. Open questions for the design layer

What's not yet decided — these need to be settled in Design, not here.

1. **Syncthing as a backend** — evaluate head-to-head with S3/RomM; it needs no account and no fumble-able credentials (install + pair), which is compelling for the non-technical persona.
2. **RomM API** — verify it supports *selective* pull (by platform/collection) for capability-aware sync.
3. **PSP TA-088v3 + ARK-5 + Infinity 2.0** — unverified that ARK-5 payloads work as the Infinity-loaded CFW on that board.
4. **Secrets storage mechanism per OS** — Windows Credential Manager / libsecret / etc., and how secrets are (re)entered on a fresh device.
5. **Where the declarative artifact physically lives** and its schema (one file vs a `.bootible/` bundle; per-instance vs per-user).
6. **Module injection refactor** — how far to take the `Get-ConfigValue`/schema/dot-sourced-globals cleanup needed to share logic between on-device and host-side runners.
7. **Native cross-platform desktop app (Windows/Linux/macOS) as a host-side surface** — explore building one. A native app can do what a browser *cannot*: write removable media directly (the `host-media-prep` block-device writes), hold secrets in the OS keystore, and reach SMB/NFS/S3 shares natively. It is therefore a strong candidate to be **the** non-technical surface *and* the host-media-prep vehicle at once — potentially subsuming the earlier web-wizard concept (limited to in-browser, no direct USB/share access). Design must weigh native-app vs web-wizard vs `curl|bash` as the delivery surface per persona and per `provisioning_model`, including build/distribution cost (Tauri/Electron/other) and code-signing for three OSes.
8. **LLM-assisted layer in the app** — the app could SSO into an LLM account *or* take a bring-your-own API key. **Purpose to pin with Gavin** (guided setup for the non-technical persona? troubleshooting? natural-language → config generation?). Defaults to the latest Claude models per house style. Config sync from the app is **opt-in** and points at a target: **bootible.dev** (the managed config-only target) *or* the user's own **S3 / NFS / Samba** share — same sync-target abstraction as everything else.

---

## Sources

- Repo survey (RepoQL/dora explorer, 2026-06-16) — all `path:line` citations in §1.
- PSP-2002 CFW research brief (2026-06-16) — §2.2; memory `bootible-retro-cfw-findings`.
- New 3DS XL CFW research brief (2026-06-16) — §2.3; same memory.
- Handover doc `bootible-handover-retro-devices.md` (15 June 2026) — §2.1 and the `provisioning_model` taxonomy.
- Recorded brainstorm with Gavin (2026-06-15/16) — §4, §5, and the verbatim quotes throughout; session journal entry 2026-06-16.
