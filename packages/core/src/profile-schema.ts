/**
 * The persisted-profile shape + migration, owned by core so it's pure and tested
 * (the Electron store layers encryption + file I/O on top). Profiles are versioned
 * and device-family-tagged; legacy entries are migrated to the current schema on
 * read, and unrecoverable entries are dropped rather than half-loaded.
 */

export type DeviceFamily = "windows" | "steamos" | "unknown";

export const CURRENT_PROFILE_VERSION = 1;

export interface PersistedProfile {
  schemaVersion: number;
  id: string;
  name: string;
  deviceId?: string;
  baseId?: string;
  deviceFamily: DeviceFamily;
  savedAt?: string;
  /** Plaintext UI/config blob (secrets ride in secretsEnc). */
  ui: Record<string, unknown>;
  /** Opaque to core — the Electron store encrypts/decrypts it. */
  secretsEnc: string;
  // Cloud-sync metadata.
  version: number;
  lastSyncedVersion: number | null;
  updatedAt: number;
  deleted: boolean;
}

/**
 * Filter profiles to those a given device should see: its own family, plus
 * untagged/legacy (unknown family) so existing profiles never silently vanish.
 * Other families are hidden — a Windows profile doesn't belong on a Deck.
 */
export function visibleProfiles<T extends { deviceId?: string }>(
  profiles: readonly T[],
  deviceId: string | undefined,
): T[] {
  const family = deviceFamilyOf(deviceId);
  return profiles.filter((p) => {
    const f = deviceFamilyOf(p.deviceId);
    return f === "unknown" || f === family;
  });
}

/** Map a device id to its family (used to keep a device's profiles to itself). */
export function deviceFamilyOf(deviceId: string | undefined): DeviceFamily {
  const id = (deviceId ?? "").toLowerCase();
  if (!id) return "unknown";
  if (id.includes("deck")) return "steamos";
  if (id.includes("ally") || id.includes("rog")) return "windows";
  return "unknown";
}

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

/**
 * Validate + migrate an arbitrary persisted profile to the current schema. Returns
 * null when the entry can't be recovered (not an object, or no usable name).
 * `now` is injected for testability.
 */
export function migrateProfile(raw: unknown, now: number): PersistedProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const j = raw as Record<string, unknown>;

  const name = str(j.name)?.trim();
  if (!name) return null;

  const deviceId = str(j.deviceId);
  const savedAt = str(j.savedAt);
  const updatedAt =
    typeof j.updatedAt === "number" ? j.updatedAt : savedAt ? Date.parse(savedAt) || now : now;

  return {
    schemaVersion: typeof j.schemaVersion === "number" ? j.schemaVersion : CURRENT_PROFILE_VERSION,
    id: str(j.id) ?? name,
    name,
    deviceId,
    baseId: str(j.baseId),
    deviceFamily: deviceFamilyOf(deviceId),
    savedAt,
    ui: (j.ui as Record<string, unknown>) ?? {},
    secretsEnc: typeof j.secretsEnc === "string" ? j.secretsEnc : "",
    version: typeof j.version === "number" ? j.version : 1,
    lastSyncedVersion: typeof j.lastSyncedVersion === "number" ? j.lastSyncedVersion : null,
    updatedAt,
    deleted: j.deleted === true,
  };
}
