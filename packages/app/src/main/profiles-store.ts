/**
 * Local profile files (the single source of truth for both the profile UI and
 * cloud sync). Files live under userData/profiles, keyed by a stable id, with
 * DPAPI-encrypted secrets and cloud-sync metadata (version / lastSyncedVersion /
 * updatedAt / deleted). The renderer works by display name; sync works by id.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CURRENT_PROFILE_VERSION,
  deviceFamilyOf,
  type LocalProfile,
  type LocalStore,
  migrateProfile,
  type PersistedProfile,
} from "@bootible/core";
import { app, safeStorage } from "electron";

export interface ProfileSummary {
  name: string;
  deviceId?: string;
  baseId?: string;
  savedAt?: string;
}
export interface Profile extends ProfileSummary {
  ui: Record<string, unknown>;
  secrets?: Record<string, string>;
}

// The persisted shape + its migration live in core (pure, tested); this file adds
// encryption + file I/O. schemaVersion/deviceFamily are stamped by write().
type StoredProfile = PersistedProfile;
type WritableProfile = Omit<PersistedProfile, "schemaVersion" | "deviceFamily">;

function dir(): string {
  return join(app.getPath("userData"), "profiles");
}
function fileFor(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9 _-]/g, "_").trim() || "profile";
  return join(dir(), `${safe}.json`);
}

function encSecrets(secrets: Record<string, string>): string {
  if (Object.keys(secrets).length === 0 || !safeStorage.isEncryptionAvailable()) return "";
  return safeStorage.encryptString(JSON.stringify(secrets)).toString("base64");
}
function decSecrets(secretsEnc: string): Record<string, string> {
  if (!secretsEnc || !safeStorage.isEncryptionAvailable()) return {};
  try {
    return JSON.parse(safeStorage.decryptString(Buffer.from(secretsEnc, "base64")));
  } catch {
    return {};
  }
}

function readAll(): StoredProfile[] {
  if (!existsSync(dir())) return [];
  return readdirSync(dir())
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        // Migrate/validate via core; unrecoverable entries drop out (null).
        return migrateProfile(JSON.parse(readFileSync(join(dir(), f), "utf8")), Date.now());
      } catch {
        return null;
      }
    })
    .filter((p): p is StoredProfile => p !== null);
}

function write(s: WritableProfile): void {
  mkdirSync(dir(), { recursive: true });
  const full: StoredProfile = {
    ...s,
    schemaVersion: CURRENT_PROFILE_VERSION,
    deviceFamily: deviceFamilyOf(s.deviceId),
  };
  writeFileSync(fileFor(full.id), JSON.stringify(full, null, 2), "utf8");
}

const byName = (name: string) => readAll().find((p) => p.name === name) ?? null;
const byId = (id: string) => readAll().find((p) => p.id === id) ?? null;

// ── Renderer-facing API (keyed by display name) ──────────────────────────────
export function listProfiles(): ProfileSummary[] {
  return readAll()
    .filter((p) => !p.deleted)
    .map((p) => ({ name: p.name, deviceId: p.deviceId, baseId: p.baseId, savedAt: p.savedAt }));
}

export function saveProfile(p: Profile): { ok: boolean; name: string } {
  const prev = byName(p.name);
  write({
    id: prev?.id ?? p.name,
    name: p.name,
    deviceId: p.deviceId,
    baseId: p.baseId,
    savedAt: new Date().toISOString(),
    ui: p.ui,
    secretsEnc: encSecrets(p.secrets ?? {}),
    version: (prev?.version ?? 0) + 1,
    lastSyncedVersion: prev?.lastSyncedVersion ?? null,
    updatedAt: Date.now(),
    deleted: false,
  });
  return { ok: true, name: p.name };
}

export function loadProfile(name: string): Profile | null {
  const s = byName(name);
  if (!s || s.deleted) return null;
  return {
    name: s.name,
    deviceId: s.deviceId,
    baseId: s.baseId,
    ui: s.ui,
    secrets: decSecrets(s.secretsEnc),
  };
}

export function deleteProfile(name: string): { ok: boolean } {
  const s = byName(name);
  if (!s) return { ok: false };
  // Tombstone (not hard-delete) so the deletion syncs; the UI filters these out.
  write({ ...s, deleted: true, version: s.version + 1, updatedAt: Date.now() });
  return { ok: true };
}

// ── Cloud-sync LocalStore (keyed by stable id; secrets decrypted in memory) ──
export function makeLocalStore(): LocalStore {
  return {
    async list(): Promise<LocalProfile[]> {
      return readAll().map((s) => ({
        id: s.id,
        name: s.name,
        deviceId: s.deviceId ?? null,
        baseId: s.baseId ?? null,
        ui: s.ui,
        secrets: decSecrets(s.secretsEnc),
        version: s.version,
        updatedAt: s.updatedAt,
        deleted: s.deleted,
        lastSyncedVersion: s.lastSyncedVersion,
      }));
    },
    async put(p: LocalProfile): Promise<void> {
      const prev = byId(p.id);
      write({
        id: p.id,
        name: p.name,
        deviceId: p.deviceId ?? undefined,
        baseId: p.baseId ?? undefined,
        savedAt: prev?.savedAt ?? new Date().toISOString(),
        ui: (p.ui as Record<string, unknown>) ?? {},
        secretsEnc: encSecrets((p.secrets as Record<string, string>) ?? {}),
        version: p.version,
        lastSyncedVersion: p.lastSyncedVersion,
        updatedAt: p.updatedAt,
        deleted: p.deleted,
      });
    },
    async markSynced(id: string, version: number): Promise<void> {
      const s = byId(id);
      if (s) write({ ...s, lastSyncedVersion: version });
    },
  };
}
