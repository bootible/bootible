import "./styles.css";

interface DeviceSummary {
  id: string;
  name: string;
  system: string;
  provisioning: string;
  emulationCount: number;
}

interface ModuleSummary {
  id: string;
  name: string;
  description: string;
  changes?: string;
  planned: boolean;
}

interface GroupSummary {
  group: string;
  label: string;
  description: string;
  moduleCount: number;
  modules: ModuleSummary[];
}

interface Bundle {
  id: string;
  name: string;
  description: string;
  tag: string;
  recommended?: boolean;
  moduleIds: string[];
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

interface UsbBuildRequest {
  modules: string[];
  account: { mode: "local" | "microsoft"; username?: string; password?: string };
  wifi?: { ssid: string; password: string };
}

interface ModuleStateReport {
  id: string;
  name: string;
  group: string;
  state: "applied" | "pending" | "unknown";
}

interface ProvisioningMethod {
  id: string;
  label: string;
  description: string;
  tag: string;
}

interface BootibleApi {
  version: string;
  getDevice(): Promise<DeviceSummary | null>;
  getCatalog(): Promise<GroupSummary[]>;
  getBundles(): Promise<Bundle[]>;
  getState(): Promise<ModuleStateReport[]>;
  getMethods(): Promise<ProvisioningMethod[]>;
  provision(): Promise<ProvisionResult>;
  onProvisionStep(cb: (event: StepEvent) => void): void;
  onProvisionDone(cb: (result: ProvisionResult) => void): void;
  exportConfig(modules: string[]): Promise<{ path: string } | null>;
  buildUsb(req: UsbBuildRequest): Promise<{ stagingPath: string; command: string } | null>;
  openPath(path: string): Promise<string>;
  applyDevice(req: UsbBuildRequest): Promise<{ status: "blocked" | "cancelled" | "launched" }>;
}

declare global {
  interface Window {
    bootible?: BootibleApi;
  }
}

const VIEWS = [
  "home",
  "persona",
  "bundles",
  "method",
  "setup",
  "account",
  "wifi",
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

const APPLY_LABELS: Record<string, string> = {
  usb: "Build USB",
  export: "Export config",
  device: "Apply now",
};

/** Set the review screen's primary-button label to match the chosen method. */
function setApplyLabel(): void {
  const method = document.body.dataset.method ?? "device";
  fill("apply-label", APPLY_LABELS[method] ?? "Apply");
}

/** Drive the active view from the URL hash so screens are deep-linkable. */
function syncFromHash(): void {
  const view = location.hash.replace(/^#/, "") || "home";
  show(view);
  if (view === "review") {
    setApplyLabel();
    renderReviewPlan();
  }
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

// Setup selection: a module row toggles itself; a group head toggles all of
// its modules. Both refresh the summary + head states.
document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;

  const row = target.closest<HTMLElement>(".module-row");
  if (row) {
    const on = row.classList.toggle("is-on");
    row.setAttribute("aria-pressed", String(on));
    updateSetupSummary();
    return;
  }

  const head = target.closest<HTMLElement>(".group-head");
  if (head) {
    const rows = [
      ...(head.closest(".group-block")?.querySelectorAll<HTMLElement>(".module-row") ?? []),
    ];
    const allOn = rows.every((r) => r.classList.contains("is-on"));
    for (const r of rows) {
      r.classList.toggle("is-on", !allOn);
      r.setAttribute("aria-pressed", String(!allOn));
    }
    updateSetupSummary();
  }
});

// Snapshot / account / target cards are single-select (radio behaviour).
document.addEventListener("click", (event) => {
  const snap = (event.target as HTMLElement).closest<HTMLElement>(".snap");
  if (!snap) return;
  for (const sibling of snap.parentElement?.querySelectorAll(".snap") ?? []) {
    const selected = sibling === snap;
    sibling.classList.toggle("is-sel", selected);
    sibling.setAttribute("aria-pressed", String(selected));
  }
  // Account cards drive which install-time fields show (local vs Microsoft).
  if (snap.dataset.account) document.body.dataset.account = snap.dataset.account;
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

  deviceName = device.name;
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
let deviceName = "ROG Ally X";

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

/** Render the setup screen: per group, a toggle-all header + per-module rows. */
function renderGroups(): void {
  const container = document.querySelector<HTMLElement>(".groups");
  if (!container) return;

  container.replaceChildren(
    ...catalog.map((group) => {
      const block = el("div", "group-block");

      const head = el("button", "group group-head is-on") as HTMLButtonElement;
      head.type = "button";
      head.dataset.group = group.group;
      head.setAttribute("aria-pressed", "true");
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
        el("span", "group-state", ""),
      );
      head.append(toggle, main, meta);

      const rows = el("div", "module-rows");
      rows.append(...group.modules.map(moduleRow));

      block.append(head, rows);
      return block;
    }),
  );
}

/** A single module row — a real toggle, or a dimmed "coming soon" entry that
 *  can't be selected. */
function moduleRow(module: ModuleSummary): HTMLElement {
  const text = el("span", "module-text");
  const name = el("span", "module-name", module.name);
  if (module.planned) name.append(el("span", "module-badge", "coming soon"));
  text.append(name, el("span", "module-desc", module.description));

  const toggle = el("span", "module-toggle");
  toggle.setAttribute("aria-hidden", "true");

  if (module.planned) {
    const row = el("div", "module-soon");
    row.append(toggle, text);
    return row;
  }

  if (module.changes) text.append(el("span", "module-changes", `changes: ${module.changes}`));
  const row = el("button", "module-row is-on") as HTMLButtonElement;
  row.type = "button";
  row.dataset.module = module.id;
  row.setAttribute("aria-pressed", "true");
  row.append(toggle, text);
  return row;
}

// Source of truth for the chosen modules — set by a bundle pick (player path)
// or synced from the tinker toggles. The review/build/export all read this.
let selectedModules: string[] = [];

function selectedModuleIds(): string[] {
  return selectedModules;
}

/** Recompute the selection from the tinker screen's toggled-on rows. */
function syncSelectionFromTinker(): void {
  selectedModules = [...document.querySelectorAll<HTMLElement>(".module-row.is-on")]
    .map((row) => row.dataset.module ?? "")
    .filter(Boolean);
}

/** Group heads reflect all/some/none of their modules being selected. */
function updateGroupHeads(): void {
  for (const head of document.querySelectorAll<HTMLElement>(".group-head")) {
    const rows = [...(head.closest(".group-block")?.querySelectorAll(".module-row") ?? [])];
    const on = rows.filter((r) => r.classList.contains("is-on")).length;
    head.classList.toggle("is-on", on === rows.length && rows.length > 0);
    head.classList.toggle("is-partial", on > 0 && on < rows.length);
    head.setAttribute("aria-pressed", String(on === rows.length));
  }
}

/** Render the review screen's WILL RUN rows: per-group selected counts. */
function renderReviewPlan(): void {
  const plan = document.querySelector<HTMLElement>(".review-plan");
  if (!plan) return;

  const selected = new Set(selectedModuleIds());
  const foot = plan.querySelector(".readout-foot");
  const rows = catalog.map((group) => {
    const picked = group.modules.filter((m) => selected.has(m.id)).length;
    const row = el("div", "plan-row");
    row.append(
      el("span", "mark"),
      el("span", "plan-name", group.label),
      el("span", picked === 0 ? "plan-n muted" : "plan-n", `${picked} of ${group.moduleCount}`),
    );
    return row;
  });

  plan.replaceChildren(...rows);
  if (foot) plan.append(foot);
}

/** Reflect the per-module selection in the setup summary rail. */
function updateSetupSummary(): void {
  syncSelectionFromTinker();
  const selected = selectedModuleIds();
  const groupsOn = new Set(
    [...document.querySelectorAll<HTMLElement>(".module-row.is-on")].map(
      (r) =>
        r
          .closest<HTMLElement>(".group-head, .group-block")
          ?.querySelector(".group-head")
          ?.getAttribute("data-group") ?? "",
    ),
  );
  groupsOn.delete("");
  fill("groups-summary", `${groupsOn.size} of ${catalog.length} on`);
  fill("steps-summary", `${selected.length} to run`);
  updateGroupHeads();
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
  void hydrateBundles();
  void hydrateState();
}

// ── bundles (the "set it up for me" path) ───────────────────────────────────
let bundles: Bundle[] = [];

/** Fetch the device's bundles and render their cards. */
async function hydrateBundles(): Promise<void> {
  const api = window.bootible;
  if (!api?.getBundles) return;
  try {
    bundles = await api.getBundles();
  } catch {
    return;
  }
  renderBundles();
}

/** Look up each module's summary by id, across all groups. */
function moduleIndex(): Map<string, ModuleSummary> {
  const index = new Map<string, ModuleSummary>();
  for (const group of catalog) for (const module of group.modules) index.set(module.id, module);
  return index;
}

/** Render the bundle cards from the device profile's bundles. */
function renderBundles(): void {
  const list = document.querySelector<HTMLElement>(".bundle-list");
  if (!list || bundles.length === 0) return;
  const index = moduleIndex();
  list.replaceChildren(...bundles.map((bundle) => bundleCard(bundle, index)));
}

function bundleCard(bundle: Bundle, index: Map<string, ModuleSummary>): HTMLElement {
  const card = el("div", "bundle");
  card.dataset.bundle = bundle.id;
  if (bundle.recommended) card.classList.add("is-open");

  const head = el("div", "bundle-head");
  const main = el("span", "bundle-main");
  main.append(
    el("span", "bundle-name", bundle.name),
    el("span", "bundle-desc", bundle.description),
  );
  const meta = el("span", "bundle-meta");
  meta.append(el("span", "group-tag", bundle.tag));
  head.append(main, meta);

  const contents = el("div", "bundle-contents");
  for (const id of bundle.moduleIds) {
    const module = index.get(id);
    if (!module) continue;
    const text = el("span", "bc-text");
    text.append(el("span", "bc-name", module.name), el("span", "bc-desc", module.description));
    const row = el("div", "bc-row");
    row.append(el("span", "bc-dot"), text);
    contents.append(row);
  }

  const actions = el("div", "bundle-actions");
  const use = el("button", "btn-primary", "Use this setup →") as HTMLButtonElement;
  use.type = "button";
  use.dataset.pick = bundle.id;
  const expand = el(
    "button",
    "linkbtn bundle-expand",
    bundle.recommended ? "hide what's inside" : "show what's inside",
  ) as HTMLButtonElement;
  expand.type = "button";
  actions.append(use, expand);

  card.append(head, contents, actions);
  return card;
}

// Pick a bundle → record its modules as the selection and move to the method
// screen. Expand → reveal what's inside.
document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;

  const pick = target.closest<HTMLElement>("[data-pick]");
  if (pick) {
    const bundle = bundles.find((b) => b.id === pick.dataset.pick);
    if (bundle) {
      selectedModules = [...bundle.moduleIds];
      location.hash = "method";
    }
    return;
  }

  const expand = target.closest<HTMLElement>(".bundle-expand");
  if (expand) {
    const open = expand.closest(".bundle")?.classList.toggle("is-open");
    expand.textContent = open ? "hide what's inside" : "show what's inside";
  }
});

/** Annotate the group cards with current on-device state ("✓ set" / "N/M set"). */
async function hydrateState(): Promise<void> {
  const api = window.bootible;
  if (!api?.getState) return;

  let reports: ModuleStateReport[];
  try {
    reports = await api.getState();
  } catch {
    return;
  }
  if (reports.length === 0) return; // off-device: nothing to annotate

  const byGroup = new Map<string, { applied: number; total: number }>();
  for (const report of reports) {
    if (report.state === "unknown") continue; // planned / no probe
    const tally = byGroup.get(report.group) ?? { applied: 0, total: 0 };
    tally.total += 1;
    if (report.state === "applied") tally.applied += 1;
    byGroup.set(report.group, tally);
  }

  for (const head of document.querySelectorAll<HTMLElement>(".group-head")) {
    const group = head.dataset.group;
    const tally = group ? byGroup.get(group) : undefined;
    const slot = head.querySelector(".group-state");
    if (!tally || tally.total === 0 || !slot) continue;
    if (tally.applied === tally.total) {
      slot.textContent = "✓ set";
      head.classList.add("is-applied");
    } else if (tally.applied > 0) {
      slot.textContent = `${tally.applied}/${tally.total} set`;
    }
  }
}

void hydrateCatalog();

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

// ── method actions ─────────────────────────────────────────────────────────
// The review screen's primary button is method-aware: "export" saves a config
// file; "run on device" (and, for now, "build USB") enters the provision flow.

function receiptRow(key: string, value: string): HTMLElement {
  const row = el("div", "rline");
  row.append(el("span", "mark"), el("span", "rkey", key), el("span", "rval", value));
  return row;
}

// The artifact "View full receipt" / "Open folder" opens (set per flow).
let lastArtifactPath = "";

async function runExport(): Promise<void> {
  const api = window.bootible;
  if (!api?.exportConfig) return;
  const modules = selectedModuleIds();
  const result = await api.exportConfig(modules);
  if (!result) return; // cancelled

  lastArtifactPath = result.path;
  fill("done-eyebrow", "Exported");
  fill("done-title", "Config exported");
  fill("done-sub", "Saved to your machine. Re-apply it any time — or build a USB from it.");

  const receipt = document.querySelector<HTMLElement>('.view[data-view="done"] .receipt');
  if (receipt) {
    receipt.replaceChildren(
      receiptRow("device", deviceName),
      receiptRow("modules", `${modules.length} selected`),
      receiptRow("format", "config.yml"),
      receiptRow("saved", result.path),
    );
  }
  location.hash = "done";
}

/** Gather the USB build inputs from the wizard's account + WiFi fields. */
function gatherUsbRequest(): UsbBuildRequest {
  const val = (sel: string) => document.querySelector<HTMLInputElement>(sel)?.value.trim() ?? "";
  const mode = document.body.dataset.account === "microsoft" ? "microsoft" : "local";
  const account =
    mode === "local"
      ? { mode, username: val("#acct-user") || "ally", password: val("#acct-pass") || undefined }
      : { mode };
  const ssid = val("#wifi-ssid");
  const wifi = ssid ? { ssid, password: val("#wifi-pass") } : undefined;
  return { modules: selectedModuleIds(), account, wifi };
}

async function runBuildUsb(): Promise<void> {
  const api = window.bootible;
  if (!api?.buildUsb) return;
  const result = await api.buildUsb(gatherUsbRequest());
  if (!result) return;

  lastArtifactPath = result.stagingPath;
  const account = document.body.dataset.account === "microsoft" ? "Microsoft" : "local";
  const ssid = document.querySelector<HTMLInputElement>("#wifi-ssid")?.value.trim();
  fill("done-eyebrow", "USB bundle ready");
  fill("done-title", "Bundle staged for your USB");
  fill(
    "done-sub",
    "The folder's open. Run prepare-usb.ps1 in it as administrator to write the stick — it fetches Windows + the WiFi driver, then asks which drive to erase.",
  );

  const receipt = document.querySelector<HTMLElement>('.view[data-view="done"] .receipt');
  if (receipt) {
    receipt.replaceChildren(
      receiptRow("device", deviceName),
      receiptRow("account", account),
      receiptRow("wifi", ssid ? ssid : "none"),
      receiptRow("staged", result.stagingPath),
    );
  }
  void api.openPath?.(result.stagingPath);
  location.hash = "done";
}

async function runApplyDevice(): Promise<void> {
  const api = window.bootible;
  if (!api?.applyDevice) {
    location.hash = "provision"; // browser/no-preload: fall back to the dry-run preview
    return;
  }
  const result = await api.applyDevice({
    modules: selectedModuleIds(),
    account: { mode: "local" },
  });
  if (result.status === "cancelled") return;

  const receipt = document.querySelector<HTMLElement>('.view[data-view="done"] .receipt');
  if (result.status === "blocked") {
    fill("done-eyebrow", "Blocked");
    fill("done-title", "Not a recognised handheld");
    fill(
      "done-sub",
      "Run on device only works on a whitelisted ROG Ally. From here you can still build a USB or export a config for one.",
    );
    receipt?.replaceChildren(receiptRow("apply", "hard-blocked — no Ally detected"));
    location.hash = "done";
    return;
  }

  fill("done-eyebrow", "Applying");
  fill("done-title", "Configuring your Ally");
  fill(
    "done-sub",
    "An elevated window is running the setup. Restore points are taken before and after — you can roll back any time.",
  );
  receipt?.replaceChildren(
    receiptRow("device", deviceName),
    receiptRow("restore", "fresh + post-config"),
    receiptRow("log", "C:\\bootible\\bootstrap.log"),
  );
  location.hash = "done";
}

document.addEventListener("click", (event) => {
  const trigger = (event.target as HTMLElement).closest<HTMLElement>('[data-action="apply"]');
  if (!trigger) return;
  const method = document.body.dataset.method ?? "device";
  if (method === "export") void runExport();
  else if (method === "usb") void runBuildUsb();
  else void runApplyDevice();
});

// "View full receipt" opens the artifact this run produced (folder / file).
document.addEventListener("click", (event) => {
  const trigger = (event.target as HTMLElement).closest<HTMLElement>(
    '[data-action="open-artifact"]',
  );
  if (!trigger) return;
  if (lastArtifactPath && window.bootible?.openPath) {
    void window.bootible.openPath(lastArtifactPath);
  } else {
    location.hash = "home";
  }
});

// First render — run after all declarations so deep-linking #provision is safe.
syncFromHash();
