import { browserApps } from "@bootible/core/browser";
import { el } from "../lib/dom";

/**
 * A "Default browser" <select> listing the browsers the user actually selected to
 * install (Chrome / Firefox / Opera) plus "Don't change". Shared by the ROG account
 * screen and the Deck device-setup screen. Returns null when no browser is selected
 * — there's nothing to choose, so the caller skips the whole section.
 */
export function defaultBrowserSelect(
  selectedAppIds: string[],
  current: string | undefined,
  onChange: (id: string | undefined) => void,
): HTMLSelectElement | null {
  const browsers = browserApps().filter((b) => selectedAppIds.includes(b.id));
  if (browsers.length === 0) return null;
  const sel = el("select", "uw-select") as HTMLSelectElement;
  const none = document.createElement("option");
  none.value = "";
  none.textContent = "Don't change";
  sel.append(none);
  for (const b of browsers) {
    const o = document.createElement("option");
    o.value = b.id;
    o.textContent = b.name;
    if (current === b.id) o.selected = true;
    sel.append(o);
  }
  sel.addEventListener("change", () => onChange(sel.value || undefined));
  return sel;
}
