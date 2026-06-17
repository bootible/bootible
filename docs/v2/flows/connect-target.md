---
description: The one-time storage-hookup journey — connect a sync target (USB / Syncthing-mirrored folder / S3 / NAS / RomM / bootible.dev), store its credential locally, and assign roles
tags: [bootible, v2, flow, lifecycle, sync-target, storage, roles]
audience: { human: 50, agent: 50 }
purpose: { flow: 85, reference: 15 }
---

# Flow — Connect a target

The one-time hookup that makes "your stuff follows you" real. Runs standalone, or inline during any provision/restore when bootible needs somewhere to read from or write to.

## Trigger

A user enters via the router with intent = **connect-storage**, or a provision/restore flow requests a target it does not yet have.

## Stages

### 1. Pick a backend
- **Actor:** User
- **Action:** Choose from **USB/local** · **Syncthing** (an always-mirrored local folder) · **S3-compatible** · **NAS (SMB/NFS)** · **RomM** · **bootible.dev**.
- **Output:** A backend type selected.

### 2. Enter credentials
- **Actor:** User
- **Action:** Supply credentials; they are stored in the **OS keystore** (or the user's 1Password/Bitwarden). `[secret]`
- **Output:** A credential reference (`secret://…`), never the secret itself, recorded in `targets.yml`.

### 3. Test the connection
- **Actor:** bootible
- **Action:** Connect and `list` what is there.
- **Output:** Confirmation the target is reachable, with a preview of its contents.

### 4. Assign roles
- **Actor:** User
- **Action:** Decide what this target holds — **config**, **saves**, and/or **content source** (roles may split across targets: config in git, saves on S3).
- **Output:** Roles recorded in `targets.yml`.

## Termination

A reachable target is registered in `targets.yml` with its roles assigned and its credential held locally — never hosted.

## Failure modes

- **Bad credential / unreachable target** → the test fails before any role is assigned; nothing is half-registered.
- **Backend lacks a capability** (e.g. no selective `list`) → bootible records the limitation; capability-aware pull degrades to folder-level.
- **Syncthing chosen** → modeled as a transport under the `local` role, not a backend bootible drives; the user controls what flows through it.
