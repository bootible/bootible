import type { BasePlan, PlanModule, RemovalEntry } from "@bootible/core";
import { StatusMessage } from "../../components/StatusMessage";
import { el, fill } from "../../lib/dom";
import { rog } from "../../lib/rog-state";
import { pickCounts } from "./catalog";
import { mountRogProfileBar } from "./profiles";

// ── review & customise screen ───────────────────────────────────────────────
const FLOOR_WARNING = "Not recommended — every bootible device is meant to be tuned & debloated.";

// The resolved base plan (floor/base/extras) for the chosen base.
let basePlan: BasePlan | null = null;
// Full ROG opt-in removals (off until ticked) — read by the customise screen and the
// apply-on-device flow (exported for the watch screen).
export let removalsCatalog: RemovalEntry[] = [];

/** One toggle row on the customise screen. Floor/base are checked by default
 *  (untick → rog.disabledModules); extras are unchecked (tick → rog.enabledExtras). */
function customiseRow(m: PlanModule, kind: "floor" | "base" | "extra"): HTMLElement {
  const isApps = m.id === "apps";
  const checked = kind === "extra" ? rog.enabledExtras.has(m.id) : !rog.disabledModules.has(m.id);
  const row = el("div", `cz-row${checked ? "" : " is-off"}`);
  const cb = el("input", "cz-check") as HTMLInputElement;
  cb.type = "checkbox";
  cb.checked = checked;
  cb.dataset.moduleId = m.id;
  cb.dataset.kind = kind;
  const text = el("div", "cz-text");
  text.append(el("div", "cz-name", m.name));
  if (m.description) text.append(el("div", "cz-desc", m.description));
  if (m.changes) text.append(el("div", "cz-chg", m.changes));
  if (kind === "floor" && !checked) text.append(el("div", "cz-warn", `⚠ ${FLOOR_WARNING}`));
  if (isApps && checked) {
    const pick = el(
      "button",
      "cz-applink",
      `Choose apps (${rog.selectedApps.size}) →`,
    ) as HTMLButtonElement;
    pick.type = "button";
    pick.dataset.go = "apps";
    text.append(pick);
  }
  row.append(cb, text);
  return row;
}

function section(title: string, count: number, rows: HTMLElement[]): HTMLElement {
  const sec = el("div", "cz-sec");
  const head = el("div", "cz-sec-h", title);
  head.append(el("span", "cz-sec-count", ` · ${count}`));
  // Cards lay out 2-up inside a full-width section (the shared .cz-sec-rows grid,
  // same as the Deck) so the page shape is identical across bases.
  const grid = el("div", "cz-sec-rows");
  grid.append(...rows);
  sec.append(head, grid);
  return sec;
}

export function renderCustomise(): void {
  const host = document.querySelector<HTMLElement>("#customise-body");
  if (!host || !basePlan) return;
  // Show which base this is — easy to forget if you step away and come back.
  const baseLabel =
    rog.baseOptions.find((b) => b.id === rog.selectedBaseId)?.label ?? rog.selectedBaseId;
  fill("customise-base", baseLabel ? ` · ${baseLabel}` : "");
  const secs: HTMLElement[] = [];
  secs.push(
    section(
      "Always — the floor",
      basePlan.floor.length,
      basePlan.floor.map((m) => customiseRow(m, "floor")),
    ),
  );
  if (basePlan.base.length) {
    secs.push(
      section(
        "From your base",
        basePlan.base.length,
        basePlan.base.map((m) => customiseRow(m, "base")),
      ),
    );
  }
  const extraRows = basePlan.extras.map((m) => customiseRow(m, "extra"));
  const counts = pickCounts();
  extraRows.push(
    pickerRow("Apps", "Browsers, comms, launchers, dev tools, VPNs & more.", counts.apps, "apps"),
    pickerRow(
      "Emulators",
      "EmuDeck, RetroArch and per-system emulators.",
      counts.emulators,
      "emulators",
    ),
  );
  secs.push(section("Add extras", basePlan.extras.length + 2, extraRows));
  // Opt-in "Remove apps" checklist (generic Windows bloat/trialware) — offered on
  // every Windows base, not just Full ROG.
  if (removalsCatalog.length) {
    secs.push(removalsSection());
  }
  host.replaceChildren(...secs);
  // Running summary.
  const floorOn = basePlan.floor.filter((m) => !rog.disabledModules.has(m.id)).length;
  const baseOn = basePlan.base.filter((m) => !rog.disabledModules.has(m.id)).length;
  const extrasOn = rog.enabledExtras.size + rog.selectedApps.size;
  const sum = document.querySelector("#customise-summary");
  if (sum) {
    sum.textContent = `${floorOn + baseOn + extrasOn} things will run · ${floorOn} core · ${baseOn} base · ${extrasOn} extras`;
  }
}

/** The Full ROG opt-in removals checklist — a collapsible block of checkboxes,
 *  off by default (nothing removed unless ticked), with a "Select recommended"
 *  shortcut. Drives config.settings.strip_removals. */
function removalsSection(): HTMLElement {
  const details = el("details", "app-group cz-removals") as HTMLDetailsElement;
  // Collapsed by default even when pre-ticked — the "22 / 23" count shows the
  // recommended set is selected; expand to review/untick individual apps.
  const summary = el("summary", "app-group-sum");
  summary.append(
    el("span", "app-group-name", "Remove apps (optional)"),
    el(
      "span",
      `app-group-count${rog.selectedRemovals.size > 0 ? " on" : ""}`,
      `${rog.selectedRemovals.size} / ${removalsCatalog.length}`,
    ),
  );
  const body = el("div", "app-items");
  const note = el(
    "p",
    "app-note",
    "Recommended bloat & trialware is pre-ticked — untick anything you want to keep. Phone Link is kept by default.",
  );
  const rec = el("button", "cz-applink", "Select recommended") as HTMLButtonElement;
  rec.type = "button";
  rec.dataset.removalsRec = "1";
  body.append(note, rec);
  for (const r of removalsCatalog) {
    const row = el("label", "app-row");
    const cb = el("input", "app-check") as HTMLInputElement;
    cb.type = "checkbox";
    cb.dataset.removal = r.id;
    cb.checked = rog.selectedRemovals.has(r.id);
    const meta = el("span", "app-meta");
    const name = el("span", "app-name", r.name);
    if (r.recommended) name.append(el("span", "cz-rec-tag", "Recommended"));
    meta.append(name);
    if (r.note) meta.append(el("span", "app-id", r.note));
    row.append(cb, meta);
    body.append(row);
  }
  details.append(summary, body);
  return details;
}

/** A Review row that opens a picker (Apps / Emulators), showing the live count. */
function pickerRow(
  label: string,
  desc: string,
  count: number,
  mode: "apps" | "emulators",
): HTMLElement {
  const row = el("div", "cz-row cz-picker");
  const text = el("div", "cz-text");
  text.append(el("div", "cz-name", label), el("div", "cz-desc", desc));
  const pick = el(
    "button",
    "cz-applink",
    `Choose ${label.toLowerCase()} (${count}) →`,
  ) as HTMLButtonElement;
  pick.type = "button";
  pick.dataset.picker = mode;
  text.append(pick);
  row.append(text);
  return row;
}

/** Fetch the base's plan once per base, then render the customise screen. */
export async function hydrateCustomise(): Promise<void> {
  const api = window.bootible;
  if (!api?.getBasePlan || !rog.selectedBaseId) return;
  // A fresh base entry (not a just-loaded profile) gets the base's baked defaults.
  const freshEntry = !rog.customiseHydrated && !rog.keepRestoredCustomise;
  if (!rog.customiseHydrated) {
    try {
      basePlan = await api.getBasePlan(rog.selectedBaseId);
    } catch {
      basePlan = null;
    }
    // No plan → the customise body would render blank. Surface it with a retry and
    // leave customiseHydrated false so retrying re-fetches.
    if (!basePlan) {
      document.querySelector<HTMLElement>("#customise-body")?.replaceChildren(
        StatusMessage({
          kind: "error",
          message: "Couldn't load the plan for this base.",
          onRetry: () => void hydrateCustomise(),
        }),
      );
      return;
    }
    // Fresh base entry resets toggles; a just-loaded profile keeps its restored ones.
    if (!rog.keepRestoredCustomise) {
      rog.disabledModules.clear();
      rog.enabledExtras.clear();
    }
    rog.keepRestoredCustomise = false;
    rog.customiseHydrated = true;
  }
  void mountRogProfileBar("load"); // pick a saved profile to start from
  // The Apps/Emulators counts need the app groups loaded.
  if (!rog.appGroups.length && api.getAppGroups) {
    try {
      rog.appGroups = await api.getAppGroups();
    } catch {}
  }
  // Base labels for the screen header (cached by the base picker; fetch if the
  // user deep-linked straight here).
  if (!rog.baseOptions.length && api.getBases) {
    try {
      rog.baseOptions = await api.getBases();
    } catch {}
  }
  // Load the removal catalog for the "Remove apps" checklist (every Windows base).
  if (!removalsCatalog.length && api.getRemovals) {
    try {
      removalsCatalog = await api.getRemovals();
    } catch {}
  }
  // Baked-profile default: a fresh base entry pre-ticks the recommended removals
  // (the user reviews + unticks anything to keep — not a silent nuke). A restored
  // profile keeps exactly the removals it saved.
  if (freshEntry) {
    rog.selectedRemovals.clear();
    for (const r of removalsCatalog) if (r.recommended) rog.selectedRemovals.add(r.id);
  }
  renderCustomise();
}
