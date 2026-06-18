---
description: Phase-1 plan — the Executor seam and the restore() orchestrator that composes the built core (artifact, registry, secrets, sync-target) into flow L1
tags: [bootible, v2, plan, phase-1, orchestrator, restore, executor, ears]
audience: { human: 40, agent: 60 }
purpose: { plan: 100 }
---

# Plan: Phase 1 — Orchestrator + Restore Lifecycle

**Implements:** `design.md` §5 (Core + Executors) · `flows/restore.md` (lifecycle L1) · `plan.md` Phase 1 task 1.6

> This is the first **composition** plan — it wires together what Plans 1–5 built (`loadArtifact`, `loadRegistry`/`DeviceEntry`, `resolveSecrets`, `SyncTarget`/`localTarget`) rather than adding new leaf logic. Its shape is dictated by the existing `core` API.

## Scope

**Covers:**
- The **`Executor` seam** — the interface a platform applier (Ally, Deck, retro) implements.
- The **`restore()` orchestrator** — flow L1 ("point at your target") over a `SyncTarget`, composing the built data layer and producing a `Receipt`.

**Does not cover:**
- Real executors — the Ally/Deck appliers implement `Executor` in **Plan 7**.
- Capability-aware content sync (Phase 3); drift detection (later slice).
- First-time provision-from-scratch (vs restore) — this plan is the **restore** path only.

## Enables

The first end-to-end "bootible does a thing": point at a target → config + saves come back → applied via an executor. **Plan 7** plugs the Ally executor into the seam; **Plan 8** calls `restore()` from the CLI.

## Prerequisites

- **Plans 1–5** — the built `core`: `loadArtifact`, `loadRegistry`, `resolveSecrets`, `localTarget`/`SyncTarget`.

## North Star

`restore()` takes a `SyncTarget` and an `Executor` and reproduces a device's setup — pulls the config artifact, resolves secrets, applies via the executor, restores saves — returning a `Receipt`. Verified **end-to-end** against a temp local target seeded with a fixture `.bootible` bundle and a **fake executor**.

## Proposed shape (for review before coding)

```ts
interface ApplyContext { device: DeviceEntry; config: BootibleConfig; } // secrets resolved
interface ExecutorReceipt { actions: string[]; }
interface Executor { apply(ctx: ApplyContext): ExecutorReceipt; }

interface RestoreOptions {
  target: SyncTarget;          // e.g. localTarget(path)
  registry: DeviceEntry[];     // from loadRegistry(...)
  schemas: ArtifactSchemas;    // config + targets JSON Schemas
  secrets: SecretProvider;     // op / bw / keystore
  executor: Executor;          // Plan 7 implements this
  workdir: string;             // scratch dir to pull the artifact into
  savesDest: string;           // where restored saves land
}
interface Receipt { device: string; applied: string[]; savesRestored: boolean; }

function restore(opts: RestoreOptions): Receipt;
```

**restore() steps (flow L1):** `target.connect()` → `target.pull("config", workdir)` → `loadArtifact(workdir, schemas)` → `resolveSecrets(config, secrets)` → resolve `device` from `registry` → `executor.apply({device, config})` → `target.pull("saves", savesDest)` (if present) → return `Receipt`.

## Done Criteria

### Executor seam
- The `Executor` interface **shall** expose `apply(context)` returning a receipt of actions.

### Restore (flow L1)
- `restore()` **shall** connect the target, pull the **config** scope into the workdir, and load + validate it via `loadArtifact`.
- `restore()` **shall** resolve `secret://` references in the config via the provided `SecretProvider` **before** applying.
- `restore()` **shall** resolve the device entry from the registry by the config's `device` id; if absent, it **shall** throw naming the id.
- `restore()` **shall** call the executor's `apply` with the resolved config + device entry.
- When the target has a **saves** scope, `restore()` **shall** pull it to `savesDest` and report `savesRestored: true`; otherwise `false`.
- `restore()` **shall** return a `Receipt { device, applied, savesRestored }`.

## Constraints

- **Executors are injected** — the orchestrator is platform-agnostic (`design.md` §5: contracts language-agnostic, executors native).
- **Secrets resolved at apply time only**, never persisted (`design.md` §3).
- **Reuse the built core** — no reimplementation of artifact/registry/secrets/sync logic.

## References

- `design.md` §5 — the core + executor split. · `flows/restore.md` — the L1 stages.
- Plans 1–5 and the `@bootible/core` exports.

## Error Policy

A missing/invalid artifact, an unknown device id, or an executor failure aborts `restore()` with a clear error — never a partial, silent restore.
