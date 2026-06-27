---
description: How saved profiles upload, pull to other machines, resolve conflicts, handle deletion, and behave offline.
tags: [cloud, sync, profiles, conflicts, flow]
audience: { human: 55, agent: 45 }
purpose: { flow: 100, gestalt: 0, reference: 0, research: 0, design: 0, plan: 0, findings: 0, concepts: 0, high-agency-process: 0, low-agency-process: 0 }
---

# Profile Sync Flow

How a signed-in user's device profiles move between their machines automatically, without losing work or exposing secrets. Behind the north-star declarations "profiles follow the person," "never silently overwrite," and "you own your data."

Sync is **automatic on save and on open**, additive to local profiles, and degrades to local-only when offline. Each profile carries a monotonic version and a last-updated stamp so the app can tell new from old and detect divergence.

## Trigger

A signed-in user saves/updates/deletes a profile, or opens the app (or regains network) while signed in.

## Stages

### 1. Save → upload
**Actor**: Desktop app + Worker.
**Action**: On save/Update, the app encrypts the profile's secrets with the local DEK, bumps the profile's version, and uploads `{ id, name, deviceId, baseId, ui, secretsEnc, version, updatedAt }` for the account. Non-secret `ui` is sent as-is; `secretsEnc` is the E2E blob.
**Output**: Cloud copy reflects the latest local edit.
**Failure**: Offline / Worker unreachable → the edit stays saved locally and is queued; a later open/online retries. No error blocks saving.

### 2. Open → pull + merge
**Actor**: Desktop app + Worker.
**Action**: On launch (signed in), the app fetches the account's profile list with versions, and merges into the local set: cloud-only profiles are added, locally-newer ones are kept (and queued to upload), cloud-newer ones replace the local copy.
**Output**: The load list shows the union of local + cloud, each at its newest version.
**Failure**: Offline → show local profiles only; sync silently when network returns. A profile whose secrets can't be decrypted (DEK not unlocked on this machine) still appears, with its non-secret parts usable and secrets shown as "unlock to use."

### 3. Conflict (same profile edited in two places)
**Actor**: Desktop app.
**Action**: If a profile changed both locally and in the cloud since the last sync (divergent versions, neither an ancestor of the other), the app keeps **both** — the incoming one is added as `"<name> (conflict — <other device>)"` rather than overwriting.
**Output**: No edit is lost; the user reconciles by choosing/deleting.
**Failure**: None that loses data — the design favours keep-both over silent overwrite.

### 4. Delete
**Actor**: User + Desktop app + Worker.
**Action**: Deleting a synced profile records a tombstone that propagates; other machines remove it on next pull. Deleting a local-only profile touches nothing in the cloud.
**Output**: The profile is gone everywhere on next sync.
**Failure**: Offline delete → tombstone queued, applied when online.

### 5. Account / data control
**Actor**: User + Worker.
**Action**: The user can list what the account stores (their profiles) and delete the whole account; deletion removes all profiles and wrapped key material server-side.
**Output**: Account and its data are gone; local-only profiles on the machine remain.
**Failure**: None material.

## Termination

A sync cycle ends when local and cloud agree on every profile's latest version (or the queue is drained once back online).

## How we'll know it works

- Two signed-in machines (or two app data dirs): save on A, open B → it appears; edit on both offline, reconnect → both survive as original + "(conflict)".
- Delete on A → gone on B after open. Delete account → list empties and wrapped keys removed (inspect D1).
- Pull on a machine that hasn't unlocked the DEK → profiles list, secrets gated behind "unlock," non-secret build still works.
