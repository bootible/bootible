/**
 * Pure reconcile for cloud profile sync. Given the local profile state and the
 * cloud list, decide what to do per profile — never losing an edit. The server
 * is a dumb versioned store; all merge logic lives here (see design.md).
 *
 * "Changed since last sync" is decided by version, not timestamp: a profile's
 * `lastSyncedVersion` is the version that was last successfully synced. If the
 * current local version differs, the user edited locally; if the cloud version
 * differs, it changed elsewhere. Both differ → divergent → keep both.
 */

export interface LocalState {
  id: string;
  version: number;
  deleted: boolean;
  /** Version at the last successful sync; null/undefined = never synced. */
  lastSyncedVersion?: number | null;
}

export interface RemoteState {
  id: string;
  version: number;
  deleted: boolean;
}

export type SyncAction =
  /** Download the cloud copy → add, replace, or (if a tombstone) delete locally. */
  | { type: "pull"; id: string }
  /** Upload the local copy → cloud (a local tombstone deletes it in the cloud). */
  | { type: "push"; id: string }
  /** Divergent edits: keep the local copy under its id; import the cloud copy as a conflict copy. */
  | { type: "keepBoth"; id: string }
  /** Already in sync — nothing to do. */
  | { type: "noop"; id: string };

/** Decide the sync action for one profile present on one or both sides. */
function decide(
  local: LocalState | undefined,
  remote: RemoteState | undefined,
): SyncAction["type"] {
  // Only one side has it.
  if (local && !remote) return "push";
  if (remote && !local) return "pull";
  if (!local || !remote) return "noop"; // unreachable; satisfies the type narrowing

  const base = local.lastSyncedVersion ?? null;
  const localChanged = base === null || local.version !== base;
  const remoteChanged = base === null || remote.version !== base;

  if (!localChanged && !remoteChanged) return "noop";
  if (localChanged && !remoteChanged) return "push";
  if (!localChanged && remoteChanged) return "pull";

  // Both changed since last sync.
  // Delete-vs-edit: the edit wins so no work is lost; otherwise keep both.
  if (local.deleted && !remote.deleted) return "pull";
  if (remote.deleted && !local.deleted) return "push";
  if (local.deleted && remote.deleted) return "noop";
  return "keepBoth";
}

/** Reconcile local + cloud state into a deterministic, id-sorted action list. */
export function reconcile(local: LocalState[], remote: RemoteState[]): SyncAction[] {
  const byIdLocal = new Map(local.map((p) => [p.id, p]));
  const byIdRemote = new Map(remote.map((p) => [p.id, p]));
  const ids = [...new Set([...byIdLocal.keys(), ...byIdRemote.keys()])].sort();
  return ids.map((id) => ({ type: decide(byIdLocal.get(id), byIdRemote.get(id)), id }));
}
