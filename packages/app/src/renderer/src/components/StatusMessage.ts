import { el } from "../lib/dom";

export type AsyncStatus =
  | { kind: "loading"; message?: string }
  | { kind: "empty"; message: string }
  | { kind: "error"; message: string; retryLabel?: string; onRetry?: () => void };

/**
 * The shared loading / empty / error-with-retry surface (ui-ux standard §4: every
 * async surface has four states — "populated" is the caller's own content; this
 * owns the other three). A failure is never rendered as an empty success: an error
 * shows its message plus an optional Retry. Used by DiskPicker, the app picker, and
 * any data-backed section, so the three states look and behave the same everywhere.
 */
export function StatusMessage(status: AsyncStatus): HTMLElement {
  const root = el("div", `status-msg status-${status.kind}`);
  root.setAttribute("role", "status");

  if (status.kind === "loading") {
    root.append(
      el("span", "status-spinner", ""),
      el("span", "status-text", status.message ?? "Loading…"),
    );
    return root;
  }

  root.append(el("span", "status-text", status.message));

  if (status.kind === "error" && status.onRetry) {
    const btn = el(
      "button",
      "btn-ghost status-retry",
      status.retryLabel ?? "Retry",
    ) as HTMLButtonElement;
    btn.type = "button";
    btn.addEventListener("click", () => status.onRetry?.());
    root.append(btn);
  }

  return root;
}
