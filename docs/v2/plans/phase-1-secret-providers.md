---
description: Phase-1 plan — secret references (secret://) and pluggable resolution via the 1Password and Bitwarden CLIs, with the command runner injected for testability
tags: [bootible, v2, plan, phase-1, secrets, providers, ears]
audience: { human: 40, agent: 60 }
purpose: { plan: 100 }
---

# Plan: Phase 1 — Secret Providers

**Implements:** `design.md` §3 (Layer 2 — secrets) · `plan.md` Phase 1 task 1.4

## Scope

**Covers:**
- The secret-reference convention (`secret://<key>`).
- The `SecretProvider` interface and a recursive resolver (`resolveSecrets`).
- Two CLI-backed providers — **1Password (`op`)** and **Bitwarden (`bw`)** — with the command runner **injected** so resolution is testable without the tools installed.

**Does not cover:**
- The OS-keystore providers (Windows Credential Manager / libsecret / macOS Keychain) — these are platform-native and land with the on-device executors.
- Secret writing/storage UX (later).

## Enables

Config can reference secrets (`secret://…`) without ever storing values; the orchestrator resolves them at apply time. Keeps Layer 2 local-only.

## Prerequisites

- **Plan 1** (core) and **Plan 3** (config artifact — config values may be secret references).

## North Star

A config value `secret://home-wifi` is replaced **at apply time** by the real secret, resolved via the user's chosen provider, and the secret never lands in the artifact.

## Done Criteria

### Secret references
- `isSecretRef(value)` **shall** be true iff `value` is a string beginning `secret://`.
- `parseSecretRef` **shall** return the key portion after `secret://`.

### Providers
- `onePasswordProvider` **shall** resolve a key by running `op read <key>` and returning the trimmed output.
- `bitwardenProvider` **shall** resolve a key by running `bw get password <key>` and returning the trimmed output.
- A provider's command runner **shall** be injectable, so resolution is testable without the CLI installed.

### Resolver
- `resolveSecrets(value, provider)` **shall** recursively replace every `secret://` string with the provider's resolved value, leaving non-secret values unchanged.
- `resolveSecrets` **shall not** mutate its input.

## Constraints

- **Apply-time only** — secrets are never written to the artifact or synced (`design.md` §3, Layer 2).
- **OS-keystore deferred** — platform-native keystore providers land with the executor plans.

## References

- `design.md` §3 — the three layers; secrets are local-only.
- `plan.md` Phase 1 — task 1.4.
- 1Password CLI (`op read`), Bitwarden CLI (`bw get password`).

## Error Policy

A failed resolution (provider error or missing key) propagates with the key name — never a silent empty secret.
