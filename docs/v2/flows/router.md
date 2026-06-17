---
description: The single front door for every bootible v2 journey — identify who the user is, why they are here, and which device + provisioning model, then route
tags: [bootible, v2, flow, router, onboarding, intent]
audience: { human: 50, agent: 50 }
purpose: { flow: 85, reference: 15 }
---

# Flow — The Router ("Who am I & why am I here")

The single front door. Everything downstream is a branch off this root. The story forks by **persona × intent × device(+model)**, so the router establishes all three before any journey begins.

## Trigger

A user arrives at a surface with a device in hand and an intent in mind — a first provision, a wipe to recover from, a new device to add, a tweak, a storage hookup, or something broken.

## Stages

### 1. Enter a surface

- **Actor:** User
- **Action:** **App** opens to a conversational *"What are we doing today?"*; **CLI** enters via `bootible` (interactive menu) or a direct verb (`bootible restore`, `bootible trimui`).
- **Output:** A live session on the player's or tinkerer's door.

### 2. Identify intent

- **Actor:** User (App: LLM triage · CLI: verb/menu)
- **Action:** Name the job — **first-time provision** · **restore-after-wipe** · **add-a-device** · **tweak-and-update** · **connect-storage** · **troubleshoot**.
- **Output:** One intent selected.

### 3. Identify device

- **Actor:** User + device registry
- **Action:** **App** lists registry-known devices; **CLI** names a target. The registry returns that device's supported **provisioning model(s)** + specifics.
- **Output:** A device, with its model set and specifics resolved from the registry.

### 4. Choose the model (only if the device offers more than one)

- **Actor:** User
- **Action:** e.g. ROG Ally — *"Run setup on the device, or build a setup USB from this computer?"* The **App** recommends; the **tinkerer** passes a flag.
- **Output:** A single provisioning model chosen.

### 5. Route

- **Actor:** Router
- **Action:** Hand off to the matching journey (`provision-*.md`, `restore.md`, `tweak-update.md`, `connect-target.md`, or `troubleshoot.md`).
- **Output:** The user is inside the right flow.

## Fork

- **Player:** the LLM runs the router as a triage conversation.
- **Tinkerer:** verb + flags, or the interactive menu.

## Termination

The user has a resolved **(persona, intent, device, provisioning model)** tuple and has been handed to exactly one downstream flow.

## Failure modes

- **Device not in the registry** → offer "add a device" (a registry entry), or fall back to a generic model the user selects manually.
- **Ambiguous intent** (App) → the LLM asks one clarifying question rather than guessing.
- **User abandons** → nothing is written; next entry starts clean.
