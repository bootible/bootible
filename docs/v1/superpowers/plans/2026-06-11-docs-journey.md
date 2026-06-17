# Docs Journey Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure docs.bootible.dev into Gavin's journey order — Getting Started (device-agnostic, opening with a zero-config quick try) → Configure Your Device → Install & Run → Post Install → Reference — while landing the outstanding persona fixes (docs/docs-persona-review.md fix-order items 3–5) inside the new structure, with redirects so no shipped link breaks.

**Architecture:** mkdocs-material site at docs-site/. Pages move on disk to match sections; mkdocs-redirects maps every old URL. Content rules: every key/flag/behavior claim verified against source (the accuracy bar set by v1.1 T6); ASCII-quotes tolerance per existing pages; no timestamps/"currently". The receipt FAQ ships the URL `docs.bootible.dev/reference/troubleshooting/` — that path MUST keep working (redirect or stay).

**Decisions baked in (Gavin, 2026-06-11):** structure is his 4 sections + Reference; "Try it in 5 minutes" (zero-config) is the FIRST page of Getting Started; built now, docs-only, zero risk to the Saturday RC; persona agents re-walk as the final gate. The homepage "Nothing is installed unless you enable it" contradiction is resolved by HONEST REWORDING (defaults are a curated gaming baseline, dry-run shows everything first) — config defaults themselves do not change in this branch.

**House rules:** verify-gate stamp before commits (suite currently 117/0 — docs branch, but the gate requires the run); commit messages without "claude"/"anthropic", no Co-Authored-By; `git add` only task files; build check per task: `mkdocs build --strict` if mkdocs is installed locally, else defer to Cloudflare Pages preview (note which in reports).

---

### Task 1: Nav skeleton, file moves, redirects

**Files:** docs-site/mkdocs.yml, docs-site/requirements.txt, all moved .md files (git mv), docs-site/docs/index.md (section links).

- [ ] Add `mkdocs-redirects>=1.2` to requirements.txt and the `redirects` plugin block to mkdocs.yml.
- [ ] New nav + disk layout (git mv; keep filenames stable where the section already fits):

```
- Home: index.md
- Getting Started:
  - getting-started/index.md            # rewritten in T2 (section intro + journey map)
  - Try It in 5 Minutes: getting-started/quick-try.md       # NEW (T2)
  - Your Config Repo: getting-started/config-repo.md        # was private-config.md (rewritten T2)
  - Config Basics: getting-started/config-basics.md         # was configuration/index.md (moved, light edit T2)
  - Multi-Device: getting-started/multi-device.md           # stays (already fixed in v1.1)
- Configure Your Device:
  - configure/index.md                  # was platforms/index.md (trimmed T2 — comparison table stays, architecture moves to Reference)
  - ROG Ally: configure/rog-ally.md     # was configuration/rog-ally.md
  - Steam Deck: configure/steam-deck.md # was configuration/steam-deck.md
  - Android (ALPHA): configure/android.md
  - Features:
    - configure/features/streaming.md ... emulation.md, remote-access.md, decky.md   # moved as-is
- Install & Run:
  - install/index.md                    # NEW (T3): merged quick-start + first-run, per-device tabs
- Post Install:
  - post-install/index.md               # NEW (T4): receipt + health checks ("it finished - now what")
  - Re-running & Drift: post-install/re-running.md          # NEW (T4) — incl. "After a Windows Update"
  - What Stays Manual: post-install/manual-steps.md         # NEW (T4)
  - Updates & Channels: post-install/channels.md            # NEW (T4)
  - Troubleshooting: post-install/troubleshooting.md        # was reference/troubleshooting.md (moved + btrfs guard T4)
- Reference:
  - reference/index.md
  - CLI: reference/cli.md
  - FAQ: reference/faq.md
  - How Drift Detection Works: reference/drift.md           # NEW (T5)
  - Release Channels & Integrity: reference/integrity.md    # NEW (T5)
  - Platform Internals:
    - ROG Ally Modules: reference/rog-ally-modules.md       # was platforms/rog-ally/modules.md
    - Steam Deck Roles: reference/steam-deck-roles.md       # was platforms/steam-deck/roles.md
    - Architecture: reference/architecture.md               # extracted from old platforms/index.md (T2)
    - ROG Ally Platform Notes: reference/rog-ally-platform.md   # was platforms/rog-ally/index.md
    - Steam Deck Platform Notes: reference/steam-deck-platform.md # was platforms/steam-deck/index.md
    - Android Platform Notes: reference/android-platform.md     # was platforms/android/index.md
```
- [ ] Redirect map: EVERY moved page old-URL → new-URL (incl. `reference/troubleshooting/` → `post-install/troubleshooting/` — receipt FAQ dependency; getting-started/quick-start + first-run → install/; getting-started/private-config → getting-started/config-repo; configuration/* → configure/* or getting-started/config-basics; platforms/* → reference/* pages; features/* → configure/features/*).
- [ ] Fix all INTERNAL cross-links in moved pages (grep for `](../` and `](/` patterns per moved file; mkdocs build --strict catches broken ones if available).
- [ ] index.md (homepage): update the card/section links to the new paths.
- [ ] Suite + stamp; commit `docs(site): journey-order nav with redirects`.

### Task 2: Getting Started section content

**Files:** getting-started/index.md, quick-try.md (new), config-repo.md (rewrite), config-basics.md (edit), docs-site/docs/index.md (one claim fix).

- [ ] **quick-try.md (NEW):** the nervous-first-timer page. Required elements: what will/won't happen (dry run first, restore point, nothing without `bootible`); the one-liner; "when it asks about a private configuration repository, just press Enter — you can add one later" (THE y/N fix); expected duration ballpark phrased as "varies with app count and connection" (no invented numbers); "what bootible never touches" reassurance list (verify each claim: personal files, game saves, Windows license); the trust paragraph (checksum-verified serving, open source, link to reference/integrity.md); ends with "ready to make it yours → Your Config Repo".
- [ ] **config-repo.md (rewrite of private-config.md):** GitHub WEB-UI-first flow (create repo in browser from the template via "Use this template" if the repo supports it — VERIFY whether init-private-repo.sh has a template-repo equivalent; if not, document: create empty private repo in browser → bootible's device-flow auth handles the rest at install time — VERIFY against targets/ally.ps1's private-repo flow before writing ANY claim); keep the advanced bash path as a collapsed "I prefer the terminal" section; DOCUMENT the no-git local config (`~/.config/bootible/<platform>/config.yml`, and the -ConfigFile bootstrap caveat from Run.ps1 — verify); platform-tabbed paths (Windows `%USERPROFILE%`).
- [ ] **config-basics.md:** from configuration/index.md; add the "where your config lives on each device" tab box and the apply-loop summary (edit → commit → push → run `bootible`) with a link to post-install/re-running.md.
- [ ] **index.md claim fix:** replace "Nothing is installed unless you enable it in your configuration" with honest wording: defaults are a curated gaming baseline — the dry run shows every change before anything is touched, and every item is a config key you can turn off. (Verify the final wording against config.yml's actual defaults posture.)
- [ ] **getting-started/index.md:** section intro = the journey map (your 4 steps as cards), FAQ accordions stay (they tested well with the first-timer persona).
- [ ] Suite + stamp; commit `docs(site): getting-started rebuilt - quick try, web-first config repo, honest defaults claim`.

### Task 3: Install & Run section

**Files:** install/index.md (new, from quick-start.md + first-run.md content), delete the two old files (redirects already in place from T1).

- [ ] Per-device tabs (ROG Ally / Steam Deck / Android) each with: the one-liner, what the bootstrap does (auth → clone → instance selection — describe the REAL prompt sequence from targets/ally.ps1 and deck.sh, not invented terminal output: REMOVE the fabricated ASCII outputs the persona review flagged; describe prompts in prose or use verified snippets only), the `[y/N]` prompt callout, dry-run review guidance (what sections to look at incl. SAC line and the validation summary), then `bootible` to apply, instance selection for multi-device.
- [ ] Keep the duration/interruption guidance honest ("safe to re-run if interrupted" — verify idempotency claim wording against FAQ's).
- [ ] Suite + stamp; commit `docs(site): unified install and run journey`.

### Task 4: Post Install section

**Files:** post-install/index.md, re-running.md, manual-steps.md, channels.md (all new), troubleshooting.md (moved + edits).

- [ ] **index.md:** "It finished — now what": the Desktop receipt walkthrough (sections of `Bootible - Read Me.md` — match New-BootibleReceipt's real output shape), health-check summary meaning, restart guidance (hibernate/HidHide reboot notes — verify which features request restarts), first-game checklist.
- [ ] **re-running.md:** THE returning-user page. "After a Windows Update" recipe front and center (symptoms → run `bootible` → drift report explained with the real friendly names → receipt shows verified repairs); the monitored-surface list (hibernate, Game Bar presence, GPU driver version report-only, wallpaper, SSH state, HAGS — from Get-LiveState, verify); the apply-loop for config changes (per-platform paths); link to reference/drift.md for mechanics.
- [ ] **manual-steps.md:** honest list of what bootible deliberately doesn't automate, with the why: Armoury Crate profiles, Steam library folder registration (vdf risk), EmuDeck's interactive configuration (research-backed), MyASUS store completion, TDP/performance tuning (G-Helper's job). Each with the manual click-path.
- [ ] **channels.md:** stable vs beta semantics (STABLE_REF model in plain words), how to check what you're on (`(Invoke-WebRequest https://bootible.dev/rog).Headers['X-Bootible-Ref']` + the receipt's version line), how to switch (re-run the other channel's one-liner — verify Clone-Bootible's ref behavior makes this true), link to reference/integrity.md.
- [ ] **troubleshooting.md:** moved; add the btrfs recovery guard (danger admonition: "this deletes your home folder's current state — back up first; only proceed if restore is your goal", skill-gate phrasing); add an "After a Windows Update" pointer to re-running.md at the top of ROG Ally Issues.
- [ ] Suite + stamp; commit `docs(site): post-install journey - receipt, drift recipes, manual steps, channels`.

### Task 5: Reference section + deck accuracy ride-alongs

**Files:** reference/drift.md, reference/integrity.md (new), reference/index.md (hub update), reference/rog-ally-modules.md (extensibility note), reference/steam-deck-roles.md + steam-deck platform/config pages (deck accuracy fixes).

- [ ] **drift.md:** the contract page — what's probed (exact key list from Get-LiveState), where state.json lives, local-only-by-design rationale, baselining semantics (detector not compliance engine), -Tags/no-instance exclusions, gpu report-only, verified-repair flow (Get-VerifiedRepairs). Source: lib/state-snapshot.ps1 + Run.ps1 drift blocks — verify every sentence.
- [ ] **integrity.md:** the trust page — why `irm | iex` here is different: worker serves deploy-time-pinned STABLE_REF + per-channel sha256 (sha256Stable pinned per release, beta auto-synced to main), verification headers (X-Bootible-Ref / X-Bootible-Integrity) with a check-it-yourself snippet, the GitHub-raw fallback caveat (verification bypassed with console warning — honest), what a release activation looks like (one reviewable commit). Source: cloudflare/_worker.js + docs/releasing.md — verify.
- [ ] **Extensibility note** (in rog-ally-modules.md intro): custom modules are not supported — `$moduleOrder` is hardcoded; the supported route is fork + edit; link CONTRIBUTING/FAQ.
- [ ] **Deck accuracy ride-alongs** (from the T6 reviewer's findings): steam-deck-roles.md Chiaki flatpak ID → `io.github.streetpea.Chiaki4deck` (verify in roles/flatpak_apps), ssh_key_name default → match config/steamdeck/config.yml; sweep both deck pages for other key/default mismatches against config/steamdeck/config.yml + roles (time-boxed: verify every key table row, fix what's wrong, report what was found).
- [ ] Suite + stamp; commit `docs(site): drift and integrity contract pages, deck reference accuracy`.

### Task 6: Persona re-walk gate + final review

- [ ] Dispatch is the CONTROLLER's job (not this implementer): first-timer + returning-user persona agents re-walk the rebuilt site against their original top-5 complaints; power-user agent verifies the two new contract pages against source. Controller fixes findings via implementer rounds.
- [ ] Final checks: mkdocs build --strict (or Pages preview), full redirect map spot-check (old URLs incl. the receipt-FAQ troubleshooting link), suite green, fabrication sweep still clean.

---

## Self-review notes
- Redirects are load-bearing (receipt FAQ + launch drafts link old paths) — T1 lands them BEFORE content moves change meaning.
- Every new page lists its source-of-truth files; the T6 accuracy bar (verify every claim) applies throughout.
- The homepage claim fix (T2) is wording-only; config defaults are out of scope on this branch.
