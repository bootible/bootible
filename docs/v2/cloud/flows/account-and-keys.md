---
description: How a user signs in and how the end-to-end secret key is created, unlocked on new devices, and recovered.
tags: [cloud, auth, e2e, keys, flow]
audience: { human: 55, agent: 45 }
purpose: { flow: 100, gestalt: 0, reference: 0, research: 0, design: 0, plan: 0, findings: 0, concepts: 0, high-agency-process: 0, low-agency-process: 0 }
---

# Account & Secret-Key Flow

How a person signs into bootible and how their profile secrets become readable on every machine they own — without bootible's servers ever being able to read them. This is the process behind the north-star declarations "signing in is fast" and "secrets stay the user's secrets."

The shape: sign-in (identity) and the secret key (privacy) are **separate**. better-auth proves who you are. A user-controlled **sync passphrase** unlocks a per-account encryption key that the server only ever stores in wrapped (unreadable) form.

## Trigger

A signed-out user chooses "Sign in" in the desktop app, or opens the app already signed in on a machine that has not yet unlocked the secret key.

## Stages

### 1. Authenticate
**Actor**: User + better-auth (Cloudflare Worker).
**Action**: User picks a provider — Google, GitHub, Discord, Twitch, email+password, or a passkey — and completes it in the system browser (OAuth) or in-app (email/passkey). better-auth issues a session.
**Output**: An authenticated session bound to this machine; an account id.
**Failure**: Provider denied / cancelled → return to signed-out, app fully usable. Network down → "Couldn't reach sign-in, you can still use bootible offline."

### 2. First-ever sign-in: create the secret key
**Actor**: Desktop app (local crypto) + Worker (stores wrapped material only).
**Action**: The app generates a random **data key (DEK)** used to encrypt all profile secrets. The user sets a **sync passphrase**; the app derives a key-encryption-key from it (Argon2id) and uses it to **wrap** the DEK. The app also produces a one-time **recovery code** and wraps the DEK with it too. Both wrapped copies upload; the plaintext DEK never leaves the device.
**Output**: Server holds `wrapped_by_passphrase(DEK)` + `wrapped_by_recovery(DEK)` and never the DEK itself. The device holds the DEK in the OS keychain. User has saved their recovery code.
**Failure**: User skips setting a passphrase → secrets simply don't sync (non-secret profile data still does); they can set it up later.

### 3. New device: unlock the secret key
**Actor**: User + Desktop app + Worker.
**Action**: After authenticating on a second machine, the app sees secrets exist for the account and prompts for the **sync passphrase**. It fetches the wrapped DEK, derives the key from the passphrase, unwraps the DEK locally, and stores it in that machine's keychain.
**Output**: This machine can now decrypt synced secrets; future sign-ins on it skip the prompt.
**Failure**: Wrong passphrase → unwrap fails locally, "passphrase didn't match," retry or use recovery. Passphrase forgotten → Stage 4.

### 4. Recover (forgotten passphrase)
**Actor**: User + Desktop app.
**Action**: User enters their **recovery code**; the app unwraps the DEK with it, then prompts to set a new passphrase (re-wraps the DEK, uploads the new wrapped copy).
**Output**: Access restored; new passphrase active.
**Failure**: Passphrase **and** recovery code both lost → the DEK is unrecoverable by design; synced **secrets** cannot be decrypted (a fresh DEK can be generated, losing old secrets), but all **non-secret** profile data is unaffected. The app states this plainly before it happens.

### 5. Sign out
**Actor**: User + Desktop app.
**Action**: End the better-auth session and remove the DEK from this machine's keychain.
**Output**: No account data or secret key readable on this machine; local-only profiles remain.
**Failure**: None material.

## Termination

The flow completes when the machine holds a valid session **and** (if the user uses secret sync) the unwrapped DEK — or when the user has explicitly continued without secret sync.

## How we'll know it works

- On a dev machine: sign in with two test accounts; set a passphrase; confirm the server stores only wrapped blobs (inspect D1 — no plaintext DEK or secrets).
- New-device simulation: clear the local keychain entry, re-unlock with the passphrase, confirm secrets decrypt; enter a wrong passphrase, confirm it fails locally without a server round-trip leaking anything.
- Recovery: forget passphrase → recovery code path restores access.
