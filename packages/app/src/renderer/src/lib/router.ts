// The hash router, decoupled from every feature. It owns the view list, view
// switching, and the device-pick guard; features register a handler per view via
// registerRoute() and reach navigation via syncFromHash() — so the router imports
// no feature, and a feature (auth, ROG, …) can import the router without a cycle.
import { needsDevicePick } from "./nav";
import { session } from "./session";

export const VIEWS = [
  "welcome",
  "synckey",
  "verifymail",
  "twofa",
  "twofasetup",
  "platform",
  "devices",
  "home",
  "base",
  "customise",
  "apps",
  "build",
  "bundles",
  "setup",
  "account",
  "wifi",
  "review",
  "deck",
  "decksetup",
  "deckapps",
  "deckemu",
  "deckplugins",
  "deckpm",
  "deckmethod",
  "deckwrite",
  "deckreimage",
  "watch",
  "connect",
  "provision",
  "done",
  "empty",
  "failed",
] as const;
export type View = (typeof VIEWS)[number];

function isView(value: string): value is View {
  return (VIEWS as readonly string[]).includes(value);
}

/** Show a view by name, falling back to home for anything unknown. */
function show(view: string): void {
  const next: View = isView(view) ? view : "home";
  document.body.dataset.view = next;
  // Always land at the top of the new screen (Continue used to drop you mid-page).
  requestAnimationFrame(() => {
    document.querySelector(".views")?.scrollTo({ top: 0 });
    document.querySelector<HTMLElement>(`.view[data-view="${next}"]`)?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  });
}

// view → on-enter handler. A view with no handler is just shown (its interactions
// are wired by global listeners elsewhere).
const routes = new Map<View, () => void>();

/** Register a feature's on-enter handler for a view. */
export function registerRoute(view: View, handler: () => void): void {
  routes.set(view, handler);
}

/** Drive the active view from the URL hash so screens are deep-linkable. */
export function syncFromHash(): void {
  const view = location.hash.replace(/^#/, "") || "welcome";
  // Device-dependent screens reached by deep link / reload have lost session.deviceId
  // (and the desktop builder can't auto-detect a handheld) — send the user to pick a
  // device first so customise is never device-less. See needsDevicePick.
  if (needsDevicePick(view, session.deviceId)) {
    location.hash = "platform";
    return;
  }
  show(view);
  if (isView(view)) routes.get(view)?.();
}

window.addEventListener("hashchange", syncFromHash);
