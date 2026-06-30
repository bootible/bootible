import type { ProvisioningMethod, ProvisionResult, StepEvent } from "@bootible/core";
import { el } from "../../lib/dom";
import { rog } from "../../lib/rog-state";

// ── method selector (data-driven from the device's provisioning_models) ──────
const METHOD_ICONS: Record<string, string> = {
  usb: "▤",
  export: "▦",
  device: "▣",
  android: "▥",
  guided: "◆",
};

async function hydrateMethods(): Promise<void> {
  const api = window.bootible;
  if (!api?.getMethods) return; // browser: keep the static Ally cards

  let methods: ProvisioningMethod[];
  try {
    methods = await api.getMethods();
  } catch {
    return;
  }
  const list = document.querySelector<HTMLElement>('.view[data-view="method"] .method-list');
  if (!list || methods.length === 0) return;

  list.replaceChildren(
    ...methods.map((method) => {
      const btn = el("button", "method-card") as HTMLButtonElement;
      btn.type = "button";
      btn.dataset.method = method.id;
      // USB needs the account + WiFi steps first; the rest go straight to review.
      btn.dataset.go = method.id === "usb" ? "account" : "review";

      const icon = el("span", "method-icon", METHOD_ICONS[method.id] ?? "▤");
      icon.setAttribute("aria-hidden", "true");

      const main = el("span", "method-main");
      main.append(
        el("span", "method-name", method.label),
        el("span", "method-desc", method.description),
      );

      const meta = el("span", "method-meta");
      const arrow = el("span", "arrow", "→");
      arrow.setAttribute("aria-hidden", "true");
      meta.append(el("span", "group-tag", method.tag), arrow);

      btn.append(icon, main, meta);
      return btn;
    }),
  );
}

void hydrateMethods();

// ── provisioning (dry run) ─────────────────────────────────────────────────
// Entering #provision streams real module step events from the executor into
// the live log. It is a dry run: nothing is written to the device.

const STATE_CLASS: Record<string, string> = {
  running: "is-run",
  applied: "is-done",
  skipped: "is-wait",
  failed: "is-fail",
};
const STATE_LABEL: Record<string, string> = {
  running: "running",
  applied: "done",
  skipped: "skipped",
  failed: "failed",
};

const provisionLines = new Map<string, HTMLElement>();
let provisionDone = 0;
let provisioning = false;

function provisionEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.view[data-view="provision"]');
}

function provisionTotal(): number {
  return rog.catalog.reduce((sum, group) => sum + group.moduleCount, 0) || provisionLines.size || 1;
}

function resetProvision(): void {
  const view = provisionEl();
  if (!view) return;
  provisionLines.clear();
  provisionDone = 0;
  view.querySelector(".log")?.replaceChildren();
  const now = view.querySelector(".provision-now");
  if (now) now.textContent = "Starting dry run…";
  const fill = view.querySelector<HTMLElement>(".progress-fill");
  if (fill) fill.style.width = "0%";
  const meta = view.querySelector(".progress-meta");
  if (meta) meta.textContent = "Dry run — nothing is written to your device.";
}

function onProvisionStep(event: StepEvent): void {
  const view = provisionEl();
  const log = view?.querySelector(".log");
  if (!view || !log) return;

  let line = provisionLines.get(event.moduleId);
  if (!line) {
    line = el("div", "logline");
    line.append(
      el("span", "logmark"),
      el("span", "logname", event.name),
      el("span", "logstate", ""),
    );
    provisionLines.set(event.moduleId, line);
    log.append(line);
  }

  line.classList.remove("is-run", "is-done", "is-wait", "is-fail");
  line.classList.add(STATE_CLASS[event.status] ?? "is-wait");
  const state = line.querySelector(".logstate");
  if (state) state.textContent = STATE_LABEL[event.status] ?? event.status;

  if (event.status === "running") {
    const now = view.querySelector(".provision-now");
    if (now) now.textContent = event.name;
    return;
  }

  provisionDone += 1;
  const total = provisionTotal();
  const fill = view.querySelector<HTMLElement>(".progress-fill");
  if (fill) fill.style.width = `${Math.round((provisionDone / total) * 100)}%`;
  const meta = view.querySelector(".progress-meta");
  if (meta) meta.textContent = `Step ${provisionDone} of ${total} — dry run, nothing is written.`;
}

function onProvisionDone(result: ProvisionResult): void {
  const view = provisionEl();
  const now = view?.querySelector(".provision-now");
  if (now) {
    now.textContent = `Dry run complete — ${result.applied} applied, ${result.skipped} planned.`;
  }
  window.setTimeout(() => {
    if (document.body.dataset.view === "provision") location.hash = "done";
  }, 1200);
}

export function startProvision(): void {
  const api = window.bootible;
  if (!api?.provision || provisioning) return; // browser: keep the mock log
  provisioning = true;
  resetProvision();
  api
    .provision()
    .catch(() => {})
    .finally(() => {
      provisioning = false;
    });
}

window.bootible?.onProvisionStep?.(onProvisionStep);
window.bootible?.onProvisionDone?.(onProvisionDone);
