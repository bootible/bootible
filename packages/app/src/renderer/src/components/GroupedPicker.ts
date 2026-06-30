import { el } from "../lib/dom";

export interface PickerItem {
  id: string;
  label: string;
  /** Secondary line (winget id / short description). */
  sublabel?: string;
  checked: boolean;
  /** Optional pre-built icon/logo node (the ROG app logos; the Deck passes none). */
  icon?: HTMLElement;
}

export interface PickerGroup {
  id: string;
  label: string;
  /** A footnote shown under the group's items. */
  note?: string;
  /** Start expanded. */
  open?: boolean;
  items: readonly PickerItem[];
}

export interface GroupedPickerOptions {
  groups: readonly PickerGroup[];
  /** A single item's checkbox was toggled. */
  onToggleItem(groupId: string, itemId: string, on: boolean): void;
  /** A group's select-all header was toggled. */
  onToggleGroup(groupId: string, on: boolean): void;
  /** A group was expanded/collapsed (e.g. to persist open state across re-mounts). */
  onToggleOpen?(groupId: string, open: boolean): void;
}

/**
 * A collapsible grouped checkbox picker shared by the ROG + Deck app/category
 * pickers — the last hand-built-per-device duplication (ROG `appGroupNode` vs the
 * Deck's inline `renderDeckApps`). Each group has a select-all header with a live
 * "n / total" count + indeterminate state, kept in sync INTERNALLY so the call site
 * never re-renders on a toggle (which would lose the user's expand/collapse) — it
 * just updates its own state + counts via the callbacks. Items carry an optional
 * icon node (ROG logos). Keeps the existing `app-*` class names, so styling is shared.
 */
export function GroupedPicker(o: GroupedPickerOptions): HTMLElement {
  const root = el("div", "grouped-picker");
  for (const group of o.groups) root.append(groupNode(group, o));
  return root;
}

function groupNode(group: PickerGroup, o: GroupedPickerOptions): HTMLElement {
  const details = el("details", "app-group") as HTMLDetailsElement;
  details.dataset.group = group.id;
  details.open = Boolean(group.open);
  details.addEventListener("toggle", () => o.onToggleOpen?.(group.id, details.open));

  const gcb = el("input", "app-group-check") as HTMLInputElement;
  gcb.type = "checkbox";
  gcb.dataset.group = group.id;
  // A click on the header checkbox must not also collapse the <summary>.
  gcb.addEventListener("click", (e) => e.stopPropagation());
  const countEl = el("span", "app-group-count", "");

  const items = el("div", "app-items");
  const checks: HTMLInputElement[] = [];

  const refreshHead = (): void => {
    const n = checks.filter((c) => c.checked).length;
    gcb.checked = n > 0 && n === checks.length;
    gcb.indeterminate = n > 0 && n < checks.length;
    countEl.textContent = `${n} / ${checks.length}`;
    countEl.classList.toggle("on", n > 0);
  };

  for (const it of group.items) {
    const row = el("label", "app-row");
    const cb = el("input", "app-check") as HTMLInputElement;
    cb.type = "checkbox";
    cb.dataset.item = it.id;
    cb.checked = it.checked;
    cb.addEventListener("change", () => {
      o.onToggleItem(group.id, it.id, cb.checked);
      refreshHead();
    });
    row.append(cb);
    if (it.icon) row.append(it.icon);
    const meta = el("span", "app-meta");
    meta.append(el("span", "app-name", it.label));
    if (it.sublabel) meta.append(el("span", "app-id", it.sublabel));
    row.append(meta);
    items.append(row);
    checks.push(cb);
  }

  gcb.addEventListener("change", () => {
    for (const c of checks) c.checked = gcb.checked;
    o.onToggleGroup(group.id, gcb.checked);
    refreshHead();
  });

  if (group.note) items.append(el("p", "app-note", group.note));

  const summary = el("summary", "app-group-sum");
  summary.append(gcb, el("span", "app-group-name", group.label), countEl);
  details.append(summary, items);
  refreshHead();
  return details;
}
