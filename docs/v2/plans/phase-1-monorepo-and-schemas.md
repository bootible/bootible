---
description: Phase-1 plan — stand up the TypeScript monorepo, CI, schema tooling, and the single-file CLI build that every other v2 plan compiles into
tags: [bootible, v2, plan, phase-1, monorepo, schemas, ears]
audience: { human: 40, agent: 60 }
purpose: { plan: 100 }
---

# Plan: Phase 1 — Monorepo & Schemas

**Implements:** `design.md` §1 (architecture), §2 ("schemas are first-class"), §5 (core + executors), §6.2 (Stack A) · `plan.md` Phase 1 task 1.1

## Scope

**Covers:**
- A single TypeScript monorepo with four packages: `core`, `cli`, `app`, `site` (stubs for `app`/`site`).
- CI pipeline (build + `vitest`).
- JSON-Schema tooling: published schemas + the `# yaml-language-server: $schema=…` header convention + a CI validation job.
- The `cli` single-file binary build target.

**Does not cover:**
- The registry/artifact *field* schemas and loaders (Plan: Config Artifact & Registry).
- Any executor, sync backend, secret provider, or LLM/app internals (later plans / Phase 4).

## Enables

The shared `core` package every other Phase-1 plan builds in; the on-device `cli` binary; and the schema-validation rails (IDE + CI) the registry and artifact plans depend on. Nothing else in Phase 1 can start until this exists.

## Prerequisites

- **Decision D1b = Stack A** (TS/Node core + Electron) — `design.md` §6.2.
- A Node toolchain and a chosen single-binary compiler (Bun `--compile` / Deno `compile` / Node SEA) — selection left to implementation per `design.md` §6.2.

## North Star

A fresh checkout installs, builds every package, runs `vitest` green in CI, and produces a runnable `bootible` single-file binary on Linux, macOS, and Windows. Any YAML carrying a `$schema` header validates live in-editor **and** in CI.

## Done Criteria

### Monorepo
- The repo **shall** contain four packages — `core`, `cli`, `app`, `site` — under one TS monorepo with shared tsconfig and lint config.
- When CI runs on a clean checkout, the pipeline **shall** build all packages and `vitest` **shall** pass.
- If any package fails to build or any test fails, then CI **shall** fail the run (no partial green).

### CLI single binary
- The `cli` package **shall** compile to a single-file executable for Linux, macOS, and Windows.
- Where the target is a Steam Deck or ROG Ally, the produced binary **shall** run with no Node runtime installed.

### Schemas
- The repo **shall** publish a JSON Schema for each YAML shape it defines.
- When a tracked YAML file carries a `# yaml-language-server: $schema=…` header, an editor **shall** validate it against the published schema.
- If a tracked YAML with a `$schema` header fails validation, then the schema CI job **shall** fail.

## Constraints

- **Technical** — TypeScript only; no second core language (traces to `design.md` D1b / §6.2).
- **Design alignment** — the `cli` stays a clean single binary; no Chromium/Electron on a handheld (traces to `design.md` §6.2 "CLI-on-device concern, resolved").
- **Ownership** — this plan defines the schema *tooling*, not the registry/artifact *field* schemas (those are Plan: Config Artifact & Registry).

## References

- `design.md` §1, §2, §5, §6.2 — the contracts and stack this scaffolds.
- `plan.md` Phase 1 — task 1.1 and the strangler-fig sequencing.
- Single-file binary options — Bun `bun build --compile`, Deno `deno compile`, or Node SEA (Single Executable Applications). Pick at implementation.
- `vitest` — the TS test runner named in `design.md` §5.

## Error Policy

CI is all-or-nothing green; no partial success. Build/test failures surface locally and fail CI. No suppression comments or skipped tests to force green (repo rule).
