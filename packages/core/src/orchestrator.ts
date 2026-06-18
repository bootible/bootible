import { type ArtifactSchemas, type BootibleConfig, loadArtifact } from "./config";
import type { DeviceEntry } from "./registry";
import { resolveSecrets, type SecretProvider } from "./secrets";
import type { SyncTarget } from "./sync-target";

export interface ApplyContext {
  device: DeviceEntry;
  config: BootibleConfig;
}

export interface ExecutorReceipt {
  actions: string[];
}

/** A platform applier (Ally, Deck, retro). Plan 7 implements this. */
export interface Executor {
  apply(ctx: ApplyContext): ExecutorReceipt;
}

export interface RestoreOptions {
  target: SyncTarget;
  registry: DeviceEntry[];
  schemas: ArtifactSchemas;
  secrets: SecretProvider;
  executor: Executor;
  workdir: string;
  savesDest: string;
}

export interface Receipt {
  device: string;
  applied: string[];
  savesRestored: boolean;
}

/**
 * Flow L1 — "point at your target". Pull the config artifact, resolve secrets,
 * resolve the device, apply via the (native) executor, restore saves, and
 * return a receipt. The orchestrator owns the lifecycle; the executor owns the
 * platform-specific apply.
 */
export function restore(opts: RestoreOptions): Receipt {
  opts.target.connect();
  opts.target.pull("config", opts.workdir);
  const { config } = loadArtifact(opts.workdir, opts.schemas);
  const resolved = resolveSecrets(config, opts.secrets);

  const device = opts.registry.find((d) => d.id === resolved.device);
  if (!device) {
    throw new Error(`unknown device "${resolved.device}" — not in the registry`);
  }

  const { actions } = opts.executor.apply({ device, config: resolved });

  const savesRestored = opts.target.list("saves").length > 0;
  if (savesRestored) {
    opts.target.pull("saves", opts.savesDest);
  }

  return { device: resolved.device, applied: actions, savesRestored };
}
