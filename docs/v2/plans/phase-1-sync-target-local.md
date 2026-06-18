---
description: Phase-1 plan — the SyncTarget interface (connect/list/pull/push/capabilities) and the local/USB file-copy backend, the seam every richer backend implements
tags: [bootible, v2, plan, phase-1, sync-target, local, ears]
audience: { human: 40, agent: 60 }
purpose: { plan: 100 }
---

# Plan: Phase 1 — SyncTarget + Local Backend

**Implements:** `design.md` §4 (The Sync-Target interface) · `plan.md` Phase 1 task 1.5

## Scope

**Covers:**
- The `SyncTarget` interface — `connect` / `list` / `pull` / `push` / `capabilities`.
- `TargetCapabilities` and `TargetRole` types.
- The **local/USB backend** (`localTarget`) — the zero-infra floor, file-copy based.

**Does not cover:**
- Remote backends — S3 / NAS / RomM / Syncthing (Phase 3).
- Capability-aware selection (Phase 3).
- Role wiring (config/saves/content) into the orchestrator (later plan).

## Enables

The single port every richer backend implements, and the floor the restore lifecycle uses when no cloud is configured. "Point at your target" starts here.

## Prerequisites

- **Plan 1** (core).

## North Star

A `SyncTarget` is a uniform `connect/list/pull/push` port; the local backend copies files to and from a folder, so a USB stick or any directory is a valid target with no infrastructure.

## Done Criteria

### Interface
- The `SyncTarget` interface **shall** expose `connect`, `list`, `pull`, `push`, and `capabilities`.

### Local backend
- `localTarget(root).connect()` **shall** ensure the root directory exists.
- When `push` then `pull` are run for a scope, the pulled files **shall** match the pushed files.
- If `pull` names a scope the target lacks, then it **shall** throw naming the scope.
- `localTarget(root).capabilities()` **shall** report `{ selectiveList: true, continuous: false, contentAware: false }`.

## Constraints

- **No infrastructure** — the local backend is plain file copy; it must work for a USB stick or any path (traces to `design.md` §4, "USB/local — the zero-infra floor").
- **Uniform port** — richer backends (Phase 3) implement the same interface; do not special-case the local one elsewhere.

## References

- `design.md` §4 — the interface and backend table.
- `plan.md` Phase 1 — task 1.5.

## Error Policy

Missing source or scope throws with the offending path/scope; no silent no-op copies.
