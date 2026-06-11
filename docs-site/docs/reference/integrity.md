---
title: Release Channels & Integrity
description: How the bootible.dev worker pins releases and verifies checksums, how to check what you received, and where the trust boundaries honestly are
---

# Release Channels & Supply-Chain Integrity

Piping a URL into your shell is normally an act of faith: you execute whatever the server feels like sending at that moment. This page documents why Bootible's one-liner is a narrower bet than that, exactly what is verified where, and — just as importantly — what is *not*. Verified against the source: `cloudflare/_worker.js` and `docs/releasing.md`.

---

## Why this `irm | iex` is different

`bootible.dev/rog`, `/deck`, and `/android` are served by a Cloudflare Pages worker (`cloudflare/_worker.js` — public, auditable). The worker does not pass through whatever is on GitHub right now. On every request it:

1. **Fetches a pinned ref.** Stable routes serve `STABLE_REF`, a git ref baked into the worker at deploy time (a release tag once a release exists; `main` before the first release). There are no runtime API lookups — the channel cannot silently drift to a newer commit.
2. **Verifies a pinned checksum.** The worker computes the SHA-256 of the fetched script and compares it against a hash baked into the worker per route. Checksum selection is by the ref being served: when the served ref is `main`, `sha256` is used; for any other ref (a release tag), `sha256Stable` is used. Before the first release, `STABLE_REF` is `main`, so both channels verify against `sha256` — the distinction only matters once a release tag is pinned.
3. **Refuses to serve a mismatch.** If the hash doesn't match, the fetched script is discarded — it is never served. The worker falls back to a cached copy *that itself passed verification when it was cached*, and if no such copy exists, you get a **502 error**, not an unverified script.

The consequence: compromising the GitHub repository is not enough to *silently* change what the stable channel serves. The served ref and its expected hash live in the deployed worker; changing either requires a worker redeploy, which means a public, reviewable commit to `cloudflare/_worker.js` on `main`. The guarantee is visibility — tampered content requires an auditable commit trail — not prevention, because Cloudflare Pages auto-deploys when `main` is pushed (see the caveats below for where the actual trust boundary is).

### The two channels

| Channel | Routes | Ref served | Checksum used | Who updates it |
|---------|--------|-----------|---------------|----------------|
| Stable | `/rog`, `/deck`, `/android` | `STABLE_REF` (pinned at deploy time) | `sha256Stable` (release tag) or `sha256` (pre-release, when `STABLE_REF` is `main`) | The release process, by hand, in one commit |
| Beta | `/rog-beta`, `/deck-beta`, `/android-beta` | always `main` | `sha256` | The Update Checksums workflow, automatically whenever a target script changes on main |

Beta is verified too — the automation keeps `sha256` synced to main, so beta's guarantee is "the current main, intact in transit," while stable's is "this exact reviewed release, intact, until the next release commit."

Caching is channel-safe: cache keys include the ref, so stable and beta entries can never cross-contaminate. Fresh entries are served for 5 minutes; verified copies are kept up to 24 hours as a fallback for GitHub outages.

---

## Verify what you received

Every script response carries verification headers. `irm | iex` can't show you headers, so check them with a separate request:

```powershell
$r = Invoke-WebRequest https://bootible.dev/rog
$r.Headers['X-Bootible-Ref']        # the git ref served (release tag, or 'main')
$r.Headers['X-Bootible-Integrity']  # 'sha256-<hash>' the content was verified against
$r.Headers['X-Bootible-Cache']      # HIT / MISS / REFRESH / STALE
```

```bash
curl -sI https://bootible.dev/deck | grep -i x-bootible
```

To go one step further, hash the body yourself and compare it against both the header and the `ROUTES` table in [`cloudflare/_worker.js`](https://github.com/bootible/bootible/blob/main/cloudflare/_worker.js) — the pinned hashes are public source code:

```powershell
$r = Invoke-WebRequest https://bootible.dev/rog
$bytes = [Text.Encoding]::UTF8.GetBytes($r.Content)
$hash = [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($bytes)).Replace('-','').ToLower()
$hash                               # compare to X-Bootible-Integrity and to the repo
```

If a response ever arrives from a degraded path, it says so: `X-Bootible-Cache: STALE` plus an `X-Bootible-Stale-Reason` header mean GitHub was unreachable (or returned content failing verification) and you received an older, previously verified copy.

---

## What a release looks like

A release activates in **one reviewable commit** to `cloudflare/_worker.js` that changes two things together:

- `STABLE_REF` flips from the previous ref to the new tag (e.g. `'v1.0.0'`)
- each route's `sha256Stable` is set to that tag's script hashes

Cloudflare Pages redeploys the worker on push, and the activation is atomic: there is no window where the worker requests a tag whose checksums aren't pinned — the previous release keeps serving until the deploy lands. The full procedure is in [`docs/releasing.md`](https://github.com/bootible/bootible/blob/main/docs/releasing.md).

To audit any release after the fact, find the `chore(release): activate vX.Y.Z on the stable channel` commit and check that the hashes match the tagged scripts.

---

## The honest caveats

A trust page that only lists guarantees isn't one. Here is where the boundaries actually are.

### The GitHub-raw fallback bypasses verification

On Windows, the bootstrap immediately re-downloads itself to a file and re-runs (piped stdin breaks the git credential manager). The primary download is `bootible.dev/rog` — verified as above. But if bootible.dev is unreachable, `ally.ps1` falls back to fetching `raw.githubusercontent.com/bootible/bootible/main/targets/ally.ps1` directly, with a console warning:

```
WARNING: GitHub fallback bypasses integrity verification
```

That fallback is plain HTTPS to GitHub: no Bootible checksum, and always `main` regardless of which channel you started from. It only triggers when bootible.dev is down — but when it does, you are trusting GitHub and TLS alone. If you see that warning and care about the distinction, abort and retry later.

### You are trusting the worker

Verification happens *inside* the worker — your device checks nothing cryptographic on its own. The root of trust is therefore the Cloudflare account serving `bootible.dev` (and the GitHub repo whose pushes deploy it). A compromised Cloudflare account could serve anything with matching headers. What you get in exchange is auditability: the worker source, the pinned hashes, and every release commit are public, so the served behavior can always be compared against the repo.

### Only the bootstrap is checksummed

The worker verifies the bootstrap script (`ally.ps1` / `deck.sh`). The bootstrap then clones the Bootible engine repo from GitHub with `git` over HTTPS — integrity in transit comes from git and TLS, not from a Bootible checksum. On Windows the bootstrap pins the engine checkout to the same ref it was released with, so stable serves a fully pinned engine.

!!! note "Steam Deck channel caveat"
    On the Steam Deck, channel pinning currently applies to the bootstrap script only — the engine it installs tracks the newest `main` regardless of channel, and the installed `bootible` command pulls main on each run. Full engine pinning on stable is a ROG Ally (Windows) behavior today. See [Updates & Channels](../post-install/channels.md).

---

## Related pages

- [Updates & Channels](../post-install/channels.md) — which channel you're on and how to switch
- [Try It in 5 Minutes](../getting-started/quick-try.md) — the short version of the trust story
- [CLI Reference](cli.md) — what the bootstrap does step by step
