import "./styles.css";

interface DeviceSummary {
  id: string;
  name: string;
  system: string;
  provisioning: string;
  emulationCount: number;
}

interface GroupSummary {
  group: string;
  label: string;
  description: string;
  moduleCount: number;
  modules: { id: string; name: string }[];
}

interface StepEvent {
  moduleId: string;
  name: string;
  group: string;
  status: "running" | "applied" | "skipped" | "failed";
  detail?: string;
}

interface ProvisionResult {
  applied: number;
  skipped: number;
}

interface BootibleApi {
  version: string;
  getDevice(): Promise<DeviceSummary | null>;
  getCatalog(): Promise<GroupSummary[]>;
  provision(): Promise<ProvisionResult>;
  onProvisionStep(cb: (event: StepEvent) => void): void;
  onProvisionDone(cb: (result: ProvisionResult) => void): void;
}

declare global {
  interface Window {
    bootible?: BootibleApi;
  }
}

const VIEWS = [
  "home",
  "method",
  "setup",
  "review",
  "connect",
  "provision",
  "done",
  "restore",
  "empty",
  "failed",
] as const;
type View = (typeof VIEWS)[number];

function isView(value: string): value is View {
  return (VIEWS as readonly string[]).includes(value);
}

/** Show a view by name, falling back to home for anything unknown. */
function show(view: string): void {
  const next: View = isView(view) ? view : "home";
  document.body.dataset.view = next;
}

/** Drive the active view from the URL hash so screens are deep-linkable. */
function syncFromHash(): void {
  const view = location.hash.replace(/^#/, "") || "home";
  show(view);
  if (view === "provision") startProvision();
}

// Navigation: any [data-go] control sets the hash, which drives the view. A
// [data-method] control also records which provisioning method was chosen.
document.addEventListener("click", (event) => {
  const trigger = (event.target as HTMLElement).closest<HTMLElement>("[data-go]");
  if (!trigger) return;
  const method = trigger.dataset.method;
  if (method === "usb" || method === "export" || method === "device") {
    document.body.dataset.method = method;
  }
  const target = trigger.dataset.go;
  if (target) location.hash = target;
});

// Group toggles on the setup screen flip their own pressed state and update
// the live plan summary.
document.addEventListener("click", (event) => {
  const group = (event.target as HTMLElement).closest<HTMLElement>(".group");
  if (!group) return;
  const on = group.classList.toggle("is-on");
  group.setAttribute("aria-pressed", String(on));
  updateSetupSummary();
});

// Snapshot cards on the restore screen are single-select (radio behaviour).
document.addEventListener("click", (event) => {
  const snap = (event.target as HTMLElement).closest<HTMLElement>(".snap");
  if (!snap) return;
  for (const sibling of snap.parentElement?.querySelectorAll(".snap") ?? []) {
    const selected = sibling === snap;
    sibling.classList.toggle("is-sel", selected);
    sibling.setAttribute("aria-pressed", String(selected));
  }
});

window.addEventListener("hashchange", syncFromHash);

/** Write a value into every [data-field="<field>"] element. */
function fill(field: string, value: string): void {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-field="${field}"]`)) {
    el.textContent = value;
  }
}

// Reflect the real core version in the system bar without clobbering the LED.
const statusText = document.querySelector<HTMLElement>(".sysstatus-text");
if (statusText && window.bootible?.version) {
  statusText.textContent = `${window.bootible.version} · local`;
}

// Hydrate the home screen from the real device the main process detects. In a
// plain browser (no preload) window.bootible is undefined and the mock markup
// stands, which keeps the screens screenshot-able outside Electron.
async function hydrateDevice(): Promise<void> {
  const api = window.bootible;
  if (!api?.getDevice) return;

  let device: DeviceSummary | null;
  try {
    device = await api.getDevice();
  } catch {
    return;
  }

  if (!device) {
    if (!location.hash) show("empty");
    return;
  }

  fill("name", device.name);
  fill("system", device.system);
}

void hydrateDevice();

// ── module catalog ────────────────────────────────────────────────────────
// The setup groups, the review plan and every module count are driven by the
// real catalog the core exposes — no hardcoded "14".

const GROUP_TAGS: Record<string, string> = {
  system: "configure",
  performance: "tune",
  apps: "install",
  library: "link",
};

let catalog: GroupSummary[] = [];

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** "1 step" / "3 steps" — pluralise the step count. */
function steps(n: number): string {
  return `${n} step${n === 1 ? "" : "s"}`;
}

/** Render the setup screen's toggleable group cards from the catalog. */
function renderGroups(): void {
  const container = document.querySelector<HTMLElement>(".groups");
  if (!container) return;

  container.replaceChildren(
    ...catalog.map((group) => {
      const btn = el("button", "group is-on") as HTMLButtonElement;
      btn.type = "button";
      btn.setAttribute("aria-pressed", "true");

      const toggle = el("span", "group-toggle");
      toggle.setAttribute("aria-hidden", "true");

      const main = el("span", "group-main");
      main.append(
        el("span", "group-name", group.label),
        el("span", "group-desc", group.description),
      );

      const meta = el("span", "group-meta");
      meta.append(
        el("span", "group-tag", GROUP_TAGS[group.group] ?? ""),
        el("span", "group-count", steps(group.moduleCount)),
      );

      btn.append(toggle, main, meta);
      return btn;
    }),
  );
}

/** Render the review screen's WILL RUN rows from the catalog. */
function renderReviewPlan(): void {
  const plan = document.querySelector<HTMLElement>(".review-plan");
  if (!plan) return;

  const foot = plan.querySelector(".readout-foot");
  const rows = catalog.map((group) => {
    const row = el("div", "plan-row");
    row.append(
      el("span", "mark"),
      el("span", "plan-name", group.label),
      el("span", "plan-n", steps(group.moduleCount)),
    );
    return row;
  });

  plan.replaceChildren(...rows);
  if (foot) plan.append(foot);
}

/** Reflect which groups are toggled on in the setup summary rail. */
function updateSetupSummary(): void {
  const cards = [...document.querySelectorAll<HTMLElement>(".groups .group")];
  let stepsOn = 0;
  let groupsOn = 0;
  cards.forEach((card, i) => {
    if (card.classList.contains("is-on")) {
      groupsOn += 1;
      stepsOn += catalog[i]?.moduleCount ?? 0;
    }
  });
  fill("groups-summary", `${groupsOn} of ${catalog.length} on`);
  fill("steps-summary", `${stepsOn} to run`);
}

async function hydrateCatalog(): Promise<void> {
  const api = window.bootible;
  if (!api?.getCatalog) return;

  try {
    catalog = await api.getCatalog();
  } catch {
    return;
  }
  if (catalog.length === 0) return;

  const total = catalog.reduce((sum, group) => sum + group.moduleCount, 0);
  fill("module-total", String(total));
  fill("modules-ready", `${total} modules ready`);
  renderGroups();
  renderReviewPlan();
  updateSetupSummary();
}

void hydrateCatalog();

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
  return catalog.reduce((sum, group) => sum + group.moduleCount, 0) || provisionLines.size || 1;
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

function startProvision(): void {
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

// First render — run after all declarations so deep-linking #provision is safe.
syncFromHash();
