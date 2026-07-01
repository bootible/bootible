import { el } from "../lib/dom";

/** A full-width "Choose X (N) →" row that opens a picker screen. Shared by the ROG
 *  customise screen (which sets `data-picker` = a picker mode) and the Deck setup
 *  screen (which sets `data-go` = a route); a delegated click handler acts on it. */
export function PickerRow(
  label: string,
  desc: string,
  count: number,
  nav: { picker?: string; go?: string },
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
  if (nav.picker) pick.dataset.picker = nav.picker;
  if (nav.go) pick.dataset.go = nav.go;
  text.append(pick);
  row.append(text);
  return row;
}
