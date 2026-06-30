import type { AppEntry, AppGroup } from "@bootible/core";
import { GroupedPicker, type PickerItem } from "../../components/GroupedPicker";
import { StatusMessage } from "../../components/StatusMessage";
import { fill } from "../../lib/dom";
import { APP_LOGOS, FORCE_WHITE, LOGO_SCALE, logoEl } from "../../lib/logos";
import { rog } from "../../lib/rog-state";
import { EMU_GROUP, pickCounts } from "./catalog";

// ── app / emulator picker (collapsible groups) ──────────────────────────────
/** An entry is "on" if its winget pick is selected, or — for a module entry like
 *  EmuDeck — its module is enabled. */
function entryOn(a: AppEntry): boolean {
  return a.module ? rog.enabledExtras.has(a.module) : rog.selectedApps.has(a.id);
}

/** The groups shown in the current picker mode (Apps = everything but emulators;
 *  Emulators = just that group). */
function pickerGroups(): AppGroup[] {
  return rog.pickerMode === "emulators"
    ? rog.appGroups.filter((g) => g.id === EMU_GROUP)
    : rog.appGroups.filter((g) => g.id !== EMU_GROUP);
}

/** Map an AppEntry to a shared-picker item, with the ROG app logo. */
function rogAppItem(a: AppEntry): PickerItem {
  let logoCls = "app-logo";
  if (FORCE_WHITE.has(a.id)) logoCls += " force-white";
  if (LOGO_SCALE.has(a.id)) logoCls += " scaled";
  return {
    id: a.id,
    label: a.name,
    sublabel: a.desc ?? a.wingetId ?? "",
    checked: entryOn(a),
    icon: logoEl(APP_LOGOS[a.id], logoCls),
  };
}

/** The "N apps/emulators selected" line under the picker (the GroupedPicker keeps
 *  the per-group heads in sync itself; this is the only thing a toggle must update). */
function refreshAppsCount(): void {
  const count = document.querySelector("#apps-count");
  if (!count) return;
  const n = rog.pickerMode === "emulators" ? pickCounts().emulators : pickCounts().apps;
  const word = rog.pickerMode === "emulators" ? "emulator" : "app";
  count.textContent = `${n} ${word}${n === 1 ? "" : "s"} selected`;
}

/** Apply an AppEntry toggle to the right set (winget app → rog.selectedApps, module
 *  entry like EmuDeck → rog.enabledExtras). */
function applyAppToggle(a: AppEntry, on: boolean): void {
  const set = a.module ? rog.enabledExtras : rog.selectedApps;
  const key = a.module ?? a.id;
  if (on) set.add(key);
  else set.delete(key);
}

function renderApps(): void {
  const host = document.querySelector<HTMLElement>("#apps-body");
  if (!host) return;
  host.replaceChildren(
    GroupedPicker({
      groups: pickerGroups().map((g) => ({
        id: g.id,
        label: g.label,
        note: g.note,
        open: rog.openGroups.has(g.id),
        items: g.apps.map(rogAppItem),
      })),
      onToggleItem: (groupId, itemId, on) => {
        const a = rog.appGroups.find((x) => x.id === groupId)?.apps.find((x) => x.id === itemId);
        if (a) applyAppToggle(a, on);
        refreshAppsCount();
      },
      onToggleGroup: (groupId, on) => {
        const g = rog.appGroups.find((x) => x.id === groupId);
        if (g) for (const a of g.apps) applyAppToggle(a, on);
        refreshAppsCount();
      },
      onToggleOpen: (groupId, open) => {
        if (open) rog.openGroups.add(groupId);
        else rog.openGroups.delete(groupId);
      },
    }),
  );
  fill("apps-title", rog.pickerMode === "emulators" ? "Choose emulators" : "Choose apps");
  refreshAppsCount();
}

export async function hydrateApps(): Promise<void> {
  const api = window.bootible;
  if (!api?.getAppGroups) return;
  const host = document.querySelector<HTMLElement>("#apps-body");
  if (!rog.appsHydrated) {
    host?.replaceChildren(StatusMessage({ kind: "loading", message: "Loading apps…" }));
    try {
      rog.appGroups = await api.getAppGroups();
      rog.appsHydrated = true;
    } catch {
      // A failed app-catalog fetch used to silently render an empty picker — surface it.
      host?.replaceChildren(
        StatusMessage({
          kind: "error",
          message: "Couldn't load the app catalog.",
          onRetry: () => void hydrateApps(),
        }),
      );
      return;
    }
  }
  // On (re)entering the picker, open the groups that have selections — but from
  // here the user's manual expand/collapse (toggle event) is what's respected.
  rog.openGroups.clear();
  for (const g of pickerGroups()) {
    if (rog.pickerMode === "emulators" || g.apps.some(entryOn)) rog.openGroups.add(g.id);
  }
  renderApps();
}
