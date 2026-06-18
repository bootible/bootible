---
description: Phase-1 plan — the device registry (a device is validated YAML, not code), its JSON Schema, the typed loader, and the two existing on-device entries
tags: [bootible, v2, plan, phase-1, registry, schema, ears]
audience: { human: 40, agent: 60 }
purpose: { plan: 100 }
---

# Plan: Phase 1 — Device Registry

**Implements:** `design.md` §2 (The Device Registry) · `plan.md` Phase 1 task 1.2

## Scope

**Covers:**
- A published JSON Schema for a registry entry (`schemas/device.schema.json`).
- A typed registry loader/parser in `@bootible/core`.
- The two existing **on-device** entries as data: `registry/devices/rog-ally.yml`, `registry/devices/steamdeck.yml`.

**Does not cover:**
- The `.bootible/` config artifact (Plan: Config Artifact).
- Retro device entries — TrimUI / PSP / 3DS (Phase 2).
- The executors that consume the registry (later plans).

## Enables

Capability-aware selection, provisioning-model routing, and "**add a device = add data**." The config artifact and the orchestrator both read the registry.

## Prerequisites

- **Plan 1 (Monorepo & schemas)** — `findSchemaUrl` + `validateYamlAgainstSchema`, the `validate:schemas` script, and the published-schema convention.

## North Star

A device is a YAML file validated by a published JSON Schema; the loader returns typed entries; adding a device needs no TypeScript. The two existing on-device devices load and validate, and `validate:schemas` now checks real files.

## Done Criteria

### Registry schema
- The repo **shall** publish `schemas/device.schema.json` describing a registry entry.
- A registry entry **shall** require `id`, `name`, and a non-empty `provisioning_models` array drawn from `on-device | host-media-prep | guided | android-host`.
- If a registry entry contains an unknown top-level field, then schema validation **shall** fail.

### Loader
- Given a registry directory, the loader **shall** return one typed `DeviceEntry` per `*.yml` file.
- The loader **shall** expose each device's `capabilities` matrix (`great` / `varies` / `none`) when present.
- If an entry fails schema validation, then the loader **shall** fail with the file path and the validation errors.

### Device entries
- The repo **shall** contain `registry/devices/rog-ally.yml` and `registry/devices/steamdeck.yml`, each carrying a `# yaml-language-server: $schema=…` header.
- When `validate:schemas` runs, both entries **shall** validate against `device.schema.json`.

## Constraints

- **Data-not-code** — adding a device is a registry YAML, never TypeScript (traces to `design.md` §2).
- **Single validator** — reuse Plan-1 `validateYamlAgainstSchema`; do not introduce a second validation path.

## References

- `design.md` §2 — the registry entry shape (firmware/guide/questions/connection per model).
- `plan.md` Phase 1 — task 1.2.
- Plan 1 — `@bootible/core` schema tooling.

## Error Policy

An invalid registry entry fails loudly with the file path and the validation errors; `validate:schemas` fails CI. No silent skips.
