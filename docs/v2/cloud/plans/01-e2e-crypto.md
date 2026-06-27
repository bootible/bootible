# Plan: E2E Secret-Key Crypto Module

Implements: `docs/v2/cloud/design.md` → "End-to-end secret encryption" + `flows/account-and-keys.md`.

## Scope

**Covers:**
- A pure, dependency-light crypto module (in `@bootible/core`) implementing the DEK / KEK / wrap / unwrap / recovery scheme and profile-secret encrypt/decrypt.
- Unit tests proving the scheme round-trips and that the server-visible material reveals nothing.

**Does not cover:**
- Storing the DEK in the OS keychain or wiring IPC (Plan: Client Sync Engine).
- The Worker, D1, or any network call (Plan: Cloud API).
- UI for passphrase setup/unlock (Plan: Auth UX).

## Enables

The privacy guarantee at the heart of the north star ("servers can never read your secrets"). Everything downstream — the sync engine, the API's `secrets_enc` column, the auth UX — depends on this module existing and being trustworthy. **It is buildable and fully testable now, with no Cloudflare account**, so it unblocks v1 while the account is provisioned.

## Prerequisites

- None. Pure computation; runs under vitest in the existing monorepo.

## North Star

Given a passphrase and a secrets object, the module produces material from which the secrets are recoverable **only** with the passphrase or the recovery code — and from the stored (server-visible) material alone, neither the secrets, the DEK, nor the passphrase are derivable. Argon2id derivation completes in ~0.5–1s on a desktop.

## Done Criteria

### Key creation
- The module shall generate a 256-bit random DEK using a CSPRNG.
- When given a passphrase, the module shall derive a KEK via Argon2id with a random salt and recorded parameters, and return `wrapped_dek_passphrase = AES-256-GCM(KEK, DEK)`.
- The module shall generate a 128-bit recovery code (human-readable, e.g. base32 groups) and return `wrapped_dek_recovery` wrapping the same DEK.
- The module shall output only: the two wrapped blobs, the KDF id, the salt(s), and the KDF parameters — never the DEK, KEK, passphrase, or recovery code.

### Unlock & recovery
- When given the stored material and the correct passphrase, the module shall recover the DEK.
- If the passphrase is wrong, then the module shall fail to recover the DEK and report it without revealing whether any other input was close.
- When given the recovery code, the module shall recover the DEK regardless of the passphrase.
- Where the user sets a new passphrase after recovery, the module shall produce a new `wrapped_dek_passphrase` for the same DEK.

### Profile secrets
- Given a DEK and a secrets object, the module shall return `secrets_enc` = AES-256-GCM ciphertext (with IV + tag) that decrypts back to the identical object with that DEK.
- If `secrets_enc` is decrypted with the wrong DEK, then decryption shall fail (authentication tag rejects it) rather than return garbage.

### Verification
- The test suite shall demonstrate a full round-trip: create → wrap → (simulate new device) unlock-by-passphrase → decrypt secrets; and create → recover-by-code → decrypt.
- The test suite shall assert the server-visible material does not contain the DEK or plaintext secrets (no substring leakage; distinct ciphertext for repeated inputs via random IV/salt).

## Constraints

- **Technical**: Argon2id (not PBKDF2/bcrypt) for the KDF — design decision; resists GPU brute force. AES-256-GCM for all symmetric encryption (authenticated).
- **Technical**: must run in both the Electron main (Node) and a Worker if ever needed — prefer WebCrypto + a wasm Argon2 over native node-gyp bindings, so the module stays portable and bundles cleanly.
- **Design alignment**: the module must be incapable of emitting plaintext key material — no "debug" path that returns the DEK to a caller that would persist it server-side.
- **Ownership**: keychain persistence and network are out of scope (other plans).

## References

- Design: `docs/v2/cloud/design.md` (crypto table + data model).
- Flow: `docs/v2/cloud/flows/account-and-keys.md` (stages this satisfies).
- Argon2 wasm: [hash-wasm](https://github.com/Daninet/hash-wasm) — `hash-wasm` (Argon2id, no native deps) or equivalent.
- AES-GCM / random: WebCrypto `crypto.subtle` (available in Node 20+ and Workers).
- Testing: vitest, alongside existing `packages/core/src/*.test.ts`.

## Error Policy

Cryptographic failures (wrong passphrase, bad tag, malformed input) are expected control flow — return a typed failure result, never throw raw or leak which field mismatched. Never log key material, passphrases, or plaintext secrets.
