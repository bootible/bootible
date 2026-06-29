---
description: Enforceable coding standards for bootible — keep the ROG and Deck paths converging, not diverging. Grounded in the multi-model cohesion review.
tags: [standards, coding, architecture, conventions]
audience: { human: 40, agent: 60 }
purpose: { reference: 60, process: 40 }
---

# Coding standards — bootible

These are rules, not suggestions. They exist because the codebase grew two parallel device paths (see [cohesion-findings.md](cohesion-findings.md)); every rule below stops a specific way that happened. When a rule and a deadline conflict, raise it — don't quietly break the rule.

**The one principle behind all of them:** *a new device or feature is added by composing existing seams, never by forking a new parallel path.* Before writing code, find where the concept already lives. If it lives in two places, that's a bug to fix, not a pattern to extend.

---

## 1. Architecture & layering

1. **One device seam.** Every supported device registers a single provisioning adapter. No `usesDeckCarrier`-style branch, OS-string check, or route name may decide whether a device is "buildable" or which architecture it uses. New `if (os === "…")` in shared paths is prohibited — push the difference into the adapter.
2. **Core owns intent; main owns I/O; renderer owns presentation.**
   - **Core** (`packages/core`): normalize, validate, resolve modules/capabilities, produce the plan and the media payload. Pure and testable.
   - **Main** (`src/main`): privileged I/O only (disk, elevation, network, filesystem). No business rules.
   - **Renderer**: collect typed feature state and paint. It may **not** construct provisioning requests, resolve modules, or emit `settings`/snake_case/command args.
3. **Generators consume normalized config only.** `generateDeckProvision`, the module executor, bundle builders — they receive a validated config from core and never re-interpret partial UI input or invent defaults.
4. **No new open `settings` bags.** Configuration is a discriminated/typed shape. `Record<string, unknown>` for config is prohibited; migrate existing bags toward typed feature configs.

## 2. Shared types & the IPC boundary

5. **One source for every cross-layer type.** IPC channel names and request/result/progress types live in one shared module imported by main, preload, and renderer. **Do not re-declare a type that already exists in another layer** — type mirrors drift silently across the package boundary and the compiler won't catch it.
6. **Validate all external data at entry.** IPC requests, saved profiles, cloud profiles, plugin-store responses, and partial configs are validated before use — at the boundary, in core.
7. **Shared concepts use shared types.** Apps, SSH, static IP, streaming, media targets must not have separate `Deck*` and ROG shapes unless a documented capability difference requires it. Prefer shared feature types with per-device capability extensions. (`StaticIp` in `static-ip.ts` is the model to copy.)

## 3. Single source of truth

8. **Defaults exist once, in core.** The renderer imports normalized defaults; it may define *presentation* defaults only. A default duplicated in the renderer is a guaranteed future divergence.
9. **Catalog data has stable IDs independent of installer tech.** Winget IDs, Flatpak refs, and module IDs are adapter metadata hanging off a stable `id`. Derived views (`apps.ts`, `deck-apps.ts`) share projection utilities — no copy-pasted mapping.
10. **Persisted objects are versioned domain objects.** Every saved profile carries `schemaVersion` + `deviceFamily` + typed `config` + `secrets`, with a migration path. **Never persist DOM/UI state** (selector values, route names, expanded groups, ad-hoc sets). Filter persisted objects by device family before offering them.

## 4. File & module discipline

11. **One feature per renderer module.** A renderer source file over ~400 lines needs an explicit architectural reason in the PR. `main.ts` is the cautionary tale — decompose toward `app/`, `state/`, `components/`, `features/`, `devices/`; don't add to the monolith.
12. **A reusable component owns behavior, not just a CSS class.** If two screens build the same widget by hand, extract a real primitive (see [ui-ux-standards.md](ui-ux-standards.md) §components). Matching `.cz-*` classes is not reuse.

## 5. Error handling

13. **No silent catches in user workflows.** A caught recoverable error must surface a visible, retryable state; otherwise rethrow. Never convert an exception into "nothing exists" (empty list with no message).

## 6. Safety & generated scripts (existing rules, reaffirmed)

14. **Shell/PowerShell injection-safe by construction.** User-supplied values embedded in generated `bash`/`.ps1` are escaped (single-quote escaping for bash, validated allowlists for identifiers) — never interpolated raw. Validate-and-drop is **not** enough on its own: a dropped value must be a visible error, not a silent config change.
15. **Validation means validation.** A regex or guard must actually reject bad input (octets 0–255, not `\d{1,3}`). If a validator's comment promises a guarantee, the code must deliver it.
16. **Verify generated artifacts on the real interpreter.** `.ps1` parses under Windows PowerShell 5.1; generated `bash` passes `bash -n`. (See repo memory: PS 5.1, not pwsh 7.)

## 7. Testing

17. **Cross-device contract tests are mandatory for shared features.** For every shared feature (apps, network, SSH, profiles, media), run the *same* behavior suite against both ROG and Deck: normalization, validation, and profile round-trip.
18. **Fix the code, not the test.** (Repo rule.) Tests encode intended behavior; make the implementation satisfy them.

---

## Definition of done (a change isn't finished until)

- [ ] The concept lives in **one** place (no new parallel ROG/Deck path; no duplicated type/default).
- [ ] Business logic is in **core**, not the renderer or main.
- [ ] Any cross-layer type comes from the **shared** contracts module; nothing re-declared.
- [ ] New config is **typed**, validated at the boundary, with versioned persistence if saved.
- [ ] Shared features have **cross-device contract tests**; generated scripts are interpreter-verified.
- [ ] No file grew past ~400 lines without justification; no silent catch added.
- [ ] If the change touches a user-facing task, it satisfies the **cross-device UX check** in [ui-ux-standards.md](ui-ux-standards.md).

---

*Synthesized from independent Opus + Gemini + Codex reviews (see [cohesion-findings.md](cohesion-findings.md) for provenance and evidence).*
