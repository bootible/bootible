---
description: Phase-1 plan — the first Executor implementation (ROG Ally / Windows), with the power/hibernate module ported clean from v1 as the representative slice
tags: [bootible, v2, plan, phase-1, executor, ally, power, ears]
audience: { human: 40, agent: 60 }
purpose: { plan: 100 }
---

# Plan: Phase 1 — ROG Ally Executor (power slice)

**Implements:** `design.md` §5 (Core + Executors) · `plan.md` Phase 1 task 1.7 · grounded in v1 `config/rog-ally/lib/power-helpers.ps1`

> The first **Executor** implementation, and the maximal "based on built things" plan — the v1 PowerShell *is* the behavioral spec. Scoped to a representative slice (the power module); the other 13 v1 modules port into the same executor as follow-on slices, not big-bang.

## Scope

**Covers:**
- `allyExecutor(exec)` — implements the `Executor` seam by running native commands through an **injected runner**.
- `getPowerConfigCommands` — the power/hibernate logic **ported clean** from v1 `power-helpers.ps1`.

**Does not cover:**
- The other v1 modules (apps, gaming, debloat, …) — follow-on slices into the same executor.
- The Steam Deck executor; first-time provision.

## Enables

`restore()` can actually apply config on an Ally; the remaining v1 modules land as further `allyExecutor` slices behind the same seam.

## Prerequisites

- **Plan 6** (the `Executor` seam + `restore()`), Plans 1–5 (core), **Plan 4** (`Exec` type).

## North Star

Given a config with power settings, `allyExecutor` runs the correct `powercfg` commands (matching v1 behaviour) and reports them. Command-building is verified here with a fake runner; the real `powercfg` execution is proven on the device.

## Done Criteria

### Power port (`getPowerConfigCommands`, faithful to v1)
- Hibernate mode **shall** emit `/hibernate on` + zeroed `standby-timeout-ac/dc` (+ `hibernate-timeout-ac/dc` when minutes given).
- A power-button action **shall** set `PBUTTONACTION` (ac **and** dc) and append `/setactive`.
- `disable_cpu_boost_on_battery` **shall** set `PERFBOOSTMODE 0` (dc only) and append `/setactive`.

### Executor
- `allyExecutor(exec).apply(ctx)` **shall** run each power command via `exec` as `powercfg <args>` and record it in the receipt.
- When the config has no power settings, `allyExecutor` **shall** run nothing.

## Constraints

- **Logic decides commands; the runner executes** — the executor is testable on Linux via a fake `Exec`; native execution is the runner's job (`design.md` §5: executors stay native).
- **Port faithfully** — v1 `power-helpers.ps1` is the behavioural spec; do not invent new powercfg behaviour.

## Verification gap (honest)

Green tests here prove **command-building**, not Windows execution. The real proof is a run on Vengeance (the ROG Ally X). This is the "executors are native" reality and applies to every Ally slice.

## References

- `design.md` §5 — the core + executor split.
- v1 `config/rog-ally/lib/power-helpers.ps1` (pure) and `modules/power.ps1` (the wrapper).

## Error Policy

A runner error propagates (the apply aborts) — never a silently skipped power command.
