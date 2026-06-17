---
description: The diagnosis lifecycle journey — when something breaks, bootible feeds logs and device/drift/health state to the LLM, which explains the problem in plain language and proposes a fix
tags: [bootible, v2, flow, lifecycle, troubleshoot, llm, diagnostics]
audience: { human: 50, agent: 50 }
purpose: { flow: 85, reference: 15 }
---

# Flow — Troubleshoot (LLM-assisted)

When something is wrong. The player gets a plain-language explanation and a proposed fix; the tinkerer gets the same diagnostics raw.

## Trigger

A user enters via the router with intent = **troubleshoot** (*"something's wrong"*), or a prior flow failed and offered to diagnose.

## Stages

### 1. Gather state
- **Actor:** App/CLI
- **Action:** Collect logs + device/drift/health state.
- **Output:** A diagnostic bundle.

### 2. Diagnose
- **Actor:** LLM (player) / user (tinkerer)
- **Action:** **Player:** the App feeds the bundle to the LLM, which explains the problem in plain language and proposes a fix. **Tinkerer:** the same diagnostics are surfaced raw via `bootible doctor` + logs.
- **Output:** A diagnosis and a candidate fix.

### 3. Act
- **Actor:** User + bootible
- **Action:** Apply the proposed fix (with confirm), or — for `guided` devices — open the maintained guide for the relevant step. `[legal]`
- **Output:** The issue resolved, or a clear next action.

## Termination

The user has either a resolved issue or an accurate explanation plus a concrete next step (a fix to confirm, or a guide to follow).

## Failure modes

- **No LLM available** (offline / no key) → fall back to the raw `bootible doctor` output and the relevant docs link.
- **Proposed fix is destructive** → gated behind explicit confirmation, with `[safe]` rules if it touches media.
- **Root cause is upstream** (a dead guide, a firmware change) → surfaced as such; bootible does not invent steps it cannot verify.
