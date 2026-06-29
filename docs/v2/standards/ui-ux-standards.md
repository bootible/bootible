---
description: Cross-device UI/UX standards for bootible — the "same task = same experience" contract, the shared component set, and the per-feature unified patterns.
tags: [standards, ui, ux, design-system, components, cross-device]
audience: { human: 55, agent: 45 }
purpose: { reference: 55, process: 45 }
---

# UI/UX standards — bootible

The product promise: **the same conceptual task feels the same on every device.** Picking apps, saving a profile, building bootable media, setting a static IP — identical layout, labels, and interaction on ROG, Deck, and every device added later. Device differences change *which capabilities are available*, never *the workflow*.

This is the contract the [cohesion review](cohesion-findings.md) found broken in six places. The rules below close them and stop the next one.

---

## The contract

> **Same task → same route, same layout, same component, same labels, same states.**
> A device that lacks a capability **disables or hides the relevant control in place, with a reason** — it does not get its own screen, its own flow, or its own widget.

Corollary: there is **no such thing** as a device-prefixed view for a shared task. `deckapps`, `deckwrite`, `deckpm`, `deckreimage` are smells. The only justified device-specific screen is a genuinely unique task (e.g. SteamOS *reimage* has no Windows equivalent) — and even then it reuses the shared components.

---

## 1. Navigation & flow

1. **One wizard progression for all devices:** `Platform → Device → Configure → Media (method → write) → Done`. After the device is chosen, everyone lands on the same "Configure" step; the device only changes which capability sections appear.
2. **Routes name tasks, not devices.** `/configure/apps`, `/configure/network`, `/configure/access`, `/media/method`, `/media/write` — device context lives in state, not the route. Retire `deck*` route families.
3. **The summary rail and progression conventions are identical** across devices.

## 2. The shared component set (build once, use on every device)

No screen hand-builds these. Each is a real component owning its own behavior, states, and accessibility — not a CSS class.

| Component | Replaces today's… | Owns |
|---|---|---|
| `Section` | `.cz-sec`, ROG sections | title, count, layout |
| `ToggleRow` | `deckCheck`, ROG toggles | label, description, `changes:` line, state |
| `Field` | scattered `.uw-select` inputs | label, input, validation message, help |
| `GroupedPicker<T>` | `renderApps` + `renderDeckApps` + `deckItemRow` | category grouping, group select/indeterminate, search, selected count, logo/description, loading/empty/error, optional detail expansion |
| `ProfileBar` | ROG profile rows + Deck toolbar | load, save-new, update, delete, dirty state, confirm, success/error, cloud-sync status |
| `NetworkSettings` | ROG static-IP field + Deck Network section | DHCP default, capability-gated static fields, shared validation |
| `SshAccessEditor` | ROG SSH tabs + Deck SSH toggle/textarea | enable, port, keys, paste, GitHub import, resulting-key preview |
| `DiskPicker` | the 3 disk renderers | enumerate, refresh, select, loading/empty/error |
| `ProgressPanel` | the 3 progress UIs | phase, %, cancel, failure, completion |
| `StatusMessage` | ad-hoc success/error text | consistent success / warning / error / retry |

**Rule:** if you need one of these and it doesn't exist yet, build the component and adopt it on **both** devices in the same change — then delete the two old implementations.

## 3. Per-feature unified patterns

These resolve the specific divergences the review found.

- **Profiles (`ProfileBar`).** Same component, same place on every device. Actions: **Load, Save new, Update, Delete**. Always show dirty state, a confirm on destructive actions, success/error, and cloud-sync status. Saving never silently overwrites without an explicit Update.
- **App selection (`GroupedPicker`).** Identical category order, row shape, group selection, search, and counts on every device. **Counts describe the visible scope** — a screen count never includes selections hidden on another screen. A separate global summary may total everything.
- **Network / static IP (`NetworkSettings`).** Default DHCP. Enabling static reveals interface + address + prefix + gateway + DNS with identical validation and explanation. **Capability nuance is allowed but must be visible, not divergent:** where a platform can infer values (ROG infers prefix/gateway/DNS from the host subnet — honoring the project's "minimize typing" principle), it shows them inferred/read-only with a reveal, in the **same component** — not a different screen or a bare single field.
- **SSH (`SshAccessEditor`).** One editor: enable, port, local keys, paste, GitHub import, and a preview of the resulting authorized keys. Hide only capabilities the target genuinely can't do.
- **Streaming — organized by role, not product.** "Stream **from** this device" (Sunshine server, with its credentials shown beneath it), "Play streams **on** this device" (Moonlight/Chiaki clients), "Also install on this computer" (host option). **Remote access (SSH/RDP/VNC/VPN) is a separate concept from streaming** and lives under access/networking on every device.
- **Building media — one shell, same steps everywhere:**
  1. Choose outcome → 2. Choose image/source (if required) → 3. Choose target drive → 4. **Review the exact destructive action** (names the disk, states all data is erased) → 5. Confirm erase → 6. Write with progress + cancel → 7. Shared completion panel (eject status + device-specific *next steps*).
  Device differences (Windows ISO vs SteamOS image vs Deck reimage-vs-provision) are options *within* this shell, not separate screens.

## 4. States & feedback

4. **Every async surface has four states:** loading, populated, empty, error-with-retry. Never render an empty success state for a failure.
5. **Every destructive action** requires explicit confirmation and stays disabled until a valid target is selected. The confirmation names the target and states the consequence.
6. **Every successful write ends in the shared completion panel** — not a completion encoded only in a progress caption.
7. **Terminology is stable across platforms:** "profile", "apps", "network", "SSH access", "build media", "target drive", "erase". No device-specific synonyms for the same thing.

## 5. Design system

8. **Tokens cover the whole system, not just color.** Spacing, radius, type scale, control height, focus ring, and semantic colors (success/warning/destructive) are tokens. New raw values (hex, px) outside the token file are prohibited — add a token first. (Today only colors are tokenized; `--mut` is referenced but undefined — fix.)
9. **Shared CSS classes alone do not satisfy consistency** — behavior must come from the shared component (§2). Matching `.cz-*` styling with re-implemented behavior is a finding, not parity.
10. **Accessibility is part of component parity.** Shared controls carry consistent labels, focus order, `aria` state, and error association. A control isn't "done" on a second device until its a11y matches the first.

---

## Definition of done — the cross-device UX check

A user-facing change is not complete until:

- [ ] The task uses the **shared component(s)** from §2 — no hand-built duplicate.
- [ ] The **same task** renders the **same layout/labels/states** on every device that supports it.
- [ ] Capability differences are **disabled-in-place with a reason**, not a new screen/flow/widget.
- [ ] The feature was **reviewed side-by-side on ROG and Deck** (the same task, both devices) — including a profile round-trip and, for media, a completion panel.
- [ ] All four async states exist; destructive actions confirm and name the target.
- [ ] No new device-prefixed route/view for a shared task.

> "A feature is not complete until cross-device UX is reviewed side by side." If you can't put the two devices' screens next to each other and see the same experience, it isn't done.

---

*Synthesized from independent Opus + Gemini + Codex reviews (see [cohesion-findings.md](cohesion-findings.md) for provenance and evidence). Pairs with [coding-standards.md](coding-standards.md).*
