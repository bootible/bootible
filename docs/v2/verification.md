---
description: Verification of the bootible v2 declaration chain — coverage matrices checking each layer against its predecessor per ODAD's verification protocol
tags: [bootible, v2, verification, coverage, declaration-chain]
audience: { human: 30, agent: 70 }
purpose: { reference: 70, findings: 30 }
---

# bootible v2 — Chain Verification

Mechanical coverage checks per ODAD `references/verification.md`. Each layer is verified against its predecessor: every declaration should trace to a finding, every declaration should have a flow, and every flow stage/failure should have a design response.

## Findings → North Star (is every declaration grounded?)

| North-star declaration group | Grounding findings |
|---|---|
| **Provisioning every device** | §1.1 target model · §1.5 on-device assumption + the android host-side exception (blueprint) · §2 the `provisioning_model` taxonomy + the three new targets |
| **Your stuff follows you** | §1.3 private-repo mechanism (the absence of a portable representation) · §1.4 EmuDeck staged-not-snapshotted · §4 the why (one problem, three hats) · §5 decided artifact + restore primitive |
| **Your storage, your content** | §3 constraints (legal, free-tier, client-side secrets) · §5 orchestrate-never-host · §2 RomM as the user's own library |
| **Guidance, not a manual** | §2.3 the 3DS maintained guide is alive · §3 the two-personas constraint · §5 decided LLM role (guided/troubleshoot/NL→config) |
| **Two surfaces, one tool** | §1.1 the `curl\|bash` bootstrap model · §3 two-personas constraint |

**Result:** no orphaned declarations; every group traces to findings.

## North Star → Flows (does every outcome have a process?)

| Declaration group | Flows that realise it |
|---|---|
| Provisioning every device | `router` · `provision-on-device` · `provision-host-media-prep` · `provision-guided` · `provision-android-host` |
| Your stuff follows you | `restore` · `tweak-update` · `connect-target` |
| Your storage, your content | `connect-target` + the `[legal]`/`[secret]`/`[point]` tags across all provisioning and `restore` flows |
| Guidance, not a manual | `troubleshoot` + the App/LLM fork in `router` and every provisioning flow |
| Two surfaces, one tool | every flow's **Fork** (App vs CLI) |

**Result:** no declaration without a flow; no flow without a declaration (no scope creep).

## Flows → Design (does the architecture handle every stage and failure?)

| Flow | Design sections answering it |
|---|---|
| `router` | §1 surfaces + orchestrator · §2 registry returns the model set |
| `provision-on-device` (A) | §5 executors (PowerShell/Ansible) · §5.2 the v1 refactor |
| `provision-on-device` (A2 setup-USB) | §6.2 media engine + `etcher-sdk` · §2 registry per-model |
| `provision-host-media-prep` | §5 media engine (format/copy + `etcher-sdk`) · §2 registry `firmware` |
| `provision-guided` | §5 guided executor · §2 registry `guide`/`questions` |
| `provision-android-host` | §5 android-host executor · §2 registry `connection` block |
| `restore` | §3 the 3-layer artifact + restore primitive · §4 sync-target interface |
| `tweak-update` | §3 declarative config · §5 idempotent apply + drift guard |
| `connect-target` | §4 sync-target interface + backends · §3 Layer-2 secrets |
| `troubleshoot` | §6.2 LLM layer · §5 receipt/drift/health state |

**Result:** every flow stage maps to a design response; failure modes (safe-write, unreachable target, dead guide, version drift) are answered by §2 pins/checksums, §4 connect/test, and the `[safe]` rules.

## Design → Plans

**Deferred by design.** Per ODAD, EARS plans are written per-phase when each phase starts (`plans/README.md`); the program roadmap (`plan.md`) maps design sections to phases. Coverage is checked when each phase's plan is authored.

## Open gaps (carried forward, not blocking)

- **D6 — RomM selective-pull API** unverified → Phase-3 spike (design §4, plan Phase 3).
- **Version volatility** (PSP ARK-5 pre-release especially) → registry pins + CI upstream-release check (design §2).
- **EARS plans** not yet written → authored per-phase; Phase 1 is next.
