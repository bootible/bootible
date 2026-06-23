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
  baseId?: string;
  sshPublicKeys?: string[];
  hostname?: string;
  account: { mode: "local" | "microsoft"; username?: string; password?: string };
  wifi?: { ssid: string; password: string };
  isoId?: string;
  regionId?: string;
}

interface BaseOption {
  id: string;
  label: string;
  description: string;
  tag?: string;
  recommended?: boolean;
}

interface HostSshKey {
  id: string;
  label: string;
  type: string;
  publicKey: string;
}

interface DiscoveredDevice {
  buildId: string;
  mac: string;
  ip: string;
  hostname: string;
  status: string;
  mine: boolean;
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

interface UsbDisk {
  number: number;
  name: string;
  sizeGb: number;
  letters: string;
  label: string;
}

interface IsoOption {
  id: string;
  label: string;
}

interface UsbProgress {
  pct: number;
  message: string;
  status: "running" | "done" | "error";
}

interface UsbWriteReq extends UsbBuildRequest {
  diskNumber: number;
  isoPath?: string;
  isoId?: string;
}

interface PlatformOption {
  id: string;
  label: string;
  blurb: string;
  status: "ready" | "coming-soon";
}
interface DeviceOption {
  id: string;
  name: string;
  status: "ready" | "coming-soon";
}
interface LanguageOption {
  id: string;
  label: string;
  isoId: string;
}
interface RegionOption {
  id: string;
  label: string;
}

interface BootibleApi {
  version: string;
  getDevice(): Promise<DeviceSummary | null>;
  getPlatforms(): Promise<PlatformOption[]>;
  getDevices(platformId: string): Promise<DeviceOption[]>;
  selectDevice(id: string): Promise<DeviceSummary | null>;
  getBases(): Promise<BaseOption[]>;
  getHostSshKeys(): Promise<HostSshKey[]>;
  generateHostSshKey(comment: string): Promise<HostSshKey | null>;
  startDiscovery(): Promise<void>;
  stopDiscovery(): Promise<void>;
  onBeaconDevice(cb: (device: DiscoveredDevice) => void): void;
  verifyDevice(ip: string): Promise<{ reachable: boolean; output: string; alias?: string }>;
  getLanguages(): Promise<LanguageOption[]>;
  getRegions(): Promise<RegionOption[]>;
  getCatalog(): Promise<GroupSummary[]>;
  getBundles(): Promise<Bundle[]>;
  getState(): Promise<ModuleStateReport[]>;
  getMethods(): Promise<ProvisioningMethod[]>;
  provision(): Promise<ProvisionResult>;
  onProvisionStep(cb: (event: StepEvent) => void): void;
  onProvisionDone(cb: (result: ProvisionResult) => void): void;
  exportConfig(req: {
    modules: string[];
    baseId?: string;
    sshPublicKeys?: string[];
  }): Promise<{ path: string } | null>;
  buildUsb(req: UsbBuildRequest): Promise<{ stagingPath: string; command: string } | null>;
  openPath(path: string): Promise<string>;
  applyDevice(req: UsbBuildRequest): Promise<{ status: "blocked" | "cancelled" | "launched" }>;
  getUsbDisks(): Promise<UsbDisk[]>;
  getIsoCatalog(): Promise<IsoOption[]>;
  browseIso(): Promise<string | null>;
  writeUsb(req: UsbWriteReq): Promise<{ started: boolean }>;
  onUsbProgress(cb: (event: UsbProgress) => void): void;
}

declare global {
  interface Window {
    bootible?: BootibleApi;
  }
}

const VIEWS = [
  "platform",
  "devices",
  "home",
  "base",
  "bundles",
  "method",
  "setup",
  "account",
  "wifi",
  "review",
  "usbwrite",
  "watch",
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
  const view = location.hash.replace(/^#/, "") || "platform";
  show(view);
  if (view === "platform") void hydratePlatforms();
  if (view === "base") void hydrateBases();
  if (view === "account") void hydrateSshKeys();
  if (view === "review") {
    setApplyLabel();
    renderReviewPlan();
  }
  if (view === "usbwrite") void hydrateUsbWrite();
  if (view === "watch") {
    void window.bootible?.startDiscovery?.();
    renderDiscovered();
  }
  if (view === "provision") startProvision();
}

// Navigation: any [data-go] control sets the hash, which drives the view. A
// [data-method] control also records which provisioning method was chosen.
// A [data-back] control pops real history, so Back always returns to the screen
// you actually came from regardless of which flow led here.
document.addEventListener("click", (event) => {
  const back = (event.target as HTMLElement).closest<HTMLElement>("[data-back]");
  if (back) {
    history.back();
    return;
  }
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

// ── device picker (page 1 platform → page 2 device → summary) ───────────────
// A platform/device card, styled like the persona method-cards. Ready cards are
// clickable (data-pick); coming-soon cards are dimmed and inert.
function pickCard(
  kind: "platform" | "device",
  id: string,
  title: string,
  desc: string,
  status: string,
): HTMLElement {
  const ready = status === "ready";
  const card = el("button", `method-card${ready ? "" : " is-soon"}`) as HTMLButtonElement;
  card.type = "button";
  if (ready) {
    card.dataset.pick = kind;
    card.dataset.id = id;
  } else {
    card.disabled = true;
  }
  // Placeholder glyphs (proper icons later): platform vs specific device.
  const icon = el("span", "method-icon", kind === "platform" ? "❖" : "◈");
  icon.setAttribute("aria-hidden", "true");
  const main = el("span", "method-main");
  main.append(el("span", "method-name", title));
  if (desc) main.append(el("span", "method-desc", desc));
  const meta = el("span", "method-meta");
  meta.append(el("span", "group-tag", ready ? "ready" : "coming soon"));
  if (ready) meta.append(el("span", "arrow", "→"));
  card.append(icon, main, meta);
  return card;
}

/** Page 1 — render the platform families. */
async function hydratePlatforms(): Promise<void> {
  const api = window.bootible;
  const list = document.querySelector<HTMLElement>(".platform-list");
  if (!api?.getPlatforms || !list) return;
  let platforms: PlatformOption[] = [];
  try {
    platforms = await api.getPlatforms();
  } catch {
    return;
  }
  list.replaceChildren(
    ...platforms.map((p) => pickCard("platform", p.id, p.label, p.blurb, p.status)),
  );
}

/** Page 2 — render the devices for the chosen platform. */
async function hydrateDevices(platformId: string): Promise<void> {
  const api = window.bootible;
  const list = document.querySelector<HTMLElement>(".device-list");
  if (!api?.getDevices || !list) return;
  let devices: DeviceOption[] = [];
  try {
    devices = await api.getDevices(platformId);
  } catch {
    return;
  }
  list.replaceChildren(...devices.map((d) => pickCard("device", d.id, d.name, "", d.status)));
}

/** Record the picked device and fill the summary screen from its summary. */
async function selectDeviceAndGo(id: string): Promise<void> {
  const api = window.bootible;
  if (!api?.selectDevice) return;
  const device = await api.selectDevice(id);
  if (!device) return;
  deviceName = device.name;
  fill("name", device.name);
  fill("system", device.system);
  fill("device-sub", `${device.system} handheld — selected.`);
  fill("base-eyebrow", `Your ${device.name}`);
  location.hash = "home";
}

/** A base card — the experience picker (charcoal/amber method-card style). */
function baseCard(base: BaseOption): HTMLElement {
  const card = el("button", "method-card") as HTMLButtonElement;
  card.type = "button";
  card.dataset.pick = "base";
  card.dataset.id = base.id;
  const icon = el("span", "method-icon", base.recommended ? "★" : "◆");
  icon.setAttribute("aria-hidden", "true");
  const main = el("span", "method-main");
  main.append(el("span", "method-name", base.label), el("span", "method-desc", base.description));
  const meta = el("span", "method-meta");
  if (base.tag) meta.append(el("span", "group-tag", base.tag));
  meta.append(el("span", "arrow", "→"));
  card.append(icon, main, meta);
  return card;
}

/** Render the base selector (the page after the device summary). */
async function hydrateBases(): Promise<void> {
  const api = window.bootible;
  const list = document.querySelector<HTMLElement>(".base-list");
  if (!api?.getBases || !list) return;
  let bases: BaseOption[] = [];
  try {
    bases = await api.getBases();
  } catch {
    return;
  }
  list.replaceChildren(...bases.map(baseCard));
}

// ── host SSH key-picker (account screen) ────────────────────────────────────
let sshHydrated = false;

/** Render the host's SSH keys as a multi-select, or an empty/generate state. */
function renderSshKeys(): void {
  const list = document.querySelector<HTMLElement>("#ssh-key-list");
  if (!list) return;
  if (hostSshKeys.length === 0) {
    const empty = el("p", "muted ssh-empty", "No SSH keys found on this PC. ");
    const gen = el("button", "linkbtn", "Generate one") as HTMLButtonElement;
    gen.type = "button";
    gen.id = "ssh-generate";
    empty.append(gen);
    list.replaceChildren(empty);
    return;
  }
  list.replaceChildren(
    ...hostSshKeys.map((k) => {
      const row = el("label", "ssh-key-row") as HTMLLabelElement;
      const cb = el("input", "ssh-key-check") as HTMLInputElement;
      cb.type = "checkbox";
      cb.dataset.keyId = k.id;
      cb.checked = selectedKeyIds.has(k.id);
      const meta = el("span", "ssh-key-meta");
      meta.append(el("span", "ssh-key-label", k.label), el("span", "ssh-key-type", k.type));
      row.append(cb, meta);
      return row;
    }),
  );
}

/** Fetch the host's SSH public keys and pre-select them all the first time. */
async function hydrateSshKeys(): Promise<void> {
  const api = window.bootible;
  if (!api?.getHostSshKeys) return;
  try {
    hostSshKeys = await api.getHostSshKeys();
  } catch {
    hostSshKeys = [];
  }
  if (!sshHydrated) {
    for (const k of hostSshKeys) selectedKeyIds.add(k.id);
    sshHydrated = true;
  }
  renderSshKeys();
}

// Card clicks on the platform / devices / base pages.
document.addEventListener("click", (event) => {
  const card = (event.target as HTMLElement).closest<HTMLElement>("[data-pick]");
  if (!card) return;
  const id = card.dataset.id ?? "";
  if (card.dataset.pick === "platform") {
    const label = card.querySelector(".method-name")?.textContent ?? "";
    fill("devices-eyebrow", `Step 2 of 2 · ${label}s`);
    void hydrateDevices(id);
    location.hash = "devices";
  } else if (card.dataset.pick === "device") {
    void selectDeviceAndGo(id);
  } else if (card.dataset.pick === "base") {
    selectedBaseId = id;
    location.hash = "method";
  }
});

void hydratePlatforms();

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
let selectedBaseId = "";
let hostSshKeys: HostSshKey[] = [];
const selectedKeyIds = new Set<string>();

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
  const req = gatherUsbRequest();
  const modules = req.modules;
  const result = await api.exportConfig({
    modules,
    baseId: req.baseId,
    sshPublicKeys: req.sshPublicKeys,
  });
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

/** Gather the USB build inputs from the wizard's base, account, SSH + WiFi. */
function gatherUsbRequest(): UsbBuildRequest {
  const val = (sel: string) =>
    document.querySelector<HTMLInputElement | HTMLTextAreaElement>(sel)?.value.trim() ?? "";
  const mode = document.body.dataset.account === "microsoft" ? "microsoft" : "local";
  const account =
    mode === "local"
      ? { mode, username: val("#acct-user") || "ally", password: val("#acct-pass") || undefined }
      : { mode };
  const ssid = val("#wifi-ssid");
  const wifi = ssid ? { ssid, password: val("#wifi-pass") } : undefined;
  // Chosen keys from the picker + anything pasted into the fallback box.
  const picked = hostSshKeys.filter((k) => selectedKeyIds.has(k.id)).map((k) => k.publicKey);
  const pasted = val("#ssh-paste");
  const sshPublicKeys = [...picked, ...(pasted ? [pasted] : [])];
  const hostname = val("#device-hostname") || undefined;
  // When a base is chosen it defines the full module set; modifiers (the tinker
  // screen) are an explicit add-on path, not the default all-on toggles.
  const modules = selectedBaseId ? [] : selectedModuleIds();
  return {
    modules,
    baseId: selectedBaseId || undefined,
    sshPublicKeys: sshPublicKeys.length ? sshPublicKeys : undefined,
    hostname,
    account,
    wifi,
  };
}

// ── in-app USB writer screen ────────────────────────────────────────────────
const usbState: { isoId: string; isoPath: string; regionId: string; disk: number } = {
  isoId: "",
  isoPath: "",
  regionId: "",
  disk: -1,
};

/** Populate the language + region dropdowns and disk list when the writer opens.
 *  The language option's value is its ISO id, so picking a language sets the
 *  download AND the answer-file UI language from one choice (they can't drift). */
async function hydrateUsbWrite(): Promise<void> {
  const api = window.bootible;
  if (!api?.getLanguages) return;

  const lang = document.querySelector<HTMLSelectElement>("#lang-select");
  if (lang && lang.options.length === 0) {
    let langs: LanguageOption[] = [];
    try {
      langs = await api.getLanguages();
    } catch {}
    lang.replaceChildren(
      ...langs.map((option) => {
        const opt = document.createElement("option");
        opt.value = option.isoId;
        opt.textContent = option.label;
        return opt;
      }),
    );
    if (langs[0]) {
      usbState.isoId = langs[0].isoId;
      usbState.isoPath = "";
    }
  }

  const region = document.querySelector<HTMLSelectElement>("#region-select");
  if (region && region.options.length === 0) {
    let regions: RegionOption[] = [];
    try {
      regions = (await api.getRegions?.()) ?? [];
    } catch {}
    region.replaceChildren(
      ...regions.map((option) => {
        const opt = document.createElement("option");
        opt.value = option.id;
        opt.textContent = option.label;
        return opt;
      }),
    );
    if (regions[0]) usbState.regionId = regions[0].id;
  }

  await refreshDisks();
  updateWriteButton();
}

async function refreshDisks(): Promise<void> {
  const api = window.bootible;
  const list = document.querySelector<HTMLElement>("#disk-list");
  if (!api?.getUsbDisks || !list) return;
  let disks: UsbDisk[] = [];
  try {
    disks = await api.getUsbDisks();
  } catch {}
  if (disks.length === 0) {
    list.replaceChildren(
      el("p", "muted", "No removable USB drives found. Plug one in, then Refresh."),
    );
    return;
  }
  list.replaceChildren(
    ...disks.map((disk) => {
      const btn = el("button", "uw-disk") as HTMLButtonElement;
      btn.type = "button";
      btn.dataset.disk = String(disk.number);
      if (disk.number === usbState.disk) btn.classList.add("is-sel");
      // Match how Explorer names it: "GK-Two (I:)". Fall back to letter, then model.
      const title =
        disk.label && disk.letters
          ? `${disk.label} (${disk.letters})`
          : disk.letters || disk.label || disk.name;
      const detail = [disk.name, `${disk.sizeGb} GB`, `disk ${disk.number}`]
        .filter(Boolean)
        .join(" · ");
      btn.append(el("span", "uw-disk-name", title), el("span", "uw-disk-size", detail));
      return btn;
    }),
  );
}

function updateWriteButton(): void {
  const btn = document.querySelector<HTMLButtonElement>("#usb-write-btn");
  const confirmed = document.querySelector<HTMLInputElement>("#erase-confirm")?.checked ?? false;
  const hasIso = Boolean(usbState.isoId || usbState.isoPath);
  if (btn) btn.disabled = !(confirmed && hasIso && usbState.disk >= 0);
}

async function startUsbWrite(): Promise<void> {
  const api = window.bootible;
  if (!api?.writeUsb) return;
  document.querySelector(".uw-go")?.setAttribute("hidden", "");
  document.querySelector(".uw-progress")?.removeAttribute("hidden");
  // Immediate feedback before the elevated writer emits its first line.
  onUsbProgress({
    pct: 1,
    message: "Preparing — accept the Windows admin (UAC) prompt…",
    status: "running",
  });
  const result = await api.writeUsb({
    ...gatherUsbRequest(),
    diskNumber: usbState.disk,
    isoPath: usbState.isoPath || undefined,
    isoId: usbState.isoId || undefined,
    regionId: usbState.regionId || undefined,
  });
  if (result && !result.started) {
    onUsbProgress({
      pct: 0,
      message: "Couldn't start the write — no device to build for.",
      status: "error",
    });
  }
}

function onUsbProgress(event: UsbProgress): void {
  const msg = document.querySelector("#uw-msg");
  const fill = document.querySelector<HTMLElement>("#uw-fill");
  const pct = document.querySelector("#uw-pct");
  if (msg) msg.textContent = event.message;
  if (fill) fill.style.width = `${event.pct}%`;
  if (pct) {
    pct.textContent =
      event.status === "error"
        ? "Failed — see the message above."
        : event.status === "done"
          ? "Done — boot the Ally from the stick."
          : `${event.pct}% — keep the app open.`;
  }
  // Once the stick is written, move to watching the network for the device.
  if (event.status === "done") setTimeout(() => (location.hash = "watch"), 1200);
}

window.bootible?.onUsbProgress?.(onUsbProgress);

// ── device discovery (watch screen) ─────────────────────────────────────────
const discovered = new Map<string, DiscoveredDevice>();
// Verify results survive the 5s beacon re-renders, keyed by device IP.
const verifyResults = new Map<string, { reachable: boolean; output: string }>();

/** Render the discovered devices, the build we just made first. */
function renderDiscovered(): void {
  const list = document.querySelector<HTMLElement>(".watch-list");
  if (!list) return;
  const devices = [...discovered.values()].sort((a, b) => Number(b.mine) - Number(a.mine));
  if (devices.length === 0) {
    list.replaceChildren(
      el(
        "p",
        "muted",
        "Listening on the network — boot your device from the USB and it'll appear here.",
      ),
    );
    return;
  }
  list.replaceChildren(
    ...devices.map((d) => {
      const card = el("div", `watch-card${d.mine ? " is-mine" : ""}`);
      const head = el("div", "watch-head");
      head.append(
        el("span", "watch-name", d.hostname || d.mac || "device"),
        el("span", `watch-status status-${d.status}`, d.status),
      );
      const detail = [d.ip, d.mine ? "this is your build" : ""].filter(Boolean).join(" · ");
      card.append(head, el("div", "watch-meta muted", detail));

      const verify = el("button", "btn-ghost watch-verify", "Verify over SSH") as HTMLButtonElement;
      verify.type = "button";
      verify.dataset.verifyIp = d.ip;
      card.append(verify);

      const result = verifyResults.get(d.ip);
      if (result) {
        if (result.reachable && result.alias) {
          card.append(el("div", "watch-alias", `✓ verified — now just \`ssh ${result.alias}\``));
        }
        card.append(
          el(
            "pre",
            `watch-result ${result.reachable ? "ok" : "fail"}`,
            result.reachable ? result.output : `Couldn't reach it: ${result.output}`,
          ),
        );
      }
      return card;
    }),
  );
}

window.bootible?.onBeaconDevice?.((d) => {
  discovered.set(d.buildId || d.mac, d);
  renderDiscovered();
});

// Verify a discovered device over SSH (key auth, no prompts).
document.addEventListener("click", (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLButtonElement>(".watch-verify");
  if (!btn) return;
  const ip = btn.dataset.verifyIp ?? "";
  if (!ip) return;
  btn.textContent = "Checking…";
  btn.disabled = true;
  void (async () => {
    const result = (await window.bootible?.verifyDevice?.(ip)) ?? {
      reachable: false,
      output: "no bridge",
    };
    verifyResults.set(ip, result);
    renderDiscovered();
  })();
});

// Writer-screen interactions (ISO source, disk pick, confirm, write).
document.addEventListener("change", (event) => {
  const target = event.target as HTMLElement;
  if (target.id === "lang-select") {
    usbState.isoId = (target as HTMLSelectElement).value;
    usbState.isoPath = "";
    const path = document.querySelector("#iso-path");
    if (path) path.textContent = "";
  }
  if (target.id === "region-select") {
    usbState.regionId = (target as HTMLSelectElement).value;
  }
  if (target instanceof HTMLInputElement && target.dataset.keyId) {
    if (target.checked) selectedKeyIds.add(target.dataset.keyId);
    else selectedKeyIds.delete(target.dataset.keyId);
  }
  if (target.id === "lang-select" || target.id === "erase-confirm") updateWriteButton();
});

document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;

  if (target.closest("#iso-browse")) {
    void (async () => {
      const picked = await window.bootible?.browseIso?.();
      if (!picked) return;
      // Use the local ISO for the image, but keep the chosen language's isoId so
      // the answer file's UI language still matches (uiLanguage is derived from it).
      usbState.isoPath = picked;
      const path = document.querySelector("#iso-path");
      if (path) path.textContent = picked;
      updateWriteButton();
    })();
    return;
  }

  if (target.closest("#disk-refresh")) {
    void refreshDisks();
    return;
  }

  if (target.closest("#ssh-generate")) {
    void (async () => {
      const created = await window.bootible?.generateHostSshKey?.(`${deviceName} via bootible`);
      if (!created) return;
      if (!hostSshKeys.some((k) => k.id === created.id)) hostSshKeys.push(created);
      selectedKeyIds.add(created.id);
      renderSshKeys();
    })();
    return;
  }

  const disk = target.closest<HTMLElement>(".uw-disk");
  if (disk) {
    usbState.disk = Number(disk.dataset.disk);
    for (const d of document.querySelectorAll(".uw-disk")) d.classList.toggle("is-sel", d === disk);
    updateWriteButton();
    return;
  }

  if (target.closest("#usb-write-btn")) void startUsbWrite();
});

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
  else if (method === "usb") location.hash = "usbwrite";
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
