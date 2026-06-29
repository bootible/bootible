// The Windows app-picker catalog — now a DERIVED VIEW of the unified CATALOG
// (catalog.ts). Every Windows-installable app (a winget id, or a bootible module
// like EmuDeck) is grouped by category for the picker; each selected app becomes
// a winget install on the device.

import { type CatalogApp, catalogApp, groupByCategory, windowsCatalog } from "./catalog";
import { getWingetInstallCommands } from "./winget";

export interface AppEntry {
  /** Stable slug used in config (settings.selected_apps). */
  id: string;
  name: string;
  /** winget package id installed on the device. Omitted for module-driven entries. */
  wingetId?: string;
  /** A bootible module id this entry enables instead of a winget install (EmuDeck). */
  module?: string;
  /** "msstore" for Microsoft Store-only apps (product-id installs). */
  source?: "msstore";
  desc?: string;
  recommended?: boolean;
}

export interface AppGroup {
  id: string;
  label: string;
  apps: AppEntry[];
  note?: string;
}

/** Project a unified catalog entry onto the Windows AppEntry shape. */
function toAppEntry(a: CatalogApp): AppEntry {
  return {
    id: a.id,
    name: a.name,
    wingetId: a.winget?.id,
    module: a.module,
    source: a.winget?.source,
    desc: a.desc,
    recommended: a.recommended,
  };
}

/** The Windows app picker, grouped by category — derived from CATALOG. */
export const APP_GROUPS: AppGroup[] = groupByCategory(windowsCatalog()).map((g) => ({
  id: g.meta.id,
  label: g.meta.label,
  note: g.meta.note,
  apps: g.apps.map(toAppEntry),
}));

/** Resolve selected app slugs to their winget package ids (unknown ids dropped). */
export function appWingetIds(selected: string[]): string[] {
  return selected.map((id) => catalogApp(id)?.winget?.id).filter((w): w is string => Boolean(w));
}

/** Install command arrays for the selected app slugs — default winget source, or
 *  `--source msstore` for Store-only apps. Module-driven entries are skipped. */
export function getSelectedAppCommands(selected: string[]): string[][] {
  const cmds: string[][] = [];
  for (const slug of selected) {
    const winget = catalogApp(slug)?.winget;
    if (!winget) continue; // unknown, or a module-driven entry (e.g. EmuDeck)
    if (winget.source === "msstore") {
      cmds.push([
        "winget",
        "install",
        "--id",
        winget.id,
        "--source",
        "msstore",
        "--accept-source-agreements",
        "--accept-package-agreements",
        "--silent",
      ]);
    } else {
      const c = getWingetInstallCommands([winget.id])[0];
      if (c) cmds.push(c);
    }
  }
  return cmds;
}
