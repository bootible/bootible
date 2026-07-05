import { generateDeckProvision } from "@bootible/core";
import type { DeckConfig } from "@bootible/core";

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
  return generateDeckProvision(withTiKey(cfg) as DeckConfig);
}
