import type { UsbProgress } from "@bootible/core";

/**
 * Update a write-progress panel from a UsbProgress event. The three media writers
 * (ROG USB install, Deck provision, Deck reimage) each own a static panel with the
 * same shape — `#<prefix>-msg`, `#<prefix>-fill`, `#<prefix>-pct` — so this shared
 * updater renders all of them; only the id prefix, the "done" line, and the
 * post-completion action differ (handled by the caller).
 */
export function renderProgress(prefix: string, event: UsbProgress, doneText: string): void {
  const msg = document.querySelector(`#${prefix}-msg`);
  const fill = document.querySelector<HTMLElement>(`#${prefix}-fill`);
  const pct = document.querySelector(`#${prefix}-pct`);
  if (msg) msg.textContent = event.message;
  if (fill) fill.style.width = `${event.pct}%`;
  if (pct) {
    pct.textContent =
      event.status === "error"
        ? "Failed — see the message above."
        : event.status === "done"
          ? doneText
          : `${event.pct}% — keep the app open.`;
  }
}
