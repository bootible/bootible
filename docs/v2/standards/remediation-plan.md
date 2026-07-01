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

**One-line assessment:** the *UI* converged; the *architecture* didn't. Seven tested shared components were genuinely built and adopted on both ROG and Deck — but underneath, ROG (`settings` bag + modules) and Deck (`DeckConfig` + bash generator) are still two engines wearing one skin, and the Deck bash generator is the seam where that skin cracks into a shell-injection class the ROG path is structurally immune to. The god-files had **grown** (`main.ts` hit 4,022 lines), because new Deck screens were appended faster than old code retired — since decomposed (P3): `main.ts` is now a 341-line app shell.

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

> **Status:** the three security P0s are **shipped** — Deck script injection (`46b4187`), cloud plaintext fail-closed (`f3e5588`), elevated-PS drive/disk guards (`2f45158`). **Now also closed:** `locale`/`uiLanguage` xmlEscape in the autounattend generator (`cc9114a`, bootstrap.ts audited clean); the silent-catch sweep on the blank-screen card surfaces — device picker / setup catalog / customise plan now show StatusMessage + retry (`80ebe14`). Residual silent catches (language/region `<select>`s, main-process disk enum — a different widget shape) tracked as task #18. IPC runtime validation before elevated PowerShell moves into core with P2 #5.

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

1. **PARTIAL — Media building convergence.** ✅ All three shared components now exist: `DiskPicker` + `StatusMessage` (earlier) and **`ProgressPanel`** (`8dadb26` — `renderProgress` shared by the ROG USB writer + both Deck writers, replacing the triplicated msg/fill/pct + status→text logic). REMAINING: the single **media-builder shell** unifying the three writer *screens* — coupled to the capability media-modes, so it lands with the capability-driven flow (#16 follow-on). (UI U4.)
2. **✅ DONE (`f99902e`) — Profile capture/apply de-forked.** ROG's 7 account/clean-install fields (hostname, edition, accountMode, acctUser/Pass, wifiSsid/Pass) now live in `rog.*` as the typed source of truth; the account-screen inputs mirror state (`syncAccountInputsFromState` state→DOM on entry, an `input` listener + edition/account-mode handlers DOM→state). `captureProfile`/`applyProfile`/`gatherUsbRequest` read `rog` only — no DOM reads; a Profile is a snapshot of typed state, like the Deck's `deckState` clone. Also fixed a latent gap (accountMode was captured but never restored). Wants Gavin's visual sweep (load a profile → fields repopulate). (Closes the rest of coding-standard #10.)
3. **`removalsSection` hand-builds a grouped picker** (`main.ts:~675-714`) that `GroupedPicker` already does; parallel `.cz-*` helper families remain (`section`/`deckSection`, `pickerRow`/`deckPickerRow`, `customiseRow`/`deckCheck`). → Adopt `GroupedPicker`; extract `Section` / `ToggleRow` / `Field`.

---

## P2 — converge the architecture under the components (the deferred core work)

4. **PARTIAL — Retire the parallel device seam.** ✅ **The keystone is now LIVE (`c73b929`)** — `device-capabilities.ts` was dead (0 references); `capabilitiesFor` is now exposed on the browser surface and drives the deck-vs-Windows setup routing (media-modes → flow), with an OS-check fallback for roadmap devices. The capability keys (`rog-ally`/`steamdeck`) match the real registry IDs (verified); a test pins the media→flow contract. REMAINING: migrate the other ~12 device branches + retire the `deck*` route family so routes name tasks, not devices — an incremental migration, each step wanting an app-run check. (Coding #1/#1b, UI §1.)
5. **✅ DONE (`181f052`) — Move business logic into core.** `resolveModules` + `buildSettings` + `chosenKeys` + `RECOMMENDED_SETTINGS` + the `BuildChoice` type moved to `core/src/provisioning-plan.ts`; added `buildProvisioningPlan(req) => {modules,settings}` as the canonical entry (9 tests). main imports from core; call sites unchanged. Renderer's `gatherUsbRequest` DOM→request stays in the renderer (it *reads* the DOM); the request→plan assembly is now core. (Coding #2/#3.) The buildProvisioningPlan entry is the seam the P1 profile round-trip (#13) plugs into.
6. **✅ DONE (`57542b8`) — Unify the two config models.** Added a `@bootible/core/browser` export subpath (pure-data, Node-free) so the renderer can value-import; `deckState = structuredClone(DEFAULT_DECK_CONFIG)`, deleting the hardcoded `RECOMMENDED_DECKY`. One source, no drift; renderer build confirms no Node leak. (Broader app-view-type unification for the ROG `settings` bag is still open.) (Coding #4/#7/#8.)
7. **PARTIAL — Finish the IPC contract.** ✅ `StaticIp` de-duplicated — `components/NetworkSettings.ts` now type-imports from core (`5d9c72b`). ✅ `BootibleApi` already single-sourced to ambient `lib/bootible-api.d.ts` (P3). REMAINING (task #19): ~45 channel-name literals + `Deck*Req` aliases still duplicated between preload/main → a `CHANNELS` const in `app-ipc.ts`. Deferred because IPC has no headless test harness (a mis-mapped-but-valid channel breaks silently); needs a methodical migration + app-run smoke test. (Coding #5.)

---

## P3 — hygiene

8. **Decompose the god-files behind each P1/P2 slice** — carve `main.ts` / `main/index.ts` into `app/` / `state/` / `components/` / `features/` (TODO #6).
   - **DONE — main.ts 4022 → 341 (≈92% reduction); every renderer module now ≤400.** Carved out (each a verified pure move — typecheck + lint + build + headless render green at every step): the **Deck flow** → `features/deck/{config,setup,pickers,media}.ts` + barrel; the **auth flow** → `features/auth.ts`; the **hash router** → `lib/router.ts` (a registry so features register handlers, no cyclic import of the router); shared `lib/session.ts`, `lib/logos.ts`, `lib/dom.ts`. Then the whole **ROG flow** into `features/rog/*`, over a shared `lib/rog-state.ts` (`rog` — the ~35 cross-cutting state vars, lifted first so the screens stopped each owning a slice of a god-file's `let`s): `device` (125), `account` (193), `catalog` (275), `apps` (110), `customise` (216), `profiles` (191), `provision` (138), `usbwrite` (250, incl. `gatherUsbRequest`), `stripkit` (180), `watch` (128). Finally the `BootibleApi` IPC contract → ambient `lib/bootible-api.d.ts` (146, zero runtime). `StatusMessage` + `DiskPicker` components built and adopted (three hand-built disk renderers → one). main.ts is now a clean app shell (boot + route registry + cross-screen delegated DOM handlers).
   - **Three real bugs surfaced + fixed by the decomposition:** (a) `applyProfile` looked up `ui["rog.selectedApps"]` etc. (sed-mangled by the rog-state rename) instead of the bare keys `captureProfile` writes — a loaded profile silently restored **none** of its app/removal/extras/module/key selections; (b)+(c) two sed-corrupted user-facing strings (`"the app rog.catalog"` → `"the app catalog"`).
   - **Also done:** `features/auth.ts` (492) → `features/auth/{welcome,synckey,twofa,shared}.ts` + barrel `index.ts` (all ≤206). **Every renderer module is now ≤400 with no recorded-reason exceptions.**
9. **✅ DONE (`2465397`) — Define `--mut`** — it was referenced 4× as `var(--mut, #9aa0a8)` (only the inline fallback ever rendered); now defined once in `:root`. The full design-token system (spacing/radius/type/control-height/focus/semantic + ban raw values) is still open.
10. **Gate the orphan USB / "device connected" indicator** behind a `usb-connection` capability (UI "every element earns its place"). *(task #17, after the capability registry #16.)*
11. **✅ DONE (`a598849`) — Remove dead handlers + fix `tailscaleBlock`.** Dropped the dead `data-keyId` change handler (SshAccessEditor owns key selection); the `tailscaleBlock` trailing `\` was a JS template-literal continuation (collapsed to one line) — made it one explicit line; deck `bash -n` tests confirm it parses.
12. **Cross-device contract tests** for the shared features (profile round-trip, app-count, network validation, media write) run against both families in one suite (coding #17); run generated scripts through `bash -n` + a documented PS 5.1 parse in CI (coding #16). *(task #17.)*
13. **✅ DONE — Cleaned the stray `*.tmp.*` scratch files** (81 on disk; deleted; `*.tmp.*` already git-ignored). `PasswordField` is *not* an orphan — used transitively via `StreamingSettings`; left as-is.

---

## Sequencing rule

Don't stop the world to refactor the god-file. **P0 is independent — ship it now.** Then each P1/P2 item is a vertical slice (build the shared component → adopt on both devices → delete both old implementations in the same change). The god-file shrinks as a *consequence* of the slices, not as a separate project.

---

## Provenance

Synthesized from a dedicated Opus review agent + independent Gemini and Grok CLI reviews (read-only, repo-exploring), adjudicated against the source by the orchestrating session. Codex (`gpt-5.5`) failed to emit and was excluded. Raw reviewer outputs are under `.codereview/` (git-ignored). To execute, walk this plan change-by-change with the `review-responder` skill, starting with P0.
