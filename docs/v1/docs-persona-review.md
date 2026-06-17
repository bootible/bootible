---
description: Findings from a three-persona review of docs.bootible.dev (first-timer, returning user, power user) — what each persona needs, where the site fails them, and the accuracy debt discovered
tags: [docs-site, personas, ux, review, accuracy, information-architecture]
audience: { human: 70, agent: 30 }
purpose: { findings: 80, plan: 20 }
---

# Docs Persona Review — Findings

Question: who is each docs page for (first-time non-technical / multi-time semi-technical / power user), and does the site serve them? Three persona-lens reviewers walked all 25 pages; the power-user reviewer also diffed docs claims against source.

## Headline answer

The site has a good reference layer and a broken connective layer — and an accuracy problem that outranks any UX work:

1. **Accuracy debt (blocks everything).** Older pages (`platforms/rog-ally/index.md`, `platforms/rog-ally/modules.md`, `reference/cli.md`, parts of `features/*`) contain ~25 **fabricated config keys and flags** (`install_sunshine` on Windows, `disable_xbox_gamebar`, `-SkipTags`, env vars `BOOTIBLE_PRIVATE_REPO`/`BOOTIBLE_INSTANCE`, an invented exit-code table). Unknown keys validate silently, so every copy-paste from these pages **silently no-ops**. The newer pages (configuration references, drift/receipt content) are accurate — accuracy correlates with page recency.
2. **Decorative keys (source problem, not docs).** ~27 keys exist in `config.yml` + `Validate-ConfigSchema` + the reference docs but are **read by no module**: all 6 `ssh_*` key-management keys, all 11 per-emulator keys, `configure_hdr`, `set_refresh_rate`, `disable_cortana`, `compact_os`, `install_reshade`, `install_hidmanager`, and the whole Paths section (`games_path` etc.). Plus `password_manager` (schema, singular) vs `password_managers` (config + module, plural) — the schema validates a key nothing reads. Decision needed per key: implement or delete.
3. **Each persona fails differently** — mostly NOT on the same pages, which matters for the toggle question.

## Where each persona breaks

### First-timer (non-technical)
- **The unannounced prompt**: quick-start never mentions the `Do you have a private configuration repository? [y/N]` question every first run asks. The "press Enter, it's fine" answer lives on a page they've already passed.
- **Customization is git-gated**: the only documented way to change settings requires `init-private-repo.sh` (bash — unrunnable on their Windows-only device) and `git remote add git@...` (silently requires SSH keys). The no-git local config (`~/.config/bootible/<platform>/config.yml`) is mentioned once and documented nowhere.
- **Trust contradiction**: Home says "Nothing is installed unless you enable it"; the ROG Ally reference shows dozens of defaults set `true` (incl. CCleaner, MSI Afterburner, Python/Node/Java, `disable_edge`). First dry run exposes the contradiction at peak trust-sensitivity.
- **Recovery terrifies**: `sudo btrfs subvolume delete /home` is the first command a panicking novice meets, unguarded, in two places.
- Missing: "it finished — now what?", "what bootible never touches", uninstall, plain-words answer to the `irm | iex` fear.

### Returning user (semi-technical)
- **No "Windows Update broke it" troubleshooting entry** — the SteamOS equivalent exists; the Windows one (bootible's signature use case!) doesn't. The answer lives in a `!!! tip` on quick-start they'd never reopen.
- **Keys without an apply loop**: config references never show edit→commit→push→re-run; the only full loop is on `private-config.md` ("Syncing Changes"), Linux paths only. Where the repo lives on the Ally (`%USERPROFILE%\bootible\private\...`) is stated nowhere.
- **Channels are a dead end**: how to check which channel you're on, or switch — undocumented.
- **multi-device.md gaps**: bash-only commands, steamdeck template URL in the rog-ally flow, missing push step, missing "run the one-liner on the new device" closer.
- No changelog / "What's New" / returning-user door anywhere.

### Power user
- Blocked by the fabricated keys (worst possible failure mode for config-as-code evaluation).
- **Missing contract pages** the source already answers: how drift detection works (probes, `state.json` location, local-only rationale, `-Tags`/no-instance exclusions, report-only GPU policy, verified-repair semantics); release channels & supply-chain integrity (`STABLE_REF` pinning story, `X-Bootible-Ref`/`X-Bootible-Integrity` headers, GitHub-fallback verification bypass caveat); extensibility ("not supported — fork and edit `$moduleOrder`" is the honest answer, said nowhere).
- `reference/cli.md` should be the contract page; it documents the wrong parameters, wrong env vars, fabricated exit codes; omits `-ConfigFile`, the JSON run log (`~/.bootible/logs/run-*.json`), `power`/`health` tags.
- Precedence fine print missing: `-ConfigFile` (bootstrap) bypasses the `~/.config` local layer; no non-interactive instance selection exists.

## What this says about a persona toggle

The personas mostly diverge by **which pages exist and how the nav routes them**, not by needing three renderings of the same paragraph. Genuinely shared pages needing per-persona treatment are few: quick-start (beginner narration vs returning-user shortcuts) and the config references (apply-loop intro vs raw tables). A site-wide persona toggle would fork content three ways on a site that just demonstrated it can't keep ONE copy accurate.

Evidence-supported alternative: **persona-shaped information architecture + native progressive disclosure** —
- Nav restructured as journeys: "Start here" (first-timer funnel, 4 pages max), "Make it yours" (config + apply loop), "Coming back?" (update-broke-it recipe, channels, changelog), "Under the hood" (modules/roles/cli/drift/integrity — clearly marked advanced).
- mkdocs-material native collapsible admonitions (`??? "Advanced"`) for power content inside beginner pages, and "New here?" links at the top of advanced pages — zero custom machinery, zero forked content.
- Optional later: a small JS "Hide advanced pages" switch that collapses the Under-the-hood nav section (localStorage; ~50 lines) — only worth it if analytics/feedback show beginners still wandering into modules.md.

## Fix order (consolidated, all three reviewers)

1. Purge fabricated keys/flags from the six stale pages; regenerate against `config.yml` (the accurate reference pages prove the pattern).
2. Decide decorative keys at the SOURCE (implement or delete; fix `password_manager(s)` schema bug), then sync docs.
3. Beginner funnel: announce the y/N prompt in quick-start; document the no-git local config path; resolve the "everything is opt-in" contradiction; add "after it finishes / if something goes wrong" content; guard the btrfs recovery.
4. Returning-user connective tissue: "After a Windows Update" troubleshooting section; apply-loop block (Windows+Linux tabs) atop both config references; channels section (check/switch); finish multi-device.md.
5. Power-user contract pages: drift mechanics, release channels & integrity, honest extensibility note, rebuilt cli.md.
6. Nav restructure into the four journeys (delivers the persona routing without a toggle).

Guard against recurrence: docs examples could be linted in CI against `config.yml` keys the same way checksums are validated today.
