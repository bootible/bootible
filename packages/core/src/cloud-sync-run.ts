/**
 * Sync orchestrator: drive reconcile's decisions over the cloud API with E2E
 * crypto, against an abstract local store. The Electron main supplies a real
 * store (over its profile files) and an unlocked DEK; everything here is testable
 * with an in-memory fake.
 */
import type { CloudApi, ProfilePayload } from "./cloud-api";
import { decryptSecrets, encryptSecrets } from "./cloud-crypto";
import { type LocalState, type RemoteState, reconcile } from "./cloud-sync";

/** A profile as the app holds it locally — secrets decrypted in memory. */
export interface LocalProfile {
  id: string;
  name: string;
  deviceModel: string | null;
  baseId: string | null;
  ui: unknown;
  secrets: unknown;
  version: number;
  updatedAt: number;
  deleted: boolean;
  lastSyncedVersion: number | null;
}

/** The local profile store the orchestrator drives (implemented by the app). */
export interface LocalStore {
  list(): Promise<LocalProfile[]>;
  /** Insert/replace a profile (applies pulls + conflict copies). */
  put(p: LocalProfile): Promise<void>;
  /** Record the version that is now in sync with the cloud. */
  markSynced(id: string, version: number): Promise<void>;
}

/** The subset of CloudApi the orchestrator needs (CloudApi satisfies it; fakes too). */
export type SyncApi = Pick<
  CloudApi,
  "listProfiles" | "getProfile" | "putProfile" | "deleteProfile"
>;

export interface SyncReport {
  pulled: string[];
  pushed: string[];
  conflicted: string[];
  failed: { id: string; error: string }[];
}

/** Local id for the imported copy of a remotely-diverged profile. */
export function conflictId(id: string): string {
  return `${id}__conflict`;
}

export async function runSync(
  api: SyncApi,
  dek: Uint8Array,
  store: LocalStore,
): Promise<SyncReport> {
  const report: SyncReport = { pulled: [], pushed: [], conflicted: [], failed: [] };

  const localList = await store.list();
  const localById = new Map(localList.map((p) => [p.id, p]));
  const remoteList = await api.listProfiles();

  const localStates: LocalState[] = localList.map((p) => ({
    id: p.id,
    version: p.version,
    deleted: p.deleted,
    lastSyncedVersion: p.lastSyncedVersion,
  }));
  const remoteStates: RemoteState[] = remoteList.map((r) => ({
    id: r.id,
    version: r.version,
    deleted: !!r.deleted,
  }));

  const toPayload = (p: LocalProfile, id = p.id): ProfilePayload => ({
    id,
    name: p.name,
    device_id: p.deviceModel, // the wire field stays `device_id` (DTO/protocol)
    base_id: p.baseId,
    ui_json: JSON.stringify(p.ui ?? {}),
    secrets_enc: null, // filled in by push (async encrypt)
    version: p.version,
    updated_at: p.updatedAt,
    deleted: p.deleted ? 1 : 0,
  });

  const pullInto = async (remoteId: string, localId: string, asConflict: boolean) => {
    const payload = await api.getProfile(remoteId);
    if (!payload) return;
    let secrets: unknown = null;
    if (payload.secrets_enc) {
      const dec = await decryptSecrets(dek, payload.secrets_enc);
      secrets = dec.ok ? dec.value : null; // null => "unlock to use" if dek can't open it
    }
    await store.put({
      id: localId,
      name: asConflict ? `${payload.name} (conflict)` : payload.name,
      deviceModel: payload.device_id,
      baseId: payload.base_id,
      ui: safeParse(payload.ui_json),
      secrets,
      version: asConflict ? 1 : payload.version,
      updatedAt: payload.updated_at,
      deleted: asConflict ? false : payload.deleted === 1,
      lastSyncedVersion: asConflict ? null : payload.version,
    });
  };

  const push = async (p: LocalProfile) => {
    if (p.deleted) {
      await api.deleteProfile(p.id);
    } else {
      const payload = toPayload(p);
      payload.secrets_enc = p.secrets == null ? null : await encryptSecrets(dek, p.secrets);
      await api.putProfile(payload);
    }
    await store.markSynced(p.id, p.version);
  };

  for (const act of reconcile(localStates, remoteStates)) {
    try {
      if (act.type === "noop") continue;
      if (act.type === "pull") {
        await pullInto(act.id, act.id, false);
        report.pulled.push(act.id);
      } else if (act.type === "push") {
        const local = localById.get(act.id);
        if (local) await push(local);
        report.pushed.push(act.id);
      } else if (act.type === "keepBoth") {
        const local = localById.get(act.id);
        // Save the diverged cloud copy locally (so its edits aren't lost)...
        await pullInto(act.id, conflictId(act.id), true);
        // ...then push the local edits under the original id.
        if (local) await push(local);
        report.conflicted.push(act.id);
      }
    } catch (e) {
      report.failed.push({ id: act.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return report;
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}
