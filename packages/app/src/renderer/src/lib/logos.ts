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

// ── Brand / OS / app logo sets — rendered as CSS masks so the source colour
//    (black, white, full-colour) is discarded and everything tints to palette. ──
export const APP_LOGOS = logoMap(
  import.meta.glob("../assets/logos/apps/*.svg", { eager: true, query: "?url", import: "default" }),
);
export const OS_LOGOS = logoMap(
  import.meta.glob("../assets/logos/os/*.svg", { eager: true, query: "?url", import: "default" }),
);
export const DEVICE_LOGOS = logoMap(
  import.meta.glob("../assets/logos/devices/*.svg", {
    eager: true,
    query: "?url",
    import: "default",
  }),
);
/** device id (registry) → brand-logo filename under devices/ */
export const DEVICE_BRAND: Record<string, string> = {
  "rog-ally": "rog",
  "msi-claw": "msi",
  steamdeck: "steam-deck",
  "retroid-pocket": "retroid",
  "ayn-odin": "ayn",
};
/** Logos that are black/dark/low-contrast — render white so they read on the dark UI. */
export const FORCE_WHITE = new Set([
  "7zip",
  "ea",
  "ubisoft",
  "tailscale",
  "retroarch",
  "playnite",
  "obs",
  "epic",
  "gog",
]);
/** Logos that read small (heavy internal padding) — scale up a touch. */
export const LOGO_SCALE = new Set(["handheldcompanion"]);
