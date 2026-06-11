---
title: Post Install
description: What to do after Bootible finishes — reading your receipt, health checks, restarts, and your first game
---

# It Finished — Now What

The run is done. This page walks you through what Bootible left behind, what to check, and the handful of sign-ins only you can do before your first game.

Coming back later because something broke or you changed your config? Go straight to [Re-running & Drift](re-running.md).

---

## Your receipt: `Bootible - Read Me.md`

On the ROG Ally (Windows), every **real** run writes a receipt to your Desktop named `Bootible - Read Me.md`. Dry runs do not write one — no receipt after a preview is expected, not a failure.

Open it with any text or Markdown viewer. Top to bottom, it contains:

**The header** — which configuration ran, which Bootible version, and when:

- **Configuration:** your device instance name (or `default` if you ran without a config repo)
- **bootible version:** a version number on the stable channel, or `main` on beta — see [Updates & Channels](channels.md)
- **Run completed:** date and time

Right under the header is the most important line in the file:

> Re-running is always safe: open PowerShell and type `bootible`. It re-applies your configuration and repairs anything Windows Update broke.

That is the whole maintenance model. Keep the receipt; it is your reminder of how to fix things later.

**Apps** — a one-line tally (`Attempted | Installed | Skipped (already present) | Failed`) followed by one line per package with its status:

- `succeeded` — freshly installed this run
- `skipped` — already on the device, left alone
- `failed` — did not install; a short message explains why when one is available

A few `skipped` entries are normal, especially on re-runs. A `failed` entry is worth a look — the receipt's built-in FAQ covers the most common cause (a flaky winget source) and the fix.

**Configuration changes** — what Bootible actually changed this run: power settings, registry tweaks, created directories, and on re-runs any `Repaired drift: ...` lines. This section only appears when something was changed.

**The FAQ** — the receipt ends with "If something looks broken": Armoury Crate vs Smart App Control, app install failures, battery draining in sleep, Windows Update breaking settings, and where the logs live, plus links to these docs, GitHub issues, and Discord.

---

## The health check summary

At the end of every real run on the ROG Ally, a health module re-checks key results (skipped during dry runs; turn it off with `post_install_health_checks: false`). What it checks depends on your config:

| Check | When it runs |
|-------|--------------|
| Steam launches | `install_steam` enabled |
| Git and PowerShell 7 respond on PATH | their installs enabled |
| Game Mode registry value | `enable_game_mode` (default on) |
| Hardware GPU scheduling registry value | `enable_hardware_gpu_scheduling` (default on) |
| Remote Desktop registry + firewall rules | `enable_rdp` enabled |
| OpenSSH default shell, `sshd` + `ssh-agent` services | `ssh_server_enable` enabled |
| Windows Time service + NTP registry | `force_time_sync` (default on) |
| Smart App Control state | always (advisory; counted as a failure when it is on, because it blocks Armoury Crate components) |

Each check prints `OK` or `FAILED`. A `FAILED` line is scoped to that one item — it does not undo or invalidate the rest of the run. Every failure comes with an **Action** hint telling you what to do, and the run ends with either `All health checks passed` or a list of what failed plus the suggestion to fix and re-run with `-Tags health` (or just run `bootible` again — a full re-run re-applies everything).

Warnings elsewhere in the run output (`[!]` lines) are informational — something to know about, not something that failed.

---

## Restart once before judging anything

The run's closing "Next steps" asks you to restart, and it means it. Changes that need a restart before they take effect include:

- **HidHide** (if enabled) — it installs a kernel filter driver; the run warns about this explicitly and the receipt records it
- **Hardware GPU scheduling** — registry change, applies at next boot
- **Hostname changes**
- **Core Isolation / Virtual Machine Platform / BitLocker changes** (if you enabled those options)
- **Disabling Edge** — may require a restart

Power and sleep settings (`sleep_mode: hibernate` and friends) apply immediately — no restart needed for those.

If a setting "didn't work", restart first, then check again.

---

## First game checklist

Bootible cannot sign in for you — accounts and credentials are deliberately yours alone. Seeing sign-in screens now is expected, not a sign anything failed:

- [ ] **Sign in to Steam** (installed by default) — and to the Xbox app if your config keeps `install_xbox_app` on
- [ ] **Sign in to any launchers you enabled** — GOG Galaxy, Epic, EA, Ubisoft Connect, Battle.net
- [ ] **Sign in to your other apps** — Discord, Spotify, and your password manager, if you enabled them
- [ ] **Add your game library folder in Steam** — Bootible creates the folder but cannot safely register it; see [What Stays Manual](manual-steps.md)
- [ ] **Pick a performance profile** in Armoury Crate or G-Helper — also covered in [What Stays Manual](manual-steps.md)
- [ ] **Restart** if you haven't yet

Then install a game and play. You're done.

---

## Where next

- Something reverted after a Windows update, or you changed your config → [Re-running & Drift](re-running.md)
- What Bootible deliberately leaves to you → [What Stays Manual](manual-steps.md)
- Stable vs beta, and how to check which you're on → [Updates & Channels](channels.md)
- Something actually broken → [Troubleshooting](troubleshooting.md)
