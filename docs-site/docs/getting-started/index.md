---
title: Getting Started
description: Your journey from a fresh handheld to a fully configured one, in four steps
---

# Getting Started

Welcome to Bootible! Setting up a gaming handheld follows the same four steps every time — and the docs are organized in that order.

## Your journey

<div class="grid cards" markdown>

-   :material-numeric-1-circle:{ .lg .middle } **Get started**

    ---

    Preview Bootible with zero setup, then put your own settings in a config repo you can edit from any browser.

    [:octicons-arrow-right-24: Try It in 5 Minutes](quick-try.md)

-   :material-numeric-2-circle:{ .lg .middle } **Configure your device**

    ---

    Pick what your device should have — apps, streaming, emulation, power fixes — using your platform's options.

    [:octicons-arrow-right-24: Configure Your Device](../configure/index.md)

-   :material-numeric-3-circle:{ .lg .middle } **Install & run**

    ---

    Run the one-liner, review the preview, type `bootible` to apply.

    [:octicons-arrow-right-24: Install & Run](../install/index.md)

-   :material-numeric-4-circle:{ .lg .middle } **Post install**

    ---

    Read your receipt, know what stays manual, and re-run after Windows updates to repair drift.

    [:octicons-arrow-right-24: Post Install](../post-install/index.md)

</div>

In this section: [Try It in 5 Minutes](quick-try.md) (the zero-config preview), [Your Config Repo](config-repo.md) (make it yours), [Config Basics](config-basics.md) (how config works), and [Multi-Device](multi-device.md) (one repo, many handhelds).

---

## Frequently Asked Questions

??? question "Is it safe to run?"
    Yes! Bootible runs in **dry-run mode** by default. The first run shows you exactly what would happen without making any changes. Only when you run `bootible` afterward are changes applied.

    Additionally:

    - **Windows**: Creates a System Restore Point before making changes
    - **Steam Deck**: Creates a btrfs snapshot before making changes

??? question "Do I need a GitHub account?"
    No, GitHub is optional. Without it:

    - You can still run Bootible with default settings
    - Logs are saved locally instead of pushed to a repo
    - You miss out on syncing configs across devices

    With a GitHub account:

    - Store your personal configuration in a private repo
    - Sync settings across multiple devices
    - Run logs are automatically pushed for debugging

??? question "Can I undo changes?"
    Yes!

    - **Windows**: Use System Restore to revert to the pre-Bootible state
    - **Steam Deck**: Restore from the btrfs snapshot created before running

??? question "What if I run it multiple times?"
    Bootible is **idempotent** — running it multiple times is safe. It will:

    - Skip packages already installed
    - Update configurations if they've changed
    - Not duplicate any settings
