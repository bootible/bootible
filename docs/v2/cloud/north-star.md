---
description: What great looks like for optional bootible accounts and cloud profile sync — testable outcomes from the user's perspective.
tags: [cloud, sync, auth, accounts, north-star]
audience: { human: 60, agent: 40 }
purpose: { north-star: 100, gestalt: 0, reference: 0, research: 0, design: 0, plan: 0, flow: 0, findings: 0, concepts: 0, high-agency-process: 0, low-agency-process: 0 }
---

# Cloud Accounts & Profile Sync — North Star

Gavin sets up his ROG Ally exactly how he likes it, saves the profile, and signs into bootible with his Discord account in two clicks. A month later he's at a friend's place on a different PC, opens bootible, signs in, and his "ROG AllyX — VengeanceX" profile is right there — every app, emulator, removal, wallpaper and the Sunshine password, ready to build a stick. He never typed any of it twice. And if he never signs in at all, bootible works exactly as it always has: local, offline, no nag.

---

## Declarations

### Optional, never in the way

- A person can do everything bootible does today — pick a device, build a USB, strip a ROG — **without an account and without a network**.
- Signing in is offered, never required; dismissing it leaves the app fully functional.
- A signed-out user sees no broken features, no empty "cloud" panels, no errors from the absence of a network.

### Signing in is fast and familiar

- A new user can create an account and be signed in **in under a minute** using Google, GitHub, Discord, Twitch, email+password, or a passkey.
- A returning user on the same machine stays signed in across app restarts without re-authenticating.
- A user can sign out, and after signing out no account data remains readable on that machine.

### Profiles follow the person

- When a signed-in user saves or updates a profile, it is available on any other machine where they sign in.
- When a signed-in user opens the app on a second machine, their saved profiles appear in the load list without any manual import/export.
- A profile restored from the cloud rebuilds the **entire** setup — apps, emulators, removals, SSH, remote access, hostname, wallpaper/lock-screen choices, and secrets — identically to where it was saved.
- A user can still use purely local profiles; cloud sync never deletes or overrides a local profile without the user's action.

### Secrets stay the user's secrets

- A profile's secrets (e.g. the Sunshine password) sync between the user's machines, yet **bootible's servers can never read them** — they are encrypted before they leave the device with a key only the user controls.
- A user who loses access to their secret key understands that synced secrets cannot be recovered (and the non-secret parts of their profiles still sync).

### The user owns their data

- A user can see what is stored in their account (which profiles) and **delete any profile or their whole account**, and deletion removes it from the cloud and other machines on next sync.
- A conflict (the same profile edited on two machines) resolves predictably and never silently loses the user's work.

---

## What We Won't Accept

- An account being **required** to build a USB or run any existing flow.
- bootible's servers being able to read a user's stored passwords/secrets in plaintext.
- A sync that **silently overwrites** a newer local profile with an older cloud copy (or vice-versa).
- Sign-in that blocks the UI on a slow/absent network, or leaves the app stuck if the cloud is unreachable.
- Storing more about the user than is needed to sync profiles (no telemetry-by-stealth riding along with auth).
- Console-login promises bootible can't keep (Xbox/PSN) shown as if they work.

---

## How to Use This Document

This north star is the evaluation target for the cloud flows, design, and plans. A design decision that serves a declaration here is justified; one that doesn't needs a reason. The secrets and "optional, never in the way" declarations are the ones most likely to be violated by a convenient shortcut — guard them.
