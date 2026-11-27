/**
 * What the most recent build baked in, shared by the USB / strip-kit / Deck
 * writers (which set it) and discovery + Verify (which read it). One object so
 * those modules share a single source rather than each owning a `let`.
 */
export const lastBuild = {
  /** The build token baked into the most recent USB; matched against beacons so we
   *  know which discovered device is the one we just built. */
  id: "",
  /** Remembered from the last build so Verify can SSH in with no prompts: the local
   *  account name, the private key matching a chosen public key, and the hostname
   *  (for the `ssh <hostname>` alias). */
  username: "",
  identity: "",
  hostname: "",
};

/** A valid Windows computer name from arbitrary input: alphanumeric + hyphen,
 *  <=15 chars. Empty if nothing usable. */
export function sanitizeHostname(raw: string | undefined): string {
  return (raw ?? "")
    .trim()
    .replace(/[^A-Za-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 15);
}
