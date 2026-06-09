---
description: Community-needs and competitive-landscape research informing bootible's roadmap direction (sources gathered mid-2026)
tags: [handheld, rog-ally, steam-deck, steamos, bazzite, windows, setup-automation, adoption, roadmap]
audience: { human: 60, agent: 40 }
purpose: { research: 90, reference: 10 }
---

# Handheld Setup Landscape — Community Research

Decision this informs: which direction(s) bootible invests in next to grow community adoption.

Four parallel investigations: (1) owner pain points, (2) adjacent/competing tools, (3) device/OS platform momentum, (4) wildcard angles (save sync, streaming, growth mechanics, family/fleet, monetization, AI assist). Evidence graded 📄 directly observed / 📚 documented / 🧠 synthesis.

## Where bootible stands

- bootible: 5 GitHub stars, 0 forks, no releases published 📄 ([repo](https://github.com/bootible/bootible))
- No other project covers both Linux and Windows handhelds with a config-as-code approach 📄 (GitHub topic sweeps: `rog-ally`, `steam-deck`)
- The "one-liner install" pattern (`irm | iex`, `curl | bash`) is the established norm in this community — EmuDeck, Sunshine-AIO, winutil all use it 📄

## Validated owner pain (Windows handhelds)

| Pain | Evidence | Grade |
|------|----------|-------|
| Sleep/standby broken; 10–23% battery drain in 12h; wake failures | retrohandhelds.gg Feb 2026; Slashdot Oct 2025; ValveSoftware/SteamOS#2385 | 📄 |
| Smart App Control irreversibly breaks Armoury Crate (all Ally variants) | windowscentral.com; windowsforum.com threads 2025–26 | 📄 |
| Windows updates repeatedly break gaming perf/drivers (KB5035853, 24H2 AutoHDR, KB5066835); community norm is "wait and watch Reddit before updating" | windowslatest.com; digitaltrends.com; bleepingcomputer.com | 📄 |
| Update churn re-breaks settings (TDP resets, driver downgrades, Armoury Crate components) | rog-forum.asus.com; thewincentral.com | 📄 |
| The "new handheld checklist" (8–12 steps: debloat, G-Helper, hibernate-not-sleep, TDP, etc.) is stable, widely consulted, and entirely manual | ASUS official guide; XDA; HowToGeek; baldsealion.com converge | 📄 |
| Three separate update locations (Armoury Crate, Windows Update, MS Store) vs Steam Deck's one | xda-developers.com Apr 2026 | 📄 |

What people install instead (demand proxies): winutil 55.7k★ (generic Windows), Win11Debloat 47.3k★, G-Helper 13.6k★ (hardware control), Handheld Companion 1.7k★ (input layer). Highest-starred *handheld-specific setup script*: 11★ (Oganir). 📄

## Validated owner pain (Steam Deck / SteamOS)

- SteamOS updates wipe pacman-installed packages and sshd config (A/B root replacement) — setup work does not persist; community workaround is userspace installs 📄 (jeromeswannack.com; steamcommunity.com)
- SSH enablement is a non-obvious multi-step manual process; community automation scripts exist 📄 (github.com/9999years/steamdeck-ssh-setup)
- CryoUtilities (3.5k★) is effectively obsolete since SteamOS 3.6 and now reportedly harms performance — its stars are a relic; no successor at comparable adoption 📄 (CryoByte33/steam-deck-utilities#188)

## Platform momentum (mid-2026)

1. **SteamOS expanding**: 3.7 (May 2025) added Legion Go S official + other-AMD beta; 3.9 (Apr 2026) reported support across AMD handhelds; Legion Go 2 SteamOS ships Jun 2026 at $1,199; Valve publishes official install images 📄 (steamdeckhq.com; ubergizmo.com; videocardz.com). Intel handhelds (MSI Claw) excluded 📄
2. **Windows still default on most non-Valve handhelds**; Xbox Mode (rebranded FSE) rolled out Apr 2026 via server-side flag — saves ~2GB RAM, but does NOT address OEM bloat, TDP, debloat, or update regressions; cannot be relied on as present 📄 (news.xbox.com; techradar.com)
3. **Bazzite tripled** to ~68.2k users in 8 months (driver: Windows 10 EOL Oct 2025); its `ujust` model = interactive post-install menu, not reproducible config; private-overlay model absent there 📄 (xda-developers.com; docs.bazzite.gg)
4. Market size: ~2.3M PC handhelds sold 2025 (+32% YoY, Omdia); Steam Deck ≈50% of 2024 purchases; ROG Xbox Ally launched strong then "came back down significantly" (Circana, Feb 2026) 📄
5. Android handheld niche (Retroid/AYN/Anbernic): real setup pain, explicit press demand for "pre-configured" devices, no standardized automation tooling 📄 (androidauthority.com; retrohandhelds.gg)

## Unsolved problems repeatedly surfacing

- **Save-game sync across devices**: Ludusavi (5.7k★) is push-only — no auto-pull on the other device; Decky Cloud Save retired early 2026; Syncthing setup is 5–15 manual steps per device and fragile across suspend 📄 (mtkennerly/ludusavi#436; decky.net; retrogamecorps.com)
- **Streaming host setup**: Sunshine 37.8k★ vs its only automation layer Sunshine-AIO 262★ — huge interest, thin automation; no "set up streaming to your handheld" one-liner exists 📄
- **Family/multi-device**: "Setting up a Handheld for Children" guide (Apr 2024) still drawing troubleshooting comments Dec 2025; author: "YOU are the one who is going to do that work"; Steam Families covers library/parental controls but not device config; no tool owns configure-many-devices 📄 (retrogamecorps.com; steamdecklife.com)
- **AI-assisted setup/troubleshooting**: nothing purpose-built exists; G-Assist needs RTX hardware; Discord is the state of the art 📄

## How tools in this space actually grow

Pattern from EmuDeck / CryoUtilities / Decky / Bazzite case studies 📄🧠:

1. Launch timed to a device cohort's arrival (EmuDeck shipped v1 the same month its creator's Deck arrived; Bazzite's spike rode Windows 10 EOL)
2. One amplifier ignites discovery: a Reddit post in the device subreddit (EmuDeck's launch post), a YouTuber (ETA PRIME ~1.32M subs), or a hub partnership (CryoUtilities × SteamDeckHQ)
3. The tool solves a task users already attempted manually and failed
4. Discord becomes the retention/support surface (EmuDeck 42k, Bazzite 34k, Decky 12.5k members)

Discovery channels ranked by observed effect: YouTube coverage > device-subreddit posts > native stores (Decky store) > awesome-lists > Linux gaming press (GamingOnLinux).

## Sustainability reality

- Decky: ~$1,820/mo on Open Collective despite 1M+ downloads (~0.001% conversion); Bazzite: ~$1,656/mo, 335 contributors, Framework top sponsor 📄 (opencollective.com)
- Patreon feature-gating works for EmuDeck (CloudSync, early access) and Handheld Companion (early builds) 📄
- Hardware crowdfunding failed for EmuDeck (40/100 minimum orders) 📄
- 60% of OSS maintainers unpaid; 44% report burnout 📚 (byteiota.com)

## Demand for config-as-code specifically

- No gamer uses the words "config-as-code" — the language is absent from every source consulted 📄
- The demand expresses as: repeated manual re-setup after updates, checklist culture, SteamDeckPostInstallScript-style personal automation (51★), Steam Deck dotfiles repos (low stars), Winhanced "Smart Profiles" (community per-game settings packages) 📄
- chezmoi (20k★) and Nix culture have not crossed into gaming communities in any observable way 📄

## Whitespace observed (no tool credibly owns)

- One-command fresh setup for a Windows handheld
- "Run this after installing SteamOS on your Ally/Legion Go" post-install setup
- Cross-platform (Windows AND SteamOS) same-tool same-config setup
- Multi-device household / configure-many-once
- Private config overlay translated into gamer-facing workflow
- Bidirectional, automatic save sync across a household's devices
- Streaming host+client pairing automation

## Gaps / unknowns

- Reddit community sizes unverifiable (API restrictions); all Reddit signals secondhand
- EmuDeck/CryoUtilities Patreon revenue not public
- Whether mainstream (non-developer) gamers would adopt a simplified config-as-code workflow is not answerable from available evidence — the demand evidence is developer-adjacent
- SteamOS 3.9 "official ROG Ally support" rests on one unverified source
- Xbox Mode CFR regional coverage undocumented; scripted tools cannot assume its presence
- No data on bootible's own funnel (no telemetry, no release history)
