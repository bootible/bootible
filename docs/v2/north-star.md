---
description: bootible v2's north star — what the tool must let a player and a tinkerer do, expressed as testable outcomes
tags: [bootible, v2, north-star, declaration, provisioning, emulation, sync]
audience: { human: 60, agent: 40 }
purpose: { north-star: 100 }
---

# bootible v2 — North Star

A friend who has never opened a terminal wants to play SNES and GBA games on the TrimUI she just unboxed. She slots its microSD into her laptop, opens bootible, and answers a few plain questions — which device, what she wants to play, where her games already live. bootible writes the card; within the hour she is playing. Six months later she reflashes for a firmware update, points bootible at the same place her stuff lives, and her saves, her settings, and *exactly the games that device can run* are simply there. She never learned what "CFW" means, and never had to.

Across town a tinkerer wipes his ROG Ally every few months to keep it clean. His entire setup is one small file he keeps in his own git. He runs one command, points it at his NAS, and the device rebuilds itself — emulators, tweaks, saves — in the time it takes to make coffee. He swaps one emulator by editing one line. Neither of them maintained a private repo. Neither of them was sold storage they didn't already own.

This is what bootible v2 must let them do. The declarations below are the testable form of that experience. A design that serves a declaration is justified; one that does not needs a recorded reason.

---

## Declarations

### Provisioning every device

- A non-technical person takes a supported handheld from **blank to playing without opening a terminal or creating a GitHub account**.
- A user provisions a device that **cannot run bootible itself** (a TrimUI, a PSP, a 3DS) from their own computer, guided to the right firmware/CFW for that device.
- A user provisions a Windows or SteamOS handheld **either on the device or by building a setup USB from a host** — the same device supports more than one provisioning model and the user picks.
- A user (or a contributor) adds a device bootible has never supported by **dropping in a registry entry — data, not code**.
- A device only ever receives content **it can actually run**: point a TrimUI at a 2 TB library and it pulls GBA/SNES/PS1, never PS2.

### Choose your experience

- A user **chooses the experience their handheld boots into** — bare Windows, Steam Big Picture, the Xbox console shell, or the full ASUS experience — as a single up-front choice, then customises on top.
- A "clean Xbox" experience yields a device that is **fully hardware-functional (OS + drivers) with no ASUS software** installed.
- Every base is **debloated and tuned by default**; the experience a user restores is *better than factory*, never a stock re-image.
- A user **layers tuning, extra software, and access (an SSH key) on top of any base** — the base sets the floor, the modifiers raise it.

### Never touch the handheld

- A user provisions and verifies a handheld **without ever attaching a keyboard or mouse, or reading its screen** — every interaction happens from their desktop.
- A freshly-built device **announces itself on the network**; the desktop **discovers it, shows live status, and verifies it over SSH** — no IP hunting.
- A user authorises SSH access by **picking from the keys already on their machine** (multi-select), not by pasting key text.
- After provisioning, the user reaches the device with **`ssh <name>` — no username, password, IP, or key path** (bootible writes the SSH alias for them).
- None of this **requires an account, a cloud service, or Tailscale** — the default path is pure LAN; those are opt-in upgrades for cross-network reach.

### Your stuff follows you

- A user restores a freshly-wiped device to **~90% of its prior state by pointing bootible at one place and entering one credential**.
- A user keeps their entire setup as **one small, human-readable file they own** — diffable, version-controllable, theirs.
- A user changes their setup by **editing one or two lines** (swap an emulator, flip a tweak) and re-applying; the other ~90% is untouched.
- A user's **saves and BIOS survive every wipe**; a tool's own config (EmuDeck, a CFW) is **regenerated fresh, never restored stale**.

### Your storage, your content

- bootible **never hosts** a user's saves, ROMs, or BIOS; bulk data always lives on storage the user owns (USB, NAS, S3, RomM) — only the kilobyte config can live in a bootible.dev account.
- A user **connects a target once** (NAS / S3 / RomM / Syncthing / USB) and bootible syncs to it thereafter; they can split roles (config in git, saves on S3).
- bootible **never sources, indexes, or links copyrighted game content** — it lays down the empty structure and syncs the user's own files from the user's own storage.
- **Secrets never leave the device**: Wi-Fi passwords, storage credentials, and LLM keys live in the OS keystore (or the user's 1Password/Bitwarden), never in the artifact and never hosted.

### Guidance, not a manual

- A non-technical user is **walked through setup, troubleshooting, and "describe what you want → get a config"** by an in-app assistant, in plain language.
- A power user reaches the assistant **on demand** but never depends on it — the same outcomes are one CLI command away.
- For the exploit steps bootible deliberately won't automate (`guided` devices), the user is **handed to a maintained external guide**, not walked through hard-coded steps that rot.

### Two surfaces, one tool

- A power user **never needs the app or bootible.dev to exist**; the file + `curl | bash` path works on its own.
- A player and a tinkerer reach the **same outcome through different doors** (app vs CLI) — never two different journeys.
- A user **moves a setup between CLI and app** without re-creating anything; both read and write the same artifact.

---

## What We Won't Accept

- Hosting a user's saves, ROMs, or BIOS on bootible infrastructure.
- Provisioning a RomM — or any — server on the user's behalf. We link and recommend; we don't run it for them.
- Automating the on-device exploit chain for `guided` devices instead of handing off to the maintained guide.
- Sourcing, indexing, or linking copyrighted game content, anywhere, ever.
- A power-user path that depends on the desktop app or the website existing.
- Snapshotting a tool's volatile config and restoring it stale on the next wipe.
- Auto-picking a block device for a destructive write — the target is always explicit and confirmed (size + label shown).
- A "great experience" that only one persona gets — both the player and the tinkerer are first-class, or it doesn't ship.

---

## How to Use This Document

This north star is the evaluation target for every v2 design and plan. Each design decision should trace to one or more declarations above; a decision that serves a declaration is justified, and one that doesn't needs a reason recorded.

Read the chain in order: **findings** (`findings.md`) records what is true today; this **north star** records what should be true; **flows** (`flows/`) are the journeys that realise it; **design** (`design.md`) translates declarations into architecture; **plan** (`plan.md`) slices the architecture into shippable phases.

When a declaration here conflicts with a proposal, the declaration wins or is amended explicitly — never silently superseded.
