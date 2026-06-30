/**
 * The persisted-profile shape + migration, owned by core so it's pure and tested
 * (the Electron store layers encryption + file I/O on top). Profiles are versioned
 * and device-family-tagged; legacy entries are migrated to the current schema on
 * read, and unrecoverable entries are dropped rather than half-loaded.
 */

export type DeviceFamily = "windows" | "steamos" | "unknown";

/** A saved profile as the renderer/IPC sees it (secrets decrypted in memory).
 *  The on-disk form is PersistedProfile (secretsEnc); the cloud DTO is
 *  CloudProfileSummary (cloud-api). One source for all three layers. */
export interface ProfileSummary {
  name: string;
  /** The device CLASS this profile is tagged to — a model id ("rog-ally",
   *  "steamdeck"), NOT a physical unit. Drives profile visibility/grouping.
   *  (Was `deviceId`; old files are migrated on read.) */
  deviceModel?: string;
  /** A specific communicatable physical unit (ssh/wifi/usb) — reserved for the
   *  headless/remote flows. NEVER used for profile linking, and never synced (it's
   *  per-unit). Most profiles leave it unset. */
  instanceId?: string;
  baseId?: string;
  savedAt?: string;
}

export interface Profile extends ProfileSummary {
  ui: Record<string, unknown>;
  secrets?: Record<string, string>;
}

export const CURRENT_PROFILE_VERSION = 1;

export interface PersistedProfile {
  schemaVersion: number;
  id: string;
  name: string;
  deviceModel?: string;
  instanceId?: string;
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
export function visibleProfiles<T extends { deviceModel?: string }>(
  profiles: readonly T[],
  deviceModel: string | undefined,
): T[] {
  const family = deviceFamilyOf(deviceModel);
  return profiles.filter((p) => {
    const f = deviceFamilyOf(p.deviceModel);
    return f === "unknown" || f === family;
  });
}

export interface GroupedProfiles<T> {
  /** Tagged to this exact device model — shown first. */
  model: T[];
  /** Same family, plus untagged profiles that apply anywhere — shown below. */
  family: T[];
}

/**
 * Split saved profiles for the current device model into two dropdown sections:
 * `model` (this exact model) then `family` (other same-family + untagged). Other
 * families are hidden. With no model selected (unknown context — e.g. a deep link)
 * everything goes in `model` rather than hiding anything. Lives in core so the one
 * `deviceFamilyOf` is the only family mapping (the renderer reaches it over IPC,
 * since it can't value-import core).
 */
export function groupProfilesForDevice<T extends { deviceModel?: string }>(
  profiles: readonly T[],
  deviceModel: string | undefined,
): GroupedProfiles<T> {
  if (!deviceModel) return { model: [...profiles], family: [] };
  const fam = deviceFamilyOf(deviceModel);
  const model: T[] = [];
  const family: T[] = [];
  for (const p of profiles) {
    const pf = deviceFamilyOf(p.deviceModel);
    if (pf !== "unknown" && pf !== fam) continue; // a different family — not shown here
    if (p.deviceModel === deviceModel) model.push(p);
    else family.push(p); // same family, or untagged (applies anywhere)
  }
  return { model, family };
}

/** Map a device MODEL id to its family (used to keep a device's profiles to itself). */
export function deviceFamilyOf(deviceModel: string | undefined): DeviceFamily {
  const id = (deviceModel ?? "").toLowerCase();
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

  // Back-compat: profiles saved before the rename carry `deviceId` (which held the
  // model id all along); read either, write the new name.
  const deviceModel = str(j.deviceModel) ?? str(j.deviceId);
  const savedAt = str(j.savedAt);
  const updatedAt =
    typeof j.updatedAt === "number" ? j.updatedAt : savedAt ? Date.parse(savedAt) || now : now;

  return {
    schemaVersion: typeof j.schemaVersion === "number" ? j.schemaVersion : CURRENT_PROFILE_VERSION,
    id: str(j.id) ?? name,
    name,
    deviceModel,
    instanceId: str(j.instanceId),
    baseId: str(j.baseId),
    deviceFamily: deviceFamilyOf(deviceModel),
    savedAt,
    ui: (j.ui as Record<string, unknown>) ?? {},
    secretsEnc: typeof j.secretsEnc === "string" ? j.secretsEnc : "",
    version: typeof j.version === "number" ? j.version : 1,
    lastSyncedVersion: typeof j.lastSyncedVersion === "number" ? j.lastSyncedVersion : null,
    updatedAt,
    deleted: j.deleted === true,
  };
}
