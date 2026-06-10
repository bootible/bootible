# r/ROGAlly Launch Post (draft)

Draft for Gavin to copy, edit, and post himself. Nothing here auto-publishes.

## Title options (pick one, ≤300 chars)

1. I built a one-command setup for the Ally that survives Windows Updates - free and open source
2. Tired of redoing the new-Ally checklist every time Windows Update breaks something? I automated it - one command, open source, dry-run first
3. One PowerShell command: debloat, hibernate fix, G-Helper, your apps - and re-running it repairs whatever an update reverted (MIT, free)

## Post body

We've all done the checklist. New Ally arrives, and before you play anything you spend the first hour debloating Windows, switching sleep to hibernate so the battery doesn't drain overnight, grabbing G-Helper, installing your launchers and streaming clients — step by step, on an on-screen keyboard. And then a Windows update lands and quietly undoes half of it, and you get to play "what changed?" instead of playing games.

I got tired of doing that by hand, so I built **Bootible**. One command in PowerShell (as admin):

```
irm https://bootible.dev/rog | iex
```

**What it does:**

- Debloats Windows — kills the ads, tips, lock-screen junk, Bing/Copilot, Edge bloat, telemetry
- Fixes sleep — switches to hibernate so the battery is still there tomorrow
- Installs G-Helper (optional) — the Armoury Crate alternative everyone recommends
- Installs YOUR apps — launchers (Steam, Epic, GOG, Battle.net...), streaming clients (Moonlight, Chiaki, Parsec...), and anything else you list, via winget
- Warns about Smart App Control — detects it and tells you what to do before it permanently breaks Armoury Crate
- Leaves a receipt — "Bootible - Read Me.md" on your Desktop after every run: what was installed, what changed, and an FAQ

**What makes it different from winutil/debloat scripts:**

- **Re-running repairs drift.** It snapshots known-good state, so after an update breaks things you run `bootible` again and it detects what reverted and re-applies it. It only claims a repair after verifying post-run that the fix actually took — no false "fixed it" messages.
- **Your config lives in YOUR private repo.** Setup is YAML in your own GitHub repo. New device (or a fresh wipe)? Same command, same setup. Multiple devices, one config repo.
- **Dry-run by default.** The one-liner changes NOTHING on first run — it shows you everything it would do. You type `bootible` to actually apply. You can read every line of what's coming before it touches your machine.

**Honesty section (what it does NOT do):**

- It's MIT-licensed open source — read the code before you run it: https://github.com/bootible/bootible
- No TDP/performance profile management — that belongs to G-Helper or Armoury Crate at runtime; Bootible installs the tool, it doesn't drive it
- No driver updates or rollback, and it can't stop Windows Update from breaking things — it repairs after the fact, it doesn't prevent
- No Armoury Crate removal
- It doesn't remove preinstalled Store apps (yet) — doing that safely without breaking Xbox/Game Pass needs more care than a registry sweep

Docs: https://docs.bootible.dev

Feedback very welcome — this scratches my own itch and I want it to scratch yours too. On the roadmap: SteamOS-on-Ally support is being explored, so the same tool and config could follow you if you jump ship from Windows. If something breaks, the run logs land in your private repo, so it's easy to share details in an issue.

<!--
NOTE TO GAVIN (do not include in the post):
- Check r/ROGAlly's self-promo rules and any required flair BEFORE posting. Some device subs require mod approval or a specific "Tool/Software" flair for this kind of post.
- Plan to be around for the first few hours after posting — answering early comments quickly is what keeps these posts alive.
- The research notes say device-subreddit launch posts are a primary ignition channel; the comments ARE the launch.
-->
