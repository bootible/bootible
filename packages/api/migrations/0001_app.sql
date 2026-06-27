-- bootible cloud — app tables (account-scoped). account_id == the better-auth user id.
-- better-auth's own tables (user, session, account, verification, passkey) are
-- generated separately via `@better-auth/cli generate` into 0000_better_auth.sql.

CREATE TABLE IF NOT EXISTS profile (
  account_id  TEXT    NOT NULL,
  id          TEXT    NOT NULL,
  name        TEXT    NOT NULL,
  device_id   TEXT,
  base_id     TEXT,
  ui_json     TEXT    NOT NULL,            -- non-secret selections (plaintext JSON)
  secrets_enc TEXT,                        -- E2E ciphertext, or NULL if no secrets
  version     INTEGER NOT NULL DEFAULT 1,  -- client-owned, bumped per local edit
  updated_at  INTEGER NOT NULL,
  deleted     INTEGER NOT NULL DEFAULT 0,  -- tombstone
  PRIMARY KEY (account_id, id)
);

CREATE INDEX IF NOT EXISTS idx_profile_account ON profile (account_id);

-- Wrapped DEK material. The server can unwrap none of it (zero-knowledge).
CREATE TABLE IF NOT EXISTS account_keys (
  account_id            TEXT PRIMARY KEY,
  kdf                   TEXT    NOT NULL,  -- "argon2id"
  params_json           TEXT    NOT NULL,  -- Argon2 params {memorySize,iterations,parallelism}
  passphrase_salt       TEXT    NOT NULL,
  recovery_salt         TEXT    NOT NULL,
  wrapped_by_passphrase TEXT    NOT NULL,
  wrapped_by_recovery   TEXT    NOT NULL,
  updated_at            INTEGER NOT NULL
);
