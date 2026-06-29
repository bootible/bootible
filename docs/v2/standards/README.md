---
description: Index for bootible's engineering standards — what to read, in what order, and how they were produced.
tags: [standards, index]
audience: { human: 70, agent: 30 }
purpose: { reference: 100 }
---

# bootible standards

Written after a multi-model cohesion review (Opus + Gemini + Codex) found the app had grown two parallel device paths. These are the rules that keep ROG, Deck, and future devices converging instead of diverging.

| Doc | Read it to… |
|---|---|
| [cohesion-findings.md](cohesion-findings.md) | understand **what diverged and why** — the evidence, the bugs, and the prioritized remediation backlog |
| [coding-standards.md](coding-standards.md) | know **how to write code** here — layering, shared types, single-source-of-truth, the Definition of Done |
| [ui-ux-standards.md](ui-ux-standards.md) | know **how the UI must behave** — the "same task = same experience" contract, the shared component set, the cross-device UX check |

**The one rule under all of them:** a new device or feature is added by *composing existing seams*, never by forking a parallel path. Before you write code, find where the concept already lives.

**Provenance:** synthesized from independent reviews by Opus (in-repo), Gemini (`--approval-mode plan`), and Codex (`exec -s read-only`). Grok was requested but its headless CLI couldn't produce a multi-step report (a gap to revisit). Raw outputs are in `.review/` (gitignored).
