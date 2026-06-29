import type { ProfileSummary } from "@bootible/core";
import { el } from "../lib/dom";

export interface ProfileBarOptions {
  /** Profiles to offer — already filtered to this device (see visibleProfiles). */
  profiles: readonly ProfileSummary[];
  /** The currently-loaded profile, if any (drives Update vs Save-new). */
  loadedName?: string | null;
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
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = o.profiles.length ? "Saved profiles…" : "No saved profiles yet";
  sel.append(placeholder);
  for (const p of o.profiles) {
    const opt = document.createElement("option");
    opt.value = p.name;
    opt.textContent = p.name;
    if (p.name === o.loadedName) opt.selected = true;
    sel.append(opt);
  }

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

  const row = el("div", "profile-bar-row");
  row.append(sel, loadBtn, delBtn, nameInput, saveBtn);

  // Update appears only when a profile is loaded — overwrites that one.
  if (o.loadedName) {
    const updateBtn = btn("update", `Update "${o.loadedName}"`);
    updateBtn.classList.remove("btn-ghost");
    updateBtn.classList.add("btn-primary");
    const loaded = o.loadedName;
    updateBtn.addEventListener("click", () => o.onUpdate(loaded));
    row.append(updateBtn);
  }

  root.append(row);

  const status = el("p", "profile-bar-status", o.status ?? "");
  status.dataset.field = "status";
  root.append(status);

  return root;
}
