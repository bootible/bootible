import { describe, expect, it } from "vitest";
import { type LocalState, type RemoteState, reconcile } from "./cloud-sync";

const local = (over: Partial<LocalState> & { id: string }): LocalState => ({
  version: 1,
  deleted: false,
  lastSyncedVersion: null,
  ...over,
});
const remote = (over: Partial<RemoteState> & { id: string }): RemoteState => ({
  version: 1,
  deleted: false,
  ...over,
});

/** Convenience: action type for a given id. */
const action = (l: LocalState[], r: RemoteState[], id: string) =>
  reconcile(l, r).find((a) => a.id === id)?.type;

describe("reconcile", () => {
  it("pulls a cloud-only profile", () => {
    expect(action([], [remote({ id: "a" })], "a")).toBe("pull");
  });

  it("pushes a local-only, never-synced profile", () => {
    expect(action([local({ id: "a" })], [], "a")).toBe("push");
  });

  it("noops when both sides are unchanged since last sync", () => {
    const l = [local({ id: "a", version: 3, lastSyncedVersion: 3 })];
    const r = [remote({ id: "a", version: 3 })];
    expect(action(l, r, "a")).toBe("noop");
  });

  it("pulls when only the cloud changed", () => {
    const l = [local({ id: "a", version: 3, lastSyncedVersion: 3 })];
    const r = [remote({ id: "a", version: 4 })];
    expect(action(l, r, "a")).toBe("pull");
  });

  it("pushes when only the local copy changed", () => {
    const l = [local({ id: "a", version: 4, lastSyncedVersion: 3 })];
    const r = [remote({ id: "a", version: 3 })];
    expect(action(l, r, "a")).toBe("push");
  });

  it("keeps both when both sides changed since last sync", () => {
    const l = [local({ id: "a", version: 4, lastSyncedVersion: 3 })];
    const r = [remote({ id: "a", version: 5 })];
    expect(action(l, r, "a")).toBe("keepBoth");
  });

  describe("tombstones", () => {
    it("pulls a cloud tombstone when local is unchanged (propagates delete)", () => {
      const l = [local({ id: "a", version: 3, lastSyncedVersion: 3 })];
      const r = [remote({ id: "a", version: 4, deleted: true })];
      expect(action(l, r, "a")).toBe("pull");
    });

    it("pushes a local tombstone when cloud is unchanged (propagates delete)", () => {
      const l = [local({ id: "a", version: 4, deleted: true, lastSyncedVersion: 3 })];
      const r = [remote({ id: "a", version: 3 })];
      expect(action(l, r, "a")).toBe("push");
    });

    it("noops when both sides are tombstoned", () => {
      const l = [local({ id: "a", version: 4, deleted: true, lastSyncedVersion: 3 })];
      const r = [remote({ id: "a", version: 5, deleted: true })];
      expect(action(l, r, "a")).toBe("noop");
    });
  });

  describe("delete-vs-edit never loses an edit", () => {
    it("pulls when local was deleted but the cloud was edited", () => {
      const l = [local({ id: "a", version: 4, deleted: true, lastSyncedVersion: 3 })];
      const r = [remote({ id: "a", version: 5 })];
      expect(action(l, r, "a")).toBe("pull");
    });

    it("pushes when the cloud was deleted but local was edited", () => {
      const l = [local({ id: "a", version: 5, lastSyncedVersion: 3 })];
      const r = [remote({ id: "a", version: 4, deleted: true })];
      expect(action(l, r, "a")).toBe("push");
    });
  });

  it("is deterministic and id-sorted across a mixed set", () => {
    const l = [
      local({ id: "c", version: 2, lastSyncedVersion: 1 }), // local changed → push
      local({ id: "a", version: 1, lastSyncedVersion: 1 }), // unchanged → noop
    ];
    const r = [
      remote({ id: "a", version: 1 }),
      remote({ id: "b", version: 1 }), // cloud-only → pull
    ];
    expect(reconcile(l, r)).toEqual([
      { type: "noop", id: "a" },
      { type: "pull", id: "b" },
      { type: "push", id: "c" },
    ]);
  });
});
