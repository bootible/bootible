import "./styles.css";

interface DeviceSummary {
  id: string;
  name: string;
  system: string;
  provisioning: string;
  emulationCount: number;
}

interface BootibleApi {
  version: string;
  getDevice(): Promise<DeviceSummary | null>;
}

declare global {
  interface Window {
    bootible?: BootibleApi;
  }
}

const VIEWS = [
  "home",
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
  show(location.hash.replace(/^#/, ""));
}

// Navigation: any [data-go] control sets the hash, which drives the view.
document.addEventListener("click", (event) => {
  const trigger = (event.target as HTMLElement).closest<HTMLElement>("[data-go]");
  if (!trigger) return;
  const target = trigger.dataset.go;
  if (target) location.hash = target;
});

// Group toggles on the setup screen flip their own pressed state.
document.addEventListener("click", (event) => {
  const group = (event.target as HTMLElement).closest<HTMLElement>(".group");
  if (!group) return;
  const on = group.classList.toggle("is-on");
  group.setAttribute("aria-pressed", String(on));
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
syncFromHash();

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
