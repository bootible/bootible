import { el } from "../lib/dom";

/** A full-width config section: a header (with an optional "· N" count) over a
 *  2-column grid of rows. Picker rows and `.cz-span` fields span both columns.
 *  Shared by the ROG customise screen and the Deck config/setup screens so the
 *  page shape is identical across devices. */
export function Section(title: string, rows: HTMLElement[], count?: number): HTMLElement {
  const sec = el("div", "cz-sec");
  const head = el("div", "cz-sec-h", title);
  if (count !== undefined) head.append(el("span", "cz-sec-count", ` · ${count}`));
  const grid = el("div", "cz-sec-rows");
  grid.append(...rows);
  sec.append(head, grid);
  return sec;
}
