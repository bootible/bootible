import {
  allyExecutor,
  buildDeckBundle,
  buildUsbBundle,
  generateAutounattend,
  generateDeckProvision,
} from "@bootible/core";
import type { AutounattendConfig, BundleFile, DeckConfig, UsbBuildSpec } from "@bootible/core";

export const TI_PUBKEY =
  "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAID8/PsgGbtGk4JZITuqWoW8i/99tAhgsIGRcUsDs7ycO ti test infrastructure";

/** Guarantee the ti test key is authorized so bootible's authorized_keys rewrite
 *  doesn't lock the harness out of the guest. */
export function withTiKey(cfg: Partial<DeckConfig>): Partial<DeckConfig> {
  const ssh = cfg.ssh ?? { enabled: true, port: 22, authorizedKeys: [] };
  const keys = new Set([...(ssh.authorizedKeys ?? []), TI_PUBKEY]);
  return { ...cfg, ssh: { ...ssh, enabled: true, authorizedKeys: [...keys] } };
}

export function genDeckProvision(cfg: Partial<DeckConfig>): string {
  return generateDeckProvision(withTiKey(cfg));
}

/** Assemble the ROG Ally USB bundle via the real Windows executor (allyExecutor) —
 *  deterministic string generation, no actual system commands run. */
export function genUsbBundle(spec: UsbBuildSpec): BundleFile[] {
  return buildUsbBundle(spec, allyExecutor);
}

export function genAutounattend(cfg: AutounattendConfig): string {
  return generateAutounattend(cfg);
}

/** Assemble the Steam Deck USB bundle, always with the ti test key baked in
 *  (see withTiKey) so the harness never locks itself out of the guest. */
export function genDeckBundle(cfg: Partial<DeckConfig>): BundleFile[] {
  return buildDeckBundle(withTiKey(cfg));
}
