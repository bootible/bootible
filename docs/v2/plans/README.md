---
description: Convention for ODAD plans in the bootible v2 chain — EARS truth statements, one coherent slice per file, written per-phase and deleted when realized
tags: [bootible, v2, plans, ears, convention, truth-statements]
audience: { human: 40, agent: 60 }
purpose: { reference: 60, plan: 40 }
---

# bootible v2 — Plans (EARS truth statements)

ODAD **plans** are not roadmaps. The program roadmap (phases + sequencing) is `../plan.md`. A *plan* here is a set of **EARS truth statements** — what must be *true* in the running system, each verifiable yes/no — scoped to one coherent slice of the design, and **deleted when realized** (git keeps the history).

## Convention

- **One file per coherent slice** (e.g. `phase-1-config-artifact.md`, `phase-1-ally-port.md`), not per phase wholesale — split when truth statements span unrelated concerns.
- Each plan **links back** to the north-star declarations, flow stages, and design sections it satisfies.
- Written **per-phase, when that phase starts** — not up front. Per "scope all, then slice," only the roadmap is written ahead; EARS plans are the just-in-time shaping layer whose shape depends on the agreed design.
- **Deleted** once their truth statements hold in the running system.

## EARS patterns

| Pattern | Template | bootible example |
|---|---|---|
| Ubiquitous | The [system] shall [response] | The registry loader **shall** reject an entry whose tool `pin` is missing. |
| Event-driven | When [trigger], the [system] shall [response] | **When** the user points at a target, bootible **shall** pull Layer-1 config before applying. |
| State-driven | While [state], the [system] shall [response] | **While** dry-run is active, no executor **shall** perform a destructive write. |
| Optional | Where [feature], the [system] shall [response] | **Where** a secret provider is `op`, bootible **shall** resolve it via the 1Password CLI at apply time. |
| Unwanted | If [condition], then the [system] shall [response] | **If** a block device is not explicitly named, **then** host-media-prep **shall** refuse to write. |

## Status

**No EARS plans yet** — they are authored when their phase starts. **Phase 1 (Config Foundation)** is the next plan to write. See `../plan.md` for phase scope and `../design.md` for the architecture each plan implements.
