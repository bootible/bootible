---
description: Unified multi-model code review of bootible v2 against the standards, and the agreed remediation + refactor plan. Reviewed by humans, executed by agents.
tags: [review, remediation, plan, standards, cohesion, security]
audience: { human: 45, agent: 55 }
purpose: { plan: 70, findings: 30 }
---

# bootible v2 — unified review & remediation plan

## Method & confidence

A holistic review of `packages/app` + `packages/core` against [coding-standards.md](coding-standards.md), [ui-ux-standards.md](ui-ux-standards.md) and [cohesion-findings.md](cohesion-findings.md), from **four independent reviewers**:

- **Opus** — a dedicated disconnected review agent (in-repo, evidence-verified).
- **Gemini** (`gemini-3-pro-preview`) and **Grok** (`grok-build`) — read-only, repo-exploring CLIs.
- **Codex** (`gpt-5.5`, xhigh) — **failed to emit output** (explored the repo but produced an empty result); excluded. The other three converged hard, so confidence stays high.

Every **P0** below was re-confirmed against the actual source, not taken on a model's word. The architectural findings were independently reported by all three working reviewers — that agreement is the signal. `file:line` citations drift in a 4,000-line file; re-confirm at fix time.

**Verdict: REQUEST CHANGES** (P0 security/correctness) — but the convergence work already done is real and substantial.

**One-line assessment:** the *UI* converged; the *architecture* didn't. Seven tested shared components were genuinely built and adopted on both ROG and Deck — but underneath, ROG (`settings` bag + modules) and Deck (`DeckConfig` + bash generator) are still two engines wearing one skin, and the Deck bash generator is the seam where that skin cracks into a shell-injection class the ROG path is structurally immune to. The god-files **grew** (`main.ts` is 4,022 lines), because new Deck screens were appended faster than old code retired.

---

## Already done — do not redo

Credited by the Opus reviewer against the original cohesion backlog; verified present:

- **Static-IP octet validation** — `core/src/static-ip.ts` uses a real `0–255` regex + structured `validateStaticIp` (no silent drop into a different valid config).
- **Deck app count** — uses `countSelectedInView` against the visible dataset.
- **`NetworkSettings`, `SshAccessEditor`, `StreamingSettings`, `RemoteAccessSettings`, `PasswordField`, `ProfileBar`** built, tested, and adopted on **both** devices; the old `ra-*` rows / Deck 5-field form / SSH tabs deleted.
- **App picker converged** — `renderApps` and `renderDeckApps` are now thin wrappers that both call **`GroupedPicker`**; the old hand-built rows are gone. (Gemini/Grok claims that these are still hand-built are **stale** — adjudicated against current code.)
- **Profile versioning** — `schemaVersion` + `deviceFamily` + family filtering + `migrateProfile` exist; **device class vs instance** (`deviceModel` vs `instanceId`) cleanly separated (coding-standard 10b).
- **IPC contracts partially centralized** — `core/src/app-ipc.ts` holds the major request payloads.

---

## P0 — security & correctness (ship independently, now)

> **Status:** the three security P0s are **shipped** — Deck script injection (`46b4187`), cloud plaintext fail-closed (`f3e5588`), elevated-PS drive/disk guards (`2f45158`). The silent-catch sweep is **deferred to P1** (it wants the shared `StatusMessage`/`ProgressPanel` — do it once, properly). Outstanding here: the `locale`/`uiLanguage` xmlEscape consistency fix (low-risk, catalog-sourced) and the ssh-port/IPC validation moving into core (P2 #5).

### Shell injection in the generated Deck `provision.sh` — `core/src/deck-provision.ts`
A `shq()` escaper exists and is used for sunshine/network/beacon args, but **three** user-controlled values bypass it into expansion-active `bash` that runs under `sudo`. Values arrive from free-text UI **and from imported / cloud-synced profiles**, so "the UI validates it" is not a defence. Violates coding-standard #14.

- **`:413-414` — hostname (VERIFIED real).** `say "Setting hostname ${cfg.hostname}"` interpolates raw into a double-quoted string; `hostnamectl set-hostname ${JSON.stringify(cfg.hostname)}` is also double-quoted, where `$()`/backticks stay live. `normalizeDeckConfig` only `.trim()`s the hostname. → Sanitize to RFC-1123 (`[A-Za-z0-9-]`, ≤63) in `deck-config.ts`, drop-with-visible-error, and `shq()` the `say` line.
- **`:147` — Decky plugin names (VERIFIED real).** `n.replace(/"/g, '\\"')` escapes only `"`, not `$` / backtick / `\`. A plugin name with `$(…)` injects. → Route through `shq()` or pass via a quoted heredoc/argv.
- **`:88-93` — `ssh.port` (real).** Interpolated raw into `sed`/`echo`. Typed `number`, but a profile loaded from untyped JSON can carry anything. → Validate as int 1–65535 in `deck-config.ts:106`, drop-with-visible-error.

Also **audit the Windows generators** for the same class while here: `locale` / `uiLanguage` / `computerName` interpolation in `core/src/autounattend.ts` and `bootstrap.ts` (mostly `xmlEscape`/`psQuote`'d — confirm none slip through).

> **Adjudicated FALSE POSITIVES:** `${ghUser}` at `:120-121` (Gemini + Grok) is **not** injectable — `normalizeDeckConfig` strips it to `[A-Za-z0-9-]`. The sunshine `"$_sunpass"` at `:223` (a sub-audit flag) is also safe — a double-quoted variable expansion isn't re-parsed. No change beyond a clarifying comment.

### Plaintext at-rest fallback for cloud secrets — `app/src/main/cloud.ts` (VERIFIED real)
`saveToken` (`:34-38`) and the E2E DEK writer (`:78-82`) fall back to writing **plaintext** when `safeStorage.isEncryptionAvailable()` is false — silently defeating "encrypted at rest." → **Fail closed:** refuse to persist (or require encryption) rather than write the bearer token / DEK in the clear.

### No runtime validation at the IPC trust boundary before elevated PowerShell — `app/src/main/index.ts`
`req.diskNumber` (`:962`), the deck writers (`:1136`), and `req.account.mode`/`username` (`:840-841`) flow unchecked into **elevated** PowerShell. TS types are not runtime guarantees. → Validate/normalize at the boundary in core (coding-standard #6).

### Silent catches that report failure as "nothing exists" — ~30 sites
`catch {}` / `catch { return }` turn catalog/network/disk failures into empty UI with no message or retry (e.g. `main.ts` catalog `~1502`, provision `~1797`, disk enum `~3028`/`~3171`, `listUsbDisks`, `getHostSshKeys`). Coding-standard #13 / UI §4. → loading / populated / empty / error-with-retry on every async surface. (Best-effort cleanup catches — e.g. the beacon's — are fine; scope this to user workflows.)

---

## P1 — finish the user-visible convergence (~30% left)

Each item is a **vertical slice**: build the shared component, adopt it on both devices, delete *both* old implementations in the same change. This is also how `main.ts` finally shrinks (see sequencing rule).

1. **Media building is still three screens** (`usbwrite` / `deckwrite` / `deckreimage` + two near-duplicate Deck disk renderers). → Build the three missing components — **`DiskPicker`, `ProgressPanel`, `StatusMessage`** — and one media-builder shell; delete the writers. (UI U4.)
2. **Profile capture/apply still forked (~140 lines)** under the shared `ProfileBar` — ROG reads/writes DOM inputs (`main.ts:~1922-2034`), Deck JSON-clones `deckState`. → One typed config round-trip; stop persisting DOM state. (Closes the rest of coding-standard #10.)
3. **`removalsSection` hand-builds a grouped picker** (`main.ts:~675-714`) that `GroupedPicker` already does; parallel `.cz-*` helper families remain (`section`/`deckSection`, `pickerRow`/`deckPickerRow`, `customiseRow`/`deckCheck`). → Adopt `GroupedPicker`; extract `Section` / `ToggleRow` / `Field`.

---

## P2 — converge the architecture under the components (the deferred core work)

4. **Retire the parallel device seam.** `CARRIER_OSES` / `usesDeckCarrierOs` (`main.ts:~1279-1284`) and the `deck*` route family (`deckapps` / `deckpm` / `deckwrite` / `deckreimage` / `decksetup` / `deckemu` / `deckplugins`, `main.ts:~239-274`) still drive the flow. **The capability model was built in `core/src/device-capabilities.ts` but is completely unused by the app — the keystone mechanism is dead code** (all three reviewers agree; 0 renderer references). → Wire one adapter/capability registry; routes name tasks, not devices. (Coding #1/#1b, UI §1.)
5. **Move business logic into core.** `resolveModules` + snake_case `buildSettings` (`main/index.ts:~660-701`) and `gatherUsbRequest`'s SSH/static-IP/streaming assembly (`main.ts:~1849-1906`) belong in a `core.buildProvisioningPlan(request)`; renderer submits typed config, main does I/O only. (Coding #2/#3.)
6. **Unify the two config models** — shared feature configs, one app-view type, defaults imported from core. **Live drift, verified:** `main.ts:2254` hardcodes `RECOMMENDED_DECKY = ["PowerTools", "ProtonDB Badges", "SteamGridDB"]` while `core`'s `DEFAULT_DECK_CONFIG` uses `RECOMMENDED_DECKY_PLUGINS` (`deck-apps.ts`) — two default lists that can already disagree, exactly the divergence coding-standard #8 forbids. Import defaults from core; delete the `deckState` re-creation of `DEFAULT_DECK_CONFIG`. (Coding #4/#7/#8.)
7. **Finish the IPC contract** — `BootibleApi` is still hand-mirrored (preload `typeof` vs renderer `interface` `main.ts:~130-231`); `StaticIp` is re-declared in `components/NetworkSettings.ts`; ~64 channel-name literals + several `Deck*Req` aliases are duplicated. → Share all from `app-ipc.ts`. (Coding #5.)

---

## P3 — hygiene

8. **Decompose the god-files behind each P1/P2 slice** — carve `main.ts` / `main/index.ts` into `app/` / `state/` / `components/` / `features/` (TODO #6).
   - **Progress:** the Deck flow is **extracted** to `features/deck.ts` (a clean pure move; `main.ts` 4022 → 3035, −987 lines), enabled by a new shared `lib/session.ts`. `StatusMessage` + `DiskPicker` components built and adopted (the three hand-built disk renderers → one).
   - **Blocker for the rest:** the remaining `main.ts` bulk (welcome/sync-key/2FA **auth**, the ROG **account/customise/apps** flow, the **strip kit**) all couple to the shared **router** (`syncFromHash`) and **request-builder** (`gatherUsbRequest`) — so a naive extraction is circular. **Next step:** extract `syncFromHash`/the router into `lib/router.ts` and `gatherUsbRequest` into `features/rog/`, *then* the auth + ROG + strip-kit blocks move freely. `features/deck.ts` (965 lines) also still wants sub-splitting into `deck/{state,setup,pickers,profile,media}.ts`. Both files carry a recorded-reason header.
9. **Define `--mut`** — referenced but **never defined** in `styles.css` (latent bug); finish the design-token system (spacing/radius/type/control-height/focus/semantic) and ban raw values.
10. **Gate the orphan USB / "device connected" indicator** behind a `usb-connection` capability (UI "every element earns its place").
11. **Remove dead handlers** (e.g. stray `data-keyId`) and fix the fragile `tailscaleBlock` JS line-continuation (`deck-provision.ts:~246`).
12. **Cross-device contract tests** for the shared features (profile round-trip, app-count, network validation, media write) run against both families in one suite (coding #17); run generated scripts through `bash -n` + a documented PS 5.1 parse in CI (coding #16).
13. **Clean ~72 stray `*.ts.tmp.*` files** under `packages/` (e.g. `main/index.ts.tmp.128852.*` — editor/tool scratch) and ensure the pattern is git-ignored. `PasswordField` is *not* an orphan (Opus flagged it as unimported) — it's used transitively via `StreamingSettings`; leave it.

---

## Sequencing rule

Don't stop the world to refactor the god-file. **P0 is independent — ship it now.** Then each P1/P2 item is a vertical slice (build the shared component → adopt on both devices → delete both old implementations in the same change). The god-file shrinks as a *consequence* of the slices, not as a separate project.

---

## Provenance

Synthesized from a dedicated Opus review agent + independent Gemini and Grok CLI reviews (read-only, repo-exploring), adjudicated against the source by the orchestrating session. Codex (`gpt-5.5`) failed to emit and was excluded. Raw reviewer outputs are under `.codereview/` (git-ignored). To execute, walk this plan change-by-change with the `review-responder` skill, starting with P0.
