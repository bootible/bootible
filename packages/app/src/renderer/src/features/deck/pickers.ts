import type { DeckyStorePlugin, FlatpakApp, PasswordManager } from "@bootible/core";
import { GroupedPicker } from "../../components/GroupedPicker";
import { countSelectedInView } from "../../lib/app-selection";
import { el } from "../../lib/dom";
import { deckCheck, deckState } from "./config";
import { deckItemRow, formatDownloads, setDeckPickCount } from "./setup";

// ── Apps picker screen (collapsible category groups, like ROG) ──
export async function hydrateDeckApps(): Promise<void> {
  const box = document.querySelector<HTMLElement>("#deckapps-body");
  if (!box) return;
  box.replaceChildren(el("p", "muted", "Loading apps…"));
  let apps: FlatpakApp[] = [];
  try {
    apps = (await window.bootible?.getDeckApps?.()) ?? [];
  } catch {
    box.replaceChildren(el("p", "muted", "Couldn't load the app list."));
    return;
  }
  // Emulators have their own picker; Moonlight pairs with Sunshine on the
  // Device-setup screen. Every other streaming client (Chiaki, Greenlight, …) lives
  // here in Apps, like ROG.
  const visible = apps.filter((a) => a.category !== "Emulator" && a.id !== "moonlight");
  renderDeckApps(box, visible);
  // Count only apps visible on THIS screen — not emulators/streaming selected elsewhere.
  setDeckPickCount("deckapps", countSelectedInView(visible, deckState.flatpakApps), "app");
}

// ── Emulators picker screen (EmuDeck manager + standalone emulators) ──
export async function hydrateDeckEmulators(): Promise<void> {
  const box = document.querySelector<HTMLElement>("#deckemu-body");
  if (!box) return;
  box.replaceChildren(el("p", "muted", "Loading emulators…"));
  let apps: FlatpakApp[] = [];
  try {
    apps = (await window.bootible?.getDeckApps?.()) ?? [];
  } catch {
    box.replaceChildren(el("p", "muted", "Couldn't load the emulator list."));
    return;
  }
  const emus = apps.filter((a) => a.category === "Emulator");
  const update = (): void =>
    setDeckPickCount(
      "deckemu",
      emus.filter((a) => deckState.flatpakApps.includes(a.id)).length + (deckState.emudeck ? 1 : 0),
      "emulator",
    );
  const emudeck = deckCheck(
    "EmuDeck",
    deckState.emudeck,
    (v) => {
      deckState.emudeck = v;
      update();
    },
    "Sets up emulators + the Emulation folder tree for you. The wizard finishes on-device.",
    "stages EmuDeck; run its wizard once",
  );
  emudeck.classList.add("cz-span");
  const applyToggle = (id: string, on: boolean): void => {
    const set = new Set(deckState.flatpakApps);
    if (on) set.add(id);
    else set.delete(id);
    deckState.flatpakApps = [...set];
  };
  // Standalone emulators go in one GroupedPicker group so they get a select-all
  // header (matching the ROG + the Deck Apps picker) instead of ticking each by
  // hand. EmuDeck is a manager, not a per-system emulator, so it stays its own card.
  const picker = GroupedPicker({
    groups: [
      {
        id: "emulators",
        label: "Standalone emulators",
        open: true,
        items: emus.map((a) => ({
          id: a.id,
          label: a.name,
          checked: deckState.flatpakApps.includes(a.id),
        })),
      },
    ],
    onToggleItem: (_g, id, on) => {
      applyToggle(id, on);
      update();
    },
    onToggleGroup: (_g, on) => {
      for (const a of emus) applyToggle(a.id, on);
      update();
    },
  });
  box.replaceChildren(emudeck, picker);
  update();
}

function renderDeckApps(box: HTMLElement, apps: FlatpakApp[]): void {
  const byCat = new Map<string, FlatpakApp[]>();
  for (const app of apps) {
    const l = byCat.get(app.category);
    if (l) l.push(app);
    else byCat.set(app.category, [app]);
  }
  const refreshCount = (): void =>
    setDeckPickCount("deckapps", countSelectedInView(apps, deckState.flatpakApps), "app");
  const applyToggle = (id: string, on: boolean): void => {
    const set = new Set(deckState.flatpakApps);
    if (on) set.add(id);
    else set.delete(id);
    deckState.flatpakApps = [...set];
  };
  box.replaceChildren(
    GroupedPicker({
      groups: [...byCat].map(([cat, list]) => ({
        id: cat,
        label: cat,
        items: list.map((a) => ({
          id: a.id,
          label: a.name,
          checked: deckState.flatpakApps.includes(a.id),
        })),
      })),
      onToggleItem: (_groupId, id, on) => {
        applyToggle(id, on);
        refreshCount();
      },
      onToggleGroup: (groupId, on) => {
        for (const a of byCat.get(groupId) ?? []) applyToggle(a.id, on);
        refreshCount();
      },
    }),
  );
  refreshCount();
}

// ── Decky plugins picker screen (flat list, most-installed first) ──
export async function hydrateDeckPlugins(): Promise<void> {
  const box = document.querySelector<HTMLElement>("#deckplugins-body");
  if (!box) return;
  box.replaceChildren(el("p", "muted", "Loading the plugin store…"));
  let list: DeckyStorePlugin[] = [];
  try {
    list = (await window.bootible?.getDeckyPlugins?.()) ?? [];
  } catch {
    box.replaceChildren(
      el("p", "muted", "Couldn't reach the Decky store — defaults will be used."),
    );
    return;
  }
  renderDeckPlugins(box, list);
  setDeckPickCount("deckplugins", deckState.decky.plugins.length, "plugin");
}

function renderDeckPlugins(box: HTMLElement, list: DeckyStorePlugin[]): void {
  if (list.length === 0) {
    box.replaceChildren(el("p", "muted", "No plugins returned — the defaults will be used."));
    return;
  }
  // The list is long, so offer a live filter over name / description / tags / author.
  const search = el("input", "deck-search") as HTMLInputElement;
  search.type = "search";
  search.placeholder = `Search ${list.length} plugins…`;
  const listEl = el("div", "plugin-list");
  // fetchDeckyPlugins returns them sorted by downloads (most-installed first).
  const cards: { el: HTMLElement; hay: string }[] = list.map((p) => {
    const card = el("div", "plugin-card");
    // A div, not a label — clicking the bar expands details (below); only the
    // checkbox toggles selection.
    const row = el("div", "app-row plugin-row");
    const cb = el("input", "app-check") as HTMLInputElement;
    cb.type = "checkbox";
    cb.checked = deckState.decky.plugins.includes(p.name);
    cb.addEventListener("change", () => {
      const set = new Set(deckState.decky.plugins);
      if (cb.checked) set.add(p.name);
      else set.delete(p.name);
      deckState.decky.plugins = [...set];
      setDeckPickCount("deckplugins", deckState.decky.plugins.length, "plugin");
    });
    cb.addEventListener("click", (e) => e.stopPropagation()); // tick only, don't expand
    const meta = el("span", "app-meta");
    meta.append(el("span", "app-name", p.name));
    meta.append(
      el("span", "app-id", `${formatDownloads(p.downloads)} installs · ${p.author || "unknown"}`),
    );
    row.append(cb, meta);
    // "Details" expands the full store info (no public per-plugin page exists, so
    // we show what the store API already returns — description, tags, version, icon).
    const info = el("button", "plugin-info-btn") as HTMLButtonElement;
    info.type = "button";
    info.textContent = "Details";
    info.setAttribute("aria-expanded", "false");
    const detail = el("div", "plugin-detail");
    detail.hidden = true;
    if (p.imageUrl) {
      const img = el("img", "plugin-img") as HTMLImageElement;
      img.src = p.imageUrl;
      img.alt = "";
      img.loading = "lazy";
      detail.append(img);
    }
    detail.append(el("p", "plugin-desc", p.description || "No description provided."));
    if (p.tags.length) {
      const tags = el("div", "plugin-tags");
      for (const t of p.tags) tags.append(el("span", "plugin-tag", t));
      detail.append(tags);
    }
    if (p.version) detail.append(el("p", "plugin-ver", `v${p.version}`));
    const toggleDetail = (): void => {
      const open = detail.hidden;
      detail.hidden = !open;
      info.setAttribute("aria-expanded", String(open));
      info.textContent = open ? "Hide" : "Details";
    };
    info.addEventListener("click", toggleDetail);
    row.addEventListener("click", toggleDetail); // click the bar's empty space to expand
    const head = el("div", "plugin-head");
    head.append(row, info);
    card.append(head, detail);
    listEl.append(card);
    return {
      el: card,
      hay: `${p.name} ${p.description} ${p.tags.join(" ")} ${p.author}`.toLowerCase(),
    };
  });
  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    for (const c of cards) c.el.hidden = q !== "" && !c.hay.includes(q);
  });
  box.replaceChildren(search, listEl);
}

// ── Password managers picker screen ──
export async function hydrateDeckPm(): Promise<void> {
  const box = document.querySelector<HTMLElement>("#deckpm-body");
  if (!box) return;
  box.replaceChildren(el("p", "muted", "Loading…"));
  let list: PasswordManager[] = [];
  try {
    list = (await window.bootible?.getDeckPasswordManagers?.()) ?? [];
  } catch {
    box.replaceChildren(el("p", "muted", "Couldn't load password managers."));
    return;
  }
  renderDeckPasswordManagers(box, list);
  setDeckPickCount("deckpm", deckState.passwordManagers.managers.length, "manager");
}

function renderDeckPasswordManagers(box: HTMLElement, list: PasswordManager[]): void {
  const rows = list.map((pm) =>
    deckItemRow(pm.name, "", deckState.passwordManagers.managers.includes(pm.id), (v) => {
      const set = new Set(deckState.passwordManagers.managers);
      if (v) set.add(pm.id);
      else set.delete(pm.id);
      deckState.passwordManagers.managers = [...set];
      setDeckPickCount("deckpm", deckState.passwordManagers.managers.length, "manager");
    }),
  );
  const methodWrap = el("div", "cz-sec");
  methodWrap.append(el("div", "cz-sec-h", "Install method"));
  const method = el("select", "uw-select") as HTMLSelectElement;
  for (const [value, label] of [
    ["flatpak", "Flatpak (simpler)"],
    ["distrobox", "Distrobox (system auth + SSH agent)"],
  ] as const) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    method.append(opt);
  }
  method.value = deckState.passwordManagers.method;
  method.addEventListener("change", () => {
    deckState.passwordManagers.method = method.value === "distrobox" ? "distrobox" : "flatpak";
  });
  methodWrap.append(method);
  box.replaceChildren(...rows, methodWrap);
}
