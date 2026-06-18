import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type TargetRole = "config" | "saves" | "content";

export interface TargetCapabilities {
  selectiveList: boolean;
  continuous: boolean;
  contentAware: boolean;
}

export interface SyncTarget {
  connect(): void;
  list(scope?: string): string[];
  pull(scope: string, dest: string): void;
  push(src: string, scope: string): void;
  capabilities(): TargetCapabilities;
}

/**
 * The zero-infra floor: a sync target backed by a local directory (a USB stick,
 * a mounted share, any path). pull/push are recursive file copies.
 */
export function localTarget(root: string): SyncTarget {
  return {
    connect() {
      mkdirSync(root, { recursive: true });
    },
    list(scope) {
      const dir = scope ? join(root, scope) : root;
      return existsSync(dir) ? readdirSync(dir, { recursive: true }).map(String) : [];
    },
    pull(scope, dest) {
      const from = join(root, scope);
      if (!existsSync(from)) {
        throw new Error(`local target has no scope "${scope}"`);
      }
      mkdirSync(dest, { recursive: true });
      cpSync(from, dest, { recursive: true });
    },
    push(src, scope) {
      if (!existsSync(src)) {
        throw new Error(`source "${src}" does not exist`);
      }
      const to = join(root, scope);
      mkdirSync(to, { recursive: true });
      cpSync(src, to, { recursive: true });
    },
    capabilities() {
      return { selectiveList: true, continuous: false, contentAware: false };
    },
  };
}
