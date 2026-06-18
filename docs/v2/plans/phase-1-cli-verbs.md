---
description: Phase-1 plan — the bootible CLI verbs (a testable run dispatcher wired to core.restore) and the real entry that makes the tool runnable end-to-end
tags: [bootible, v2, plan, phase-1, cli, verbs, ears]
audience: { human: 40, agent: 60 }
purpose: { plan: 100 }
---

# Plan: Phase 1 — CLI Verbs

**Implements:** `design.md` §6.1 (CLI surface) · `plan.md` Phase 1 task 1.9

> Composition plan — turns the built library into a runnable command by wiring `core.restore()` behind a dispatcher.

## Scope

**Covers:**
- `run(argv, env)` — a dispatcher (`version`, `restore <target>`, `help`/unknown) with an **injected `env`** so it is unit/integration-testable.
- The real `bootible` entry (`index.ts`) that builds `env` from the repo schemas/registry + `allyExecutor` + a real command runner.

**Does not cover:**
- The full verb set — `provision` / `tweak` / `connect` / `doctor` (follow-on slices).
- The `curl | bash` bootstrap (reuses the v1 Cloudflare worker — separate).
- Embedding schemas/registry into the standalone binary (follow-on; currently resolved relative to the repo, which works in dev).

## Enables

bootible is **runnable**: `bootible restore <target>` executes flow L1 end-to-end.

## Prerequisites

- **Plan 6** (`restore()`), **Plan 7** (`allyExecutor`), Plans 1–5 (core).

## North Star

A person runs `bootible restore <target>` and their config + saves come back, applied via the executor. The dispatcher is tested with injected deps; the entry is the thin real wiring.

## Done Criteria

- `run(["version"], env)` **shall** print a version and return 0.
- `run(["restore", target], env)` **shall** run `core.restore()` over a `localTarget(target)` and report the receipt; a missing target **shall** print usage and return nonzero.
- `run` **shall** return nonzero for an unknown command.

## Constraints

- **Dispatcher is pure of process/fs** — `env` is injected, so `run` is testable; `index.ts` owns the real wiring (`design.md` §6.1).
- **One command to run** — no extra flags/steps required for the common path (`CLAUDE.md` core principle).

## Verification

Proven runnable in dev: `bun packages/cli/src/index.ts version` and `… restore <dir>` both demoed (config + saves restored, save file landed). Embedding schemas/registry into the compiled binary is a follow-on.

## References

- `design.md` §6.1 — the CLI surface. · `CLAUDE.md` — the one-command principle.

## Error Policy

Unknown/invalid invocation prints usage and returns nonzero; a failed restore propagates its error.
