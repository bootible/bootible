import type { ProfileSummary } from "@bootible/core";
import { el } from "../lib/dom";

export interface ProfileBarOptions {
  /** Profiles to offer, grouped: `model` (this exact device) shown first, then
   *  `family` (same-family + untagged). See groupProfilesForDevice. */
  profiles: {
    model: readonly ProfileSummary[];
    family: readonly ProfileSummary[];
  };
  /** Optgroup label for the model section, e.g. "This ROG Ally X". */
  modelLabel?: string;
  /** Optgroup label for the family section, e.g. "Other compatible devices". */
  familyLabel?: string;
  /** The currently-loaded profile, if any (drives Update vs Save-new). */
  loadedName?: string | null;
  /** Which controls to show. "load" = pick + Load + Delete (use at the start of the
   *  flow); "save" = name + Save new + Update (use on the last config page, where the
   *  full config exists); "full" = both. Default "full". */
  mode?: "load" | "save" | "full";
  /** Optional status line (e.g. "Saved ✓", "Synced", an error). */
  status?: string;
  onLoad(name: string): void;
  onSaveNew(name: string): void;
  onUpdate(name: string): void;
  onDelete(name: string): void;
}

/**
 * One save/load profile header for every device (cohesion standard U1: same task,
 * same place, same actions). Presentational — each device wires the callbacks to
 * its own capture/apply + the shared save/load/delete IPC + cloud sync. Actions:
 * Load, Save new, Update (only when a profile is loaded), Delete; plus a status line.
 */
export function ProfileBar(o: ProfileBarOptions): HTMLElement {
  const root = el("div", "profile-bar");

  const sel = el("select", "uw-select") as HTMLSelectElement;
  sel.dataset.field = "select";
  const total = o.profiles.model.length + o.profiles.family.length;
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = total ? "Saved profiles…" : "No saved profiles yet";
  sel.append(placeholder);
  const addGroup = (label: string, profiles: readonly ProfileSummary[]): void => {
    if (profiles.length === 0) return;
    const group = document.createElement("optgroup");
    group.label = label;
    for (const p of profiles) {
      const opt = document.createElement("option");
      opt.value = p.name;
      opt.textContent = p.name;
      if (p.name === o.loadedName) opt.selected = true;
      group.append(opt);
    }
    sel.append(group);
  };
  addGroup(o.modelLabel ?? "This device", o.profiles.model);
  addGroup(o.familyLabel ?? "Other compatible devices", o.profiles.family);

  const btn = (action: string, label: string): HTMLButtonElement => {
    const b = el("button", "btn-ghost") as HTMLButtonElement;
    b.type = "button";
    b.dataset.action = action;
    b.textContent = label;
    return b;
  };

  const loadBtn = btn("load", "Load");
  loadBtn.addEventListener("click", () => {
    if (sel.value) o.onLoad(sel.value);
  });
  const delBtn = btn("delete", "Delete");
  delBtn.addEventListener("click", () => {
    if (sel.value) o.onDelete(sel.value);
  });

  const nameInput = el("input", "uw-select") as HTMLInputElement;
  nameInput.type = "text";
  nameInput.dataset.field = "name";
  nameInput.placeholder = "Save current as…";

  const saveBtn = el("button", "btn-primary") as HTMLButtonElement;
  saveBtn.type = "button";
  saveBtn.dataset.action = "save-new";
  saveBtn.textContent = "Save new";
  saveBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    if (name) o.onSaveNew(name);
  });

  const mode = o.mode ?? "full";
  const showLoad = mode === "load" || mode === "full";
  const showSave = mode === "save" || mode === "full";
  const row = el("div", "profile-bar-row");
  // The dropdown is the profile selector for both loading and picking which existing
  // profile to overwrite when saving.
  if (showLoad || showSave) row.append(sel);
  if (showLoad) row.append(loadBtn, delBtn);
  if (showSave) {
    row.append(nameInput, saveBtn);
    // Update — overwrite the selected (or loaded) profile with the current config.
    const updateBtn = btn("update", "Update selected");
    updateBtn.classList.remove("btn-ghost");
    updateBtn.classList.add("btn-primary");
    updateBtn.addEventListener("click", () => {
      const target = sel.value || o.loadedName;
      if (target) o.onUpdate(target);
    });
    row.append(updateBtn);
  }

  root.append(row);

  const status = el("p", "profile-bar-status", o.status ?? "");
  status.dataset.field = "status";
  root.append(status);

  return root;
}
