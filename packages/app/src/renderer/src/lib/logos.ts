import { el } from "./dom";

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

/** An `<img>` of a brand logo (full colour), or a blank `.no-logo` span. */
export function logoEl(url: string | undefined, cls: string): HTMLElement {
  if (!url) return el("span", `${cls} no-logo`);
  const img = el("img", cls) as HTMLImageElement;
  img.src = url;
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";
  return img;
}
