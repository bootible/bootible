---
description: Phase-1 plan — the portable .bootible/ config artifact (config.yml + targets.yml), its schemas, the typed loader, and the deep-merge primitive
tags: [bootible, v2, plan, phase-1, config-artifact, deep-merge, ears]
audience: { human: 40, agent: 60 }
purpose: { plan: 100 }
---

# Plan: Phase 1 — Config Artifact

**Implements:** `design.md` §3 (The Config Artifact) · `plan.md` Phase 1 task 1.3

## Scope

**Covers:**
- The `.bootible/` artifact shape — `config.yml` (Layer 1, declarative, schema-versioned) and `targets.yml` (the sync-target manifest).
- Published JSON Schemas: `schemas/config.schema.json`, `schemas/targets.schema.json`.
- A typed loader (`loadArtifact`) and the deep-merge primitive (`deepMerge`, porting v1 `Merge-Configs`).

**Does not cover:**
- Secret resolution — Layer 2 (Plan: Secret Providers).
- Sync-target backends — Layer 3 lives on the target (Plan: SyncTarget + local backend).
- The orchestrator that applies config (later plan).

## Enables

A portable, schema-versioned representation of "your setup" — the thing that travels and that the restore lifecycle pulls. This is what makes the private repo unnecessary.

## Prerequisites

- **Plan 1** — schema tooling (`validateYamlAgainstSchema`, `validate:schemas`).
- **Plan 2** — the registry (a config names a device `id`).

## North Star

A setup is a small `.bootible/` bundle (`config.yml` + `targets.yml`) validated by published schemas; `config.yml` is schema-versioned so it can migrate; deep-merge composes defaults with overrides without losing nested keys.

## Done Criteria

### Schemas
- The repo **shall** publish `schemas/config.schema.json` and `schemas/targets.schema.json`.
- A `config.yml` **shall** require an integer `schema` version field.
- If a `config.yml` omits `schema`, then validation **shall** fail.

### Deep merge
- `deepMerge(base, override)` **shall** return a new object where nested objects merge recursively and override scalars win.
- `deepMerge` **shall not** mutate either input.

### Loader
- Given a `.bootible` directory, `loadArtifact` **shall** return the validated, typed `{ config, targets }`.
- If `config.yml` or `targets.yml` fails schema validation, then `loadArtifact` **shall** fail with the file name and the validation errors.

## Constraints

- **Secrets are references only** — `secret://name`, never values in the artifact (`design.md` §3, Layer 2).
- **Durable data is not in the artifact** — saves/BIOS live on the sync target, addressed via `targets.yml` (`design.md` §3, Layer 3).
- **Single validator** — reuse `validateYamlAgainstSchema`.

## References

- `design.md` §3 — the three-layer artifact and the restore primitive.
- `plan.md` Phase 1 — task 1.3.
- Plans 1 & 2 — schema tooling and registry.

## Error Policy

An invalid artifact fails loudly with the file name and validation errors. No partial loads.
