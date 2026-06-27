/**
 * D1 data-access for cloud profile sync (account-scoped). The server is a dumb
 * versioned store — merge/conflict logic lives in the client (see design.md).
 * Every query is scoped by `accountId` (the better-auth user id) so one account
 * can never read or write another's rows.
 */

/** The slice of the Cloudflare D1 API used here; the real `D1Database` satisfies it. */
export interface D1Like {
  prepare(query: string): D1StmtLike;
}
export interface D1StmtLike {
  bind(...values: unknown[]): D1StmtLike;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<unknown>;
  all<T = unknown>(): Promise<{ results: T[] }>;
}

export interface ProfileSummaryRow {
  id: string;
  name: string;
  version: number;
  updated_at: number;
  deleted: number;
}
export interface ProfileRow extends ProfileSummaryRow {
  device_id: string | null;
  base_id: string | null;
  ui_json: string;
  secrets_enc: string | null;
}
export interface KeyRow {
  kdf: string;
  params_json: string;
  passphrase_salt: string;
  recovery_salt: string;
  wrapped_by_passphrase: string;
  wrapped_by_recovery: string;
  updated_at: number;
}

const PROFILE_COLS =
  "id, name, device_id, base_id, ui_json, secrets_enc, version, updated_at, deleted";

/** Lightweight list for the sync pull — summaries + tombstones, not the payloads. */
export function listProfiles(db: D1Like, accountId: string): Promise<ProfileSummaryRow[]> {
  return db
    .prepare("SELECT id, name, version, updated_at, deleted FROM profile WHERE account_id = ?")
    .bind(accountId)
    .all<ProfileSummaryRow>()
    .then((r) => r.results);
}

export function getProfile(db: D1Like, accountId: string, id: string): Promise<ProfileRow | null> {
  return db
    .prepare(`SELECT ${PROFILE_COLS} FROM profile WHERE account_id = ? AND id = ?`)
    .bind(accountId, id)
    .first<ProfileRow>();
}

/** Insert or replace a profile for this account (client owns versioning). */
export async function upsertProfile(db: D1Like, accountId: string, p: ProfileRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO profile (account_id, id, name, device_id, base_id, ui_json, secrets_enc, version, updated_at, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(account_id, id) DO UPDATE SET
         name = excluded.name, device_id = excluded.device_id, base_id = excluded.base_id,
         ui_json = excluded.ui_json, secrets_enc = excluded.secrets_enc,
         version = excluded.version, updated_at = excluded.updated_at, deleted = excluded.deleted`,
    )
    .bind(
      accountId,
      p.id,
      p.name,
      p.device_id,
      p.base_id,
      p.ui_json,
      p.secrets_enc,
      p.version,
      p.updated_at,
      p.deleted,
    )
    .run();
}

/** Mark a profile deleted (tombstone) so the delete propagates to other devices. */
export async function tombstoneProfile(
  db: D1Like,
  accountId: string,
  id: string,
  updatedAt: number,
): Promise<void> {
  await db
    .prepare(
      "UPDATE profile SET deleted = 1, version = version + 1, updated_at = ? WHERE account_id = ? AND id = ?",
    )
    .bind(updatedAt, accountId, id)
    .run();
}

export function getKeys(db: D1Like, accountId: string): Promise<KeyRow | null> {
  return db
    .prepare(
      "SELECT kdf, params_json, passphrase_salt, recovery_salt, wrapped_by_passphrase, wrapped_by_recovery, updated_at FROM account_keys WHERE account_id = ?",
    )
    .bind(accountId)
    .first<KeyRow>();
}

/** Store/replace the wrapped DEK material. Server can unwrap none of it. */
export async function putKeys(db: D1Like, accountId: string, k: KeyRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO account_keys (account_id, kdf, params_json, passphrase_salt, recovery_salt, wrapped_by_passphrase, wrapped_by_recovery, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(account_id) DO UPDATE SET
         kdf = excluded.kdf, params_json = excluded.params_json,
         passphrase_salt = excluded.passphrase_salt, recovery_salt = excluded.recovery_salt,
         wrapped_by_passphrase = excluded.wrapped_by_passphrase,
         wrapped_by_recovery = excluded.wrapped_by_recovery, updated_at = excluded.updated_at`,
    )
    .bind(
      accountId,
      k.kdf,
      k.params_json,
      k.passphrase_salt,
      k.recovery_salt,
      k.wrapped_by_passphrase,
      k.wrapped_by_recovery,
      k.updated_at,
    )
    .run();
}

/** Account deletion: wipe this account's profiles and wrapped key material. */
export async function deleteAccountData(db: D1Like, accountId: string): Promise<void> {
  await db.prepare("DELETE FROM profile WHERE account_id = ?").bind(accountId).run();
  await db.prepare("DELETE FROM account_keys WHERE account_id = ?").bind(accountId).run();
}
