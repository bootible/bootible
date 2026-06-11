---
title: Reference
description: Contracts, internals, and lookup material — the CLI, FAQ, drift detection, release integrity, and per-platform internals
---

# Reference

Lookup material and contract pages — what Bootible guarantees and how the machinery works underneath.

---

<div class="grid cards" markdown>

-   :material-code-tags:{ .lg .middle } **CLI Reference**

    ---

    Command-line options, flags, and what the bootstrap does step by step.

    [:octicons-arrow-right-24: CLI Reference](cli.md)

-   :material-help-circle:{ .lg .middle } **FAQ**

    ---

    Answers to frequently asked questions.

    [:octicons-arrow-right-24: FAQ](faq.md)

-   :material-radar:{ .lg .middle } **How Drift Detection Works**

    ---

    The contract: exactly what is probed, where the baseline lives, and how repairs are verified.

    [:octicons-arrow-right-24: Drift Detection](drift.md)

-   :material-shield-check:{ .lg .middle } **Release Channels & Integrity**

    ---

    How the worker pins releases and verifies checksums — and where the trust boundaries honestly are.

    [:octicons-arrow-right-24: Channels & Integrity](integrity.md)

</div>

---

## Platform Internals

How each platform's engine is put together — for reading before you fork, or when the higher-level docs aren't deep enough.

- [Architecture](architecture.md) — how the engine, targets, and private overlay fit together
- [ROG Ally Modules](rog-ally-modules.md) — the PowerShell modules, their order, and re-run behavior
- [Steam Deck Roles](steam-deck-roles.md) — the Ansible roles, their order, and config keys
- [ROG Ally Platform Notes](rog-ally-platform.md)
- [Steam Deck Platform Notes](steam-deck-platform.md)
- [Android Platform Notes](android-platform.md)

---

## Looking for troubleshooting?

Troubleshooting moved to the Post Install section: [Troubleshooting](../post-install/troubleshooting.md).
