---
description: What is true today about bootible profiles, secrets, and the codebase that cloud account + profile sync must build on.
tags: [cloud, sync, auth, profiles, findings]
audience: { human: 50, agent: 50 }
purpose: { findings: 100, north-star: 0, gestalt: 0, reference: 0, research: 0, design: 0, plan: 0, flow: 0, concepts: 0, high-agency-process: 0, low-agency-process: 0 }
---

# Cloud Sync & Auth — Findings

**Question**: What exists today that an optional cloud account + profile-sync feature builds on, and what constraints does it impose?

---

**Finding**: bootible already has a complete **local** profile system (capture/save/load/delete) producing portable JSON, so cloud sync is "ship the JSON somewhere keyed to an account." But there is **no backend, no auth, and no account** yet — and the one hard constraint is that profile **secrets are encrypted with Windows DPAPI, which is machine-bound and therefore not portable**. Syncing the encrypted secret blob verbatim would produce something the next machine cannot decrypt. The design must re-encrypt secrets with an account-derived key (or exclude them from sync).

---

## Evidence

### Profiles are local, structured, and portable (except secrets)

Profiles live per-user on disk and round-trip the full UI selection plus encrypted secrets.

| Aspect | Detail |
|--------|--------|
| Location | `%APPDATA%\@bootible\app\profiles\<name>.json` (`app.getPath("userData")/profiles`) |
| Public shape | `ProfileSummary { name, deviceId?, baseId?, savedAt? }` |
| Full shape | `Profile { ...summary, ui: Record<string,unknown>, secretsEnc: string }` |
| `ui` | Captured UI state: selected apps, emulators, removals, SSH mode, hostname, wallpaper paths, remote-access toggles, etc. Plain JSON. |
| Secrets | Sunshine password (and similar) — encrypted, never plaintext on disk |
| Operations | `saveProfile` / `loadProfile` / `listProfiles` / `deleteProfile` over IPC |

> `packages/app/src/main/index.ts` (`profilesDir`, `saveProfile`, `loadProfile`) — local profile store
> `packages/app/src/preload/index.ts` — `ProfileSummary` / `Profile` types + IPC surface

### CRITICAL: secrets use DPAPI, which does not survive a machine change

Secrets are encrypted with Electron `safeStorage`, which on Windows is **DPAPI** — keyed to the OS user/machine. A blob encrypted on machine A cannot be decrypted on machine B.

```
secretsEnc = safeStorage.encryptString(JSON.stringify(secrets)).toString("base64")   // save
secrets = JSON.parse(safeStorage.decryptString(Buffer.from(j.secretsEnc, "base64"))) // load
```

> `packages/app/src/main/index.ts:780-824` — DPAPI encrypt/decrypt of `secretsEnc`

Implication for sync: **`secretsEnc` is not cloud-portable.** Options the design must choose between: (a) re-encrypt secrets client-side with a key derived from the account/passphrase before upload (end-to-end, server never sees plaintext), or (b) sync only the non-secret `ui` and re-prompt for secrets per machine, or (c) server-side encryption (server can see plaintext — weakest).

### No backend, auth, or account exists

The monorepo is `packages/{app, core, cli, site}`. `site` is the website; `core` holds generation logic; there is **no** auth, Worker, D1, OAuth, or sync code.

> `ls packages/` → app, core, cli, site
> `grep better-auth|cloudflare|wrangler|d1|oauth` → no backend matches (only the local profile store + brand assets in `cloudflare/`)

`packages/core/src/sync-target.ts` exists but is the v1 concept of pushing a config to a git/target device — **unrelated** to cloud accounts.

### bootible.dev is intended but unverified here

`bootible.dev` is referenced as the product domain across docs. Its registration and which Cloudflare account owns it is **not verifiable from the repo** — confirmed out-of-band as being set up on a dedicated Cloudflare account.

> `docs/ai-context/*`, `docs/v1/architecture.md` — reference `bootible.dev`

### The app is offline-first

bootible's job is building USB sticks / prepping devices, often without guaranteed connectivity. Cloud must therefore be **strictly optional** — every existing flow works with no account and no network.

> Established product constraint (CLAUDE.md "one command" ethos; local-first profiles) — 👤 confirmed by owner

---

## Decided constraints (owner, this engagement)

These are inputs to the north star, recorded here so the chain traces to a source.

- Auth: **better-auth on Cloudflare Workers + D1**.
- v1 providers: **Google, GitHub, Discord, Twitch, email+password, passkeys** (all better-auth built-ins).
- **Steam parked**; **Xbox** infeasible-as-simple-OAuth; **PSN** has no public login API.
- v1 cloud MVP: **account + profile cloud-sync only** (no sharing / public library yet).
- Sign-in is **optional**; the desktop app keeps working fully without it.

---

## Gaps / uncertainties

- **STUB** — bootible.dev DNS/zone ownership and the dedicated Cloudflare account are being set up; not yet verifiable.
- **STUB** — whether profiles should sync silently in the background or on explicit user action is undecided (north-star / flow question).
- macOS/Linux `safeStorage` backends differ (Keychain / libsecret) — same portability limitation applies; bootible is Windows-only today so out of scope, but the chosen secret scheme should not assume DPAPI.
