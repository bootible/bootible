import { el } from "../lib/dom";

export interface ToggleRowOptions {
  label: string;
  checked: boolean;
  desc?: string;
  /** A "what it changes" line under the description. */
  changes?: string;
  /** Inline change handler (the Deck style). When given, the row is a `<label>` and
   *  toggles its own `is-off` class; when omitted, the row is a `<div>` whose
   *  checkbox carries `data` for a delegated handler (the ROG customise style). */
  onChange?: (on: boolean) => void;
  /** `data-*` attributes to set on the checkbox (for delegated handlers). */
  data?: Record<string, string>;
  /** Extra nodes appended into the text column (a floor warning, an "open picker"
   *  sub-link, …). */
  extra?: HTMLElement[];
}

/** A checkbox config row: `cz-row` with a `cz-check` box and a `cz-text` column
 *  (name / description / changes). The single source for the ROG customise rows
 *  and the Deck config toggles so both screens look and behave identically. */
export function ToggleRow(o: ToggleRowOptions): HTMLElement {
  const row = el(o.onChange ? "label" : "div", `cz-row${o.checked ? "" : " is-off"}`);
  const cb = el("input", "cz-check") as HTMLInputElement;
  cb.type = "checkbox";
  cb.checked = o.checked;
  if (o.data) for (const [k, v] of Object.entries(o.data)) cb.dataset[k] = v;
  if (o.onChange) {
    cb.addEventListener("change", () => {
      row.classList.toggle("is-off", !cb.checked);
      o.onChange?.(cb.checked);
    });
  }
  const text = el("div", "cz-text");
  text.append(el("div", "cz-name", o.label));
  if (o.desc) text.append(el("div", "cz-desc", o.desc));
  if (o.changes) text.append(el("div", "cz-chg", o.changes));
  if (o.extra) text.append(...o.extra);
  row.append(cb, text);
  return row;
}
