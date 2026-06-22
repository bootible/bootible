// The base layer — the experience a handheld boots into. A user picks one base
// up front; tuning, apps, and SSH layer on top as modifiers. A base differs from
// the older Bundle only in that it also pins a boot shell. See
// docs/v2/design-base-layer.md.
//
// Drivers and tuning are a UNIVERSAL FLOOR (every base), not a per-base choice:
// every device ends up fully hardware-functional and debloated+tuned. Bases vary
// only in shell + pre-installed software.

/** A base resolves to a boot shell + a software floor (module ids). */
export interface Base {
  id: string;
  label: string;
  /** Outcome-described — what you get, not a list of switches. */
  description: string;
  /** Boot-shell module id, or null for the plain Windows desktop. */
  shell: string | null;
  /** Extra software this base pre-installs (module ids), beyond the floor. */
  software: string[];
  tag?: string;
  recommended?: boolean;
}

/**
 * Applied to every base: debloat + tuning. asus-drivers joins this once driver
 * staging exists (Phase B5) so all hardware works on all four bases — until then
 * bases run on the Wi-Fi driver floor.
 */
export const UNIVERSAL_FLOOR = ["power", "display", "windows-defaults", "optimization"];

export const BASES: Base[] = [
  {
    id: "raw",
    label: "Raw Windows",
    description:
      "A clean, debloated, tuned Windows desktop — a PC you happen to hold. No handheld shell, no extra software.",
    shell: null,
    software: [],
    tag: "minimal",
  },
  {
    id: "steam-bp",
    label: "Raw Windows + Steam Big Picture",
    description:
      "Boots straight into Steam Big Picture as the couch/handheld UI. Steam installed, no ASUS or Xbox software.",
    shell: "steam-bigpicture",
    software: ["steam"],
    tag: "steam",
  },
  {
    id: "xbox",
    label: "Clean Xbox handheld",
    description:
      "Boots into the Xbox console-style full-screen experience, with the hardware fully working — but none of the ASUS software/bloat.",
    shell: "xbox-fullscreen",
    software: [],
    tag: "recommended",
    recommended: true,
  },
  {
    id: "full-rog",
    label: "Full ROG, stripped",
    description:
      "The factory feel — Armoury Crate plus the Xbox shell — but debloated and tuned by bootible, so it's the OG experience better than stock.",
    shell: "xbox-fullscreen",
    software: ["armoury-crate"],
    tag: "factory",
  },
];

export function baseById(id: string | undefined): Base | undefined {
  return BASES.find((b) => b.id === id);
}

/**
 * The full module-id set a base resolves to: the universal floor, the base's
 * pre-installed software, and its boot shell (if any). Unknown/not-yet-built ids
 * (e.g. armoury-crate before Phase B6) are simply skipped by the catalog, so a
 * base degrades gracefully rather than failing.
 */
export function baseModuleIds(base: Base): string[] {
  const ids = [...UNIVERSAL_FLOOR, ...base.software];
  if (base.shell) ids.push(base.shell);
  return [...new Set(ids)];
}
