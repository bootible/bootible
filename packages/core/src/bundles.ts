import type { BootibleModule } from "./modules";

/**
 * A named, outcome-described preset that selects a set of modules. Bundles are
 * the "set it up for me" path: the user picks one by what they get, not by
 * ticking individual switches. Each device declares its own bundles, so the
 * generic UI works for any device.
 */
export interface Bundle {
  id: string;
  name: string;
  /** Outcome-framed: what you get, not a list of contents. */
  description: string;
  tag: string;
  recommended?: boolean;
  /** Module ids this preset turns on (real modules only — never planned). */
  moduleIds: string[];
}

/** Resolve a bundle's module ids against a catalog, preserving catalog order. */
export function bundleModules(bundle: Bundle, catalog: BootibleModule[]): BootibleModule[] {
  const ids = new Set(bundle.moduleIds);
  return catalog.filter((module) => ids.has(module.id));
}
