---
description: bootible v2's program plan — the phases, sequencing, and done-criteria that slice the v2 architecture into shippable work
tags: [bootible, v2, plan, roadmap, phases, strangler-fig, provisioning, sync]
audience: { human: 40, agent: 60 }
purpose: { plan: 100 }
---

# bootible v2 — Plan

**Status**: Plan (ODAD step 5 — the program-level breakdown). **DRAFT for review.**
**Builds on**: `findings.md`, `north-star.md`, `flows/`, `design.md`

> **What this is:** the program **roadmap** — phases, sequencing, and done-criteria. In ODAD terms this is *sequencing*, **not** the Plans layer: the canonical ODAD **plans** are EARS truth statements, scoped one-per-coherent-slice and **deleted when realized**. Those live in `plans/` and are written **per-phase, when that phase starts** (see `plans/README.md`). Per **"scope all, then slice,"** nothing here is built until its phase's EARS plan is written and approved.

---

## Phase summary

| Phase | Title | Thrust | Done when |
|---|---|---|---|
| **1** | Config Foundation | Kills the private repo; stands up the TS core | Ally goes blank → configured → wipe → restore on the new artifact + local target, **no private repo** |
| **1b** | Deck executor port | Fast-follow | Deck on the new core; v1 on-device paths retired |
| **2** | Retro targets | Prove `provisioning_model` on hardware (3DS first) | 3DS / PSP / TrimUI provisionable from a host CLI; every `provisioning_model` proven |
| **3** | Sync backends | Your stuff follows you, at scale | Saves round-trip + capability-aware content pull from NAS/S3/RomM; restore (L1) brings everything back |
| **4** | bootible.dev + Desktop App | The player surface | A non-technical **player** goes blank → playing via the app, config saved to their bootible.dev account |

---

## Stack baseline

*(from Design §5–6, decided)*

- **Monorepo, TypeScript.** Packages:
  - `core` — orchestrator · registry · artifact · sync · executor interfaces
  - `cli` — the `bootible` command, compiled to a single-file binary via Bun/Deno/Node-SEA
  - `app` — Electron + LLM
  - `site` — bootible.dev (Better Auth + Cloudflare)
- **Schemas** — published JSON Schema + `# yaml-language-server: $schema=…` headers (registry + artifact).
- **R2 strangler-fig** — stand up the core, **port device-by-device**, keep v1 runnable until each ported path is parity-proven.
- **Reuse from v1** — `cloudflare/_worker.js` (routing/integrity, unchanged), the CFW/firmware research as registry data, the **v1 Pester tests as the parity oracle** during the port.
- **Testing** — TDD: `vitest` on the TS core; parity-checked against v1 behaviour.

---

## Phase 1 — Config Foundation

*Kills the private repo; stands up the core.*

**Goal**: the portable 3-layer artifact + the wipe/restore lifecycle, on the TS core, with **ROG Ally ported first**. Private repo gone.

- **1.1 Monorepo scaffold** — TS, the four packages, CI, schema tooling, CLI single-binary build target.
- **1.2 Device Registry** — JSON Schema + loader; encode `rog-ally` + `steamdeck` as registry entries from v1 config.
- **1.3 Config Artifact `.bootible/`** — `config.yml` (schema:2) + `targets.yml`; loader/deep-merge (port `Merge-Configs`); **one unified validator** (collapse v1's two schemas — Findings §1.6).
- **1.4 Secret providers** — interface + OS keystore + **1Password CLI (`op`)** + **Bitwarden CLI (`bw`)**; `secret://` references.
- **1.5 SyncTarget interface + local/USB backend only** — the seam (richer backends are Phase 3).
- **1.6 Orchestrator** — plan / apply / receipt / drift skeleton; the **restore lifecycle (flow L1)** over the local target.
- **1.7 Strangler port — ROG Ally executor** — port the 14 PowerShell modules → core actions (shell out to winget/powercfg/registry); resolve the dual-`Get-ConfigValue` / dual-schema / dot-sourced-globals debt *by construction* (injected config); parity-checked against v1 Pester. **v1 `ally.ps1` stays runnable until parity is proven.**
- **1.8 Migration** — `bootible migrate`: v1 `private/device/<…>/config.yml` → `.bootible/` + keystore; then delete `init-private-repo.sh` / device-flow auth / `Select-Config` / log-push (Findings §1.3).
- **1.9 CLI verbs** — `provision · restore · tweak · connect · doctor`.

**Done**: an Ally goes blank → configured → wipe → restore via the new artifact + a local target, **no private repo.** Deck still on the v1 path until 1b.

---

## Phase 1b — Deck executor port

*(fast-follow)*

- Ansible roles → core actions (flatpak/file ops).

**Done**: Deck on the new core; v1 on-device paths retired.

---

## Phase 2 — Retro targets

*Prove `provisioning_model` on hardware; 3DS first.*

- **2.1 host-media-prep executor + media engine** — format+copy (the common path) + **`etcher-sdk`** for image-flash (Node — fits Stack A); safe drive enumeration/pick (size/label/confirm, **never auto-pick**).
- **2.2 guided executor** — media prep + maintained-guide hand-off framework (**no hard-coded exploit steps**); device questions (e.g. PSP board-rev) sourced from the registry.
- **2.3 New 3DS XL (first)** — registry entry (MSET9 core staging, Luma3DS/GodMode9/finalize payloads, capability matrix **without N64**), the host-side `mset9.py` wrapper, hand-off to `3ds.hacks.guide`, verify on hardware. *(Build-time version re-verify.)*
- **2.4 PSP-2002** — registry entry (**ARK-4-final frozen baseline + ARK-5 link**, FasterARK), the **board-revision question** (cIPL/CustomIPL vs Infinity 2.0), Memory Stick prep, hand-off to `pspunk.com`. *(Re-verify ARK-5 status at build.)*
- **2.5 TrimUI** — registry entry (NextUI default + CrossMix/StockMix extract-to-card; **Knulli image-flash** via 2.1), card prep.
- **2.6 android-host executor** — generalize the existing `config/android/` ADB stack into the core (Retroid / AYN Odin land later as registry data).

**Done**: 3DS / PSP / TrimUI provisionable from a host CLI; every `provisioning_model` proven.

---

## Phase 3 — Sync backends

*Your stuff follows you, at scale.*

- **3.1 Backends** — S3-compatible (one impl → R2/B2/Wasabi/MinIO) + SMB/NFS.
- **3.2 RomM backend + D6 spike** — verify RomM's API supports selective pull; content-aware `list`.
- **3.3 Capability-aware selection** — intersect target content × registry capability matrix (`[cap]`).
- **3.4 Roles in `targets.yml`** — config / saves / content split across targets.
- **3.5 Companion docs** — Syncthing (transport-under-local) + RomM recommended setups.
- **3.6 bootible.dev managed-target client stub** (config-only) — interface ready for Phase 4.

**Done**: saves round-trip + capability-aware content pull from NAS/S3/RomM; restore (L1) brings everything back.

---

## Phase 4 — bootible.dev + Desktop App

*The player surface.*

- **4.1 Electron app shell** embedding the core — the provision/restore/tweak/connect/troubleshoot flows with a GUI; the friendly face over the Phase-2 media engine.
- **4.2 LLM layer** — guided setup · troubleshooting (feed logs/drift/health) · NL→config (emit/patch Layer-1). Provider-pluggable, **default latest Claude**; SSO or BYO key (key in keystore).
- **4.3 bootible.dev site (TS)** — **Better Auth** (email/pw · magic-link · 2FA · passkey · GitHub); Cloudflare free-tier; managed **config-only** target store (KV/D1, KB configs); reuse `_worker.js` for entry-script routing/integrity.
- **4.4 Polish** — code-signing (Win Authenticode / macOS notarization / Linux packaging), auto-update, onboarding.

**Done**: a non-technical **player** goes blank → playing via the app, guided, with their config saved to their bootible.dev account.

---

## Cross-cutting & risks

- **R2 safety** — never break v1 on-device until the ported path is **parity-proven** (Pester as oracle).
- **Volatile versions** (PSP especially) — registry pins + a CI upstream-release check.
- **Legal wall** enforced in every content path; **secrets never hosted.**
- **Each phase gets its own detailed spec** before implementation.

---

## Sequencing

**P1** (core + artifact + Ally) → **P1b** (Deck) → **P2** (3DS → PSP → TrimUI) → **P3** (sync backends) → **P4** (app + site).

*P3 and the bootible.dev site can overlap once the **SyncTarget interface** + **managed-target stub (3.6)** exist.*
