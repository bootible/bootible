/**
 * Map a Vite `import.meta.glob` of logo SVGs (id.svg → url) to an `{ id: url }`
 * record. Shared so any feature can build its own logo set from its own glob (the
 * source colour is discarded — logos render as CSS masks tinted to the palette).
 */
export function logoMap(mods: Record<string, unknown>): Record<string, string> {
  const m: Record<string, string> = {};
  for (const [path, url] of Object.entries(mods)) {
    const id =
      path
        .split("/")
        .pop()
        ?.replace(/\.svg$/, "") ?? "";
    m[id] = url as string;
  }
  return m;
}
