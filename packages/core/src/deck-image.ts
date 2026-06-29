/**
 * Resolving the SteamOS recovery image for the full-reimage flow (Path B).
 *
 * Valve publishes images at an open Apache-style directory index. We parse it and
 * pick the newest `.img.zip` (zip, because Windows decompresses it natively — no
 * bz2 dependency). "Newest" = the greatest YYYYMMDD embedded in the filename: the
 * `steamdeck-repair-<date>` / `steamdeck-oobe-repair-<date>` builds carry a date;
 * the legacy `steamdeck-recovery-N` images don't and rank lowest. We never trust
 * a hardcoded filename — the index is the source of truth (see docs/v2/linux).
 */
export const DECK_IMAGE_INDEX = "https://steamdeck-images.steamos.cloud/recovery/";

export interface DeckImage {
  /** Bare filename, e.g. "steamdeck-oobe-repair-20260618.10-3.8.10.img.zip". */
  name: string;
  /** Absolute download URL. */
  url: string;
}

/** Date key embedded in an image filename (YYYYMMDD as a number), or 0 if none. */
function imageDate(name: string): number {
  const m = name.match(/(\d{8})/);
  return m?.[1] ? Number(m[1]) : 0;
}

/**
 * Parse the recovery directory-index HTML and return the newest `.img.zip`, or
 * null if none is present. `baseUrl` resolves the (relative) hrefs in the index.
 */
export function resolveDeckImage(
  indexHtml: string,
  baseUrl: string = DECK_IMAGE_INDEX,
): DeckImage | null {
  const hrefs = [...indexHtml.matchAll(/href="([^"]+\.img\.zip)"/g)]
    .map((m) => m[1])
    .filter((h): h is string => Boolean(h));
  if (hrefs.length === 0) return null;
  const best = hrefs.reduce((a, b) => (imageDate(b) > imageDate(a) ? b : a));
  const name = best.split("/").pop() ?? best;
  return { name, url: new URL(best, baseUrl).href };
}
