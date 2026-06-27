# Plan: Client Sync Engine

Implements: `docs/v2/cloud/design.md` → "Sync engine (Electron main)" + `flows/profile-sync.md`.

## Scope

**Covers:**
- A pure **reconcile** function (in `@bootible/core`) that, given local profile state + the cloud list, decides per-profile sync actions — including **keep-both** on divergent edits.
- Tests covering every reconcile case (pull, push, keep-both, tombstones, offline-never-synced, in-sync).

**Does not cover:**
- The `CloudClient` that executes the actions (HTTP to the API, DEK encrypt/decrypt, keychain) — Plan: CloudClient.
- Auth/passphrase UI — Plan: Auth UX.

## Enables

The guarantee behind `profile-sync.md` and the north-star line "never silently overwrite." Reconcile is where "keep both" is decided; getting it right is what makes sync safe to run automatically. Pure and testable now, with no network or account.

## Prerequisites

- The API contract (`packages/api` — `GET /api/profiles` summaries with `version`/`updated_at`/`deleted`). Exists.

## North Star

Run reconcile on any pair of local/cloud states and it never loses a user's edit: divergent edits both survive (one as a conflict copy), tombstones propagate, and an already-synced pair produces no work.

## Done Criteria

### Reconcile decisions (per profile id, union of local + cloud)
- When a profile exists only in the cloud, reconcile shall emit **pull**.
- When a profile exists only locally and was never synced, reconcile shall emit **push**.
- While a profile is unchanged on both sides (local version == cloud version == last-synced), reconcile shall emit **noop**.
- When only the cloud changed since last sync, reconcile shall emit **pull** (a cloud tombstone pulls as a local delete).
- When only the local copy changed since last sync, reconcile shall emit **push** (a local tombstone pushes as a cloud delete).
- If both changed since last sync, then reconcile shall emit **keep-both** (local kept under its id; cloud imported as a conflict copy).

### Delete-vs-edit (never lose an edit)
- If the local copy is a tombstone but the cloud was edited, then reconcile shall emit **pull** (the edit wins, un-deleting locally).
- If the cloud is a tombstone but the local copy was edited, then reconcile shall emit **push** (the edit wins, un-deleting in the cloud).
- While both sides are tombstoned, reconcile shall emit **noop**.

### Shape
- Reconcile shall be a pure function (no IO) returning a deterministic, id-sorted action list.

## Constraints

- **Design alignment**: server is a dumb store — all merge logic is client-side (design "dumb store + client merge"). Reconcile must not assume server-side conflict handling.
- **Technical**: "changed since last sync" is determined by comparing the stored `lastSyncedVersion` to the current local and cloud versions — not timestamps (clocks drift).
- **Ownership**: executing actions (network, crypto, keychain) is the CloudClient's job, not reconcile's.

## References

- Design: `docs/v2/cloud/design.md` (sync engine + versioning).
- Flow: `docs/v2/cloud/flows/profile-sync.md` (stages this realizes).
- Crypto: `@bootible/core` `cloud-crypto.ts` (the CloudClient will use it; reconcile does not).
- Testing: vitest, alongside `packages/core/src/*.test.ts`.

## Error Policy

Reconcile is pure and total — it never throws on valid inputs; unknown/missing `lastSyncedVersion` is treated as "never synced." Network/crypto failures are the CloudClient's concern.
