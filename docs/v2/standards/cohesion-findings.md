---
description: Multi-model review of bootible's cross-device cohesion — what diverged between the ROG and Deck paths, why, and the prioritized backlog to converge them.
tags: [review, cohesion, architecture, ui-ux, findings, standards]
audience: { human: 55, agent: 45 }
purpose: { findings: 70, research: 20, plan: 10 }
---

# Cohesion review — findings & remediation backlog

**The verdict, in one line:** the code works, but Steam Deck support was built *beside* the ROG/Windows path, not *through* it — so the app now carries two domain models, two profile adapters, three USB writers, and parallel UI for the same tasks. This document is the evidence base for [coding-standards.md](coding-standards.md) and [ui-ux-standards.md](ui-ux-standards.md).

> **Provenance.** Independent reviews by **Opus** (in-repo), **Gemini 2.x** (`gemini --approval-mode plan`), and **Codex** (`codex exec -s read-only`), run against the real tree on `docs/v2`, then synthesized with engineering judgment. **Grok was requested but its headless CLI (`grok -p`) is single-turn and never ran the multi-step exploration; its agent modes need a WS-relay client. No usable Grok report — a gap to close if its CLI gains a proper headless report mode.** Raw model outputs: `.review/gemini.md`, `.review/codex.md`.

The three perspectives converged hard — that agreement is the signal. Below, findings are merged and de-duplicated; `file:line` citations were surfaced by the models and should be re-confirmed before acting (line numbers drift).

---

## The root cause

Two provisioning architectures wear one product's skin:

| Concern | ROG / Windows | Steam Deck | Problem |
|---|---|---|---|
| Config model | module catalog → untyped `settings` bag (`Record<string,unknown>`) | one strongly-typed `DeckConfig` object | two paradigms for one idea |
| Device seam | `DeviceProfile` (`profiles.ts`) | **bypassed** via `usesDeckCarrier` / `CARRIER_OSES` | the "universal" seam isn't universal |
| Build output | module executor | generated bash script | every shared feature wired twice |
| Where intent is assembled | renderer + main (snake_case `settings`) | renderer (`deckState`) | core can't validate either |

`DeviceProfile`'s own comment claims a "generic provisioning flow" and "device-agnostic UI" — but only `rog-ally` is registered and SteamOS is explicitly exempted. **The comment describes the intended architecture, not the actual one.** That gap is the whole problem in miniature.

---

## Part 1 — Code & architecture findings

Severity reflects leverage (how much converges if fixed), not breakage.

### High

- **A1 · Two parallel provisioning paradigms.** ROG uses `DeviceProfile` + module-catalog + `settings`; Deck uses `DeckConfig` + `generateDeckProvision`. Deck never enters the `DeviceProfile` seam. → Replace with one **adapter contract** both devices register against; share selection, validation, profiles, review, and media orchestration. Keep the per-device *generators* (bash vs module executor) behind it. *(all three)*
- **A2 · `renderer/src/main.ts` is a ~4,000-line application kernel.** It owns routing, state, IPC, DOM rendering, profile persistence, media workflows, and cloud auth. Not reviewable or testable. → Decompose into `app/router`, `state/`, `components/`, `features/{profiles,apps,network,access,media}/`, `devices/{rog,deck}/`. *(all three)*
- **A3 · Business logic lives in the renderer/main, not core.** SSH keys, static IP, remote-access, module resolution, and the camelCase→snake_case `settings` translation are assembled in the renderer (`main.ts` ~1980) and main (`index.ts` ~717/743). Core can't reproduce or validate a build. → Renderer submits a typed config; **core** normalizes, validates, resolves modules, and produces the plan; **main** does privileged I/O only. *(Codex, Gemini)*
- **A4 · Type mirrors across renderer / preload / main.** `UsbBuildRequest`, `DeckProvisionUsbRequest`, `BootibleApi`, and per-device request shapes are redeclared in each layer and drift silently across the package boundary. → One shared IPC-contracts module (channel names + request/result/progress types); validate at the boundary. *(Codex)*
- **A5 · Profiles persist an unversioned, unvalidated UI dump.** `Profile.ui` is `Record<string,unknown>`; ROG serializes DOM concepts (`sshMode`, element-derived fields), Deck JSON-clones the whole `deckState` and restores with shallow `Object.assign` (so a stale nested object can replace current defaults); untagged profiles are offered to either device. → Versioned domain type `{ schemaVersion, deviceFamily, config, secrets }`, validated + migrated in core; never persist DOM state; filter by device family. *(Codex; partly self-inflicted — see note)*

### Medium

- **A6 · Catalog is unified, but its view-models and pickers are not.** Good: `apps.ts` + `deck-apps.ts` both derive from `catalog.ts`. Bad: they project into separate `AppEntry` vs `FlatpakApp` types and feed two hand-written grouped-picker renderers. → One `InstallableAppView` + one picker component. *(all three)*
- **A7 · Deck defaults duplicated outside core.** `DEFAULT_DECK_CONFIG` (`deck-config.ts`) is re-created in the renderer (~2411), so core and UI can disagree. → Import normalized defaults from core; the renderer defines presentation defaults only. *(Codex)*
- **A8 · Config is feature-shaped on Deck, execution-shaped on ROG.** `DeckConfig` exposes `ssh`/`sunshine`/`passwordManagers` (good); ROG emits module IDs + an open `settings` bag. → Define **shared feature configs** (apps, network, ssh, streaming) and compose device configs from them; module IDs and shell are generated implementation details. *(Codex, Gemini)*

### Low

- **A9 · Naming exposes implementation, not product concepts:** `usesDeckCarrier`, `deckwrite`, `deckreimage`, generic `settings`. → Name seams by task (`ProvisioningConfig`, `MediaMode`, `NetworkConfig`); keep `deck`/`windows` inside adapters. *(Codex)*
- **A10 · Comments overstate cohesion** ("device-agnostic UI", "single source of truth" on renderer-local state). → Comments must describe current guarantees. *(Codex)*

### Bugs surfaced by the review (fix now, independent of the refactor)

- **B1 · Static-IP regex accepts invalid octets.** `static-ip.ts` `IPV4` matches `999.999.999.999`; invalid gateway/DNS are silently dropped, turning a typo into a *different* valid-looking config. → Validate octets 0–255 + return structured errors instead of silent drop. *(Codex)* — **introduced in the static-IP work.**
- **B2 · Deck app count is misleading.** The general Deck picker excludes emulators/streaming, but the header count uses all `flatpakApps` — "5 apps selected" with fewer than 5 on screen. → Count from the visible dataset. *(Codex)* — **introduced in the streaming/emulator split.**

---

## Part 2 — UI/UX & shared-component findings

The test: *does the same conceptual task feel the same on every device?* Today, mostly no.

### High

- **U1 · Profiles save/load is visibly different per device.** ROG: profile rows on the base screen, save buried in the strip-kit screen with explicit Update / Save-as + status. Deck: a select + Load/Delete/name/Save toolbar at the top of the config screen, silent overwrite, no status. **The clearest "same task ≠ same experience" violation.** → One `ProfileBar`, same location and actions on every device. *(Codex; self-inflicted — I added the Deck bar without reconciling it with ROG.)*
- **U2 · Static IP: one domain object, two forms.** ROG shows address + interface and silently infers prefix/gateway/DNS; Deck shows a toggle + all five fields. → One `NetworkSettings` component, DHCP default, capability-gated fields. **(Judgment: ROG's inference is deliberate — the project's first principle is "minimize typing." Reconcile by showing the *same* component everywhere with inferred values surfaced read-only/expandable, not by forcing five manual fields on ROG.)** *(Codex, Gemini)*
- **U3 · SSH setup differs materially.** ROG: BYO/GitHub/Both tabs, host-key discovery, paste, fetch. Deck: server toggle + raw textarea + separate GitHub username. → One `SshAccessEditor` (enable, port, keys, paste, GitHub import, resulting-key preview); hide only genuinely unsupported capabilities. *(Codex)*
- **U4 · Building media is three experiences.** `usbwrite` (Windows), `deckwrite` (Deck provision), `deckreimage` (Deck reimage) — disk pick / confirm / progress copy-pasted; the two Deck disk renderers are near-duplicates. → One media-builder shell: outcome → source → target → review destructive action → confirm erase → write w/ progress → device-specific next steps. *(all three)*
- **U5 · Streaming information architecture differs.** ROG groups Sunshine/Moonlight/RDP + creds under "Remote access"; Deck splits "Game streaming" from "Remote access" with dynamic rows. → Role-based labels ("Stream from this device" / "Play streams here" / "Also install on this computer"); SSH/RDP/VNC live under access, not streaming. *(Codex; partly self-inflicted — I just split these on Deck.)*

### Medium

- **U6 · The app picker is copied, not shared.** ROG (`main.ts` ~995) and Deck (~3049) both hand-build `<details>`, group checkboxes, counts, rows, selection sets; Deck has its own `deckItemRow`. → One `GroupedPicker<T>` (grouping, group-select/indeterminate, search, count, logos, empty/loading/error, optional detail expansion). *(all three)*
- **U7 · Counts must describe visible scope** (see B2). *(Codex)*
- **U8 · Error handling is inconsistent and often swallowed.** ROG catalog failure → empty UI with no message; profile-list and disk-enumeration errors swallowed; Deck app-load *does* show an error. → Every async surface: loading / populated / empty / error-with-retry. Never turn an exception into "nothing exists." *(Codex)*
- **U9 · "Components" are CSS classes without shared behavior.** `.btn-primary`, `.app-row`, `.cz-*` exist, and Deck explicitly borrows ROG's `.cz-*`, but every screen rebuilds the behavior. → Real renderer primitives: `Button`, `Field`, `ToggleRow`, `Section`, `PickerRow`, `DiskPicker`, `ProgressPanel`, `StatusMessage`. *(Codex)*
- **U10 · Flow diverges after device pick.** ROG → `base` ("pick your base"); Deck → `deck` ("configure your Deck"); summary rails and progression differ. → Same wizard progression for all devices; differences are capability-gating, not new screens. *(Gemini, Codex)*

### Low

- **U11 · Design tokens cover colors only.** Spacing, radius, type scale, and states are literal throughout; raw colors recur; there's a fallback to an undefined `--mut`. → Tokenize spacing/radii/typography/control-height/focus/semantic colors; ban new raw values. *(Codex)*

---

## Self-inflicted subset (this session's work)

Owning it plainly — several findings are mine, from exactly the "shove it where it's nearest" pattern this review exists to stop:

- **U1** — added a Deck profile bar (toolbar, top of screen) without matching ROG's profile UX.
- **U5** — split "Game streaming" / "Remote access" on Deck while ROG keeps one "Remote access".
- **U2** — gave Deck a Network section with five fields; "backported" ROG as a dropdown beside one input and called it parity.
- **B1/B2** — the static-IP octet regex and the Deck app count.

These are the cheapest wins and the proof the standards are needed.

---

## Remediation backlog (prioritized, incremental — not a big-bang rewrite)

> The renderer is one 4,000-line file; do **not** stop the world to refactor it. Pay the debt down behind each new feature. Order by leverage × safety.

**P0 — correctness, do immediately**
1. Fix B1 (IPv4 octet validation + structured errors).
2. Fix B2 (count from visible dataset).

**P1 — converge the experiences users notice (extract the shared component as you go)**
3. `NetworkSettings` component → use on both devices (closes U2).
4. `ProfileBar` component, same place + actions on both (closes U1).
5. `GroupedPicker<T>` → replace both app pickers (closes U6, A6 view-model split).
6. `SshAccessEditor` (closes U3).
7. Media-builder shell + writer strategies (closes U4).
8. Streaming role-based IA, shared with ROG (closes U5).

**P2 — converge the architecture under the components**
9. Shared IPC-contracts module; delete type mirrors; validate at boundary (A4).
10. Versioned, validated `SavedProfile` in core; stop persisting DOM (A5).
11. Move config normalization/validation/plan into core; renderer submits typed config (A3, A8).
12. One adapter contract; register ROG + Deck; retire `usesCarrier` exceptions (A1).

**P3 — hygiene**
13. Renderer defaults import from core (A7); rename implementation-leaking seams (A9); full token system (U11); fix overstated comments (A10).

Each P1 item is a vertical slice: build the shared component, adopt it on **both** devices in the same PR, delete the two old implementations. That is how the file shrinks without a rewrite.
