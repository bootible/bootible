// RECORDED REASON for >400 lines (coding-standard §4): freshly carved out of the
// main.ts god-file as one cohesive Steam Deck flow. Next decomposition target —
// split into deck/{state,setup,pickers,profile,media}.ts around the shared
// deckState — but getting it out of the god-file was the bigger win first.
// See docs/v2/standards/remediation-plan.md P3.
import type {
  DeckConfig,
  DeckyStorePlugin,
  FlatpakApp,
  PasswordManager,
  Profile,
  UsbProgress,
} from "@bootible/core";
import { DiskPicker } from "../components/DiskPicker";
import { GroupedPicker } from "../components/GroupedPicker";
import { NetworkSettings } from "../components/NetworkSettings";
import { ProfileBar } from "../components/ProfileBar";
import { RemoteAccessSettings } from "../components/RemoteAccessSettings";
import { SshAccessEditor } from "../components/SshAccessEditor";
import { StreamingSettings } from "../components/StreamingSettings";
import { countSelectedInView } from "../lib/app-selection";
import { el } from "../lib/dom";
import { session } from "../lib/session";

// ── Steam Deck config + provision-only USB (Path A) ──────────────────────────

// NOTE: these defaults duplicate core's DEFAULT_DECK_CONFIG / RECOMMENDED_DECKY_PLUGINS
// (coding-standard #8). They can't be value-imported from @bootible/core yet — the
// barrel pulls in Node-only modules (fs/path) the renderer bundle can't include.
// Deduplicating needs a browser-safe core export surface — remediation-plan P2 #6/#7.
const RECOMMENDED_DECKY = ["PowerTools", "ProtonDB Badges", "SteamGridDB"];

/** The Deck choices — the single source of truth (buildDeckBundle normalizes). */
const deckState: DeckConfig = {
  hostname: undefined,
  createSnapshot: true,
  flatpakApps: ["flatseal"],
  ssh: { enabled: false, port: 22, authorizedKeys: [] },
  decky: { enabled: true, plugins: [...RECOMMENDED_DECKY] },
  proton: { ge: true, protonUpQt: true, protontricks: true },
  emudeck: false,
  emulationStorage: "auto",
  sunshine: { enabled: false },
  vnc: false,
  tailscale: false,
  waydroid: false,
  stickdeck: false,
  passwordManagers: { managers: [], method: "flatpak" },
};
let deckDisk = ""; // selected USB drive letter, e.g. "E"

/** A rich toggle row in the ROG `.cz-*` style: name + description + an optional
 *  "what it does" line, bound to a setter on deckState. */
function deckCheck(
  label: string,
  checked: boolean,
  onChange: (v: boolean) => void,
  desc?: string,
  changes?: string,
): HTMLElement {
  const row = el("label", `cz-row${checked ? "" : " is-off"}`);
  const cb = el("input", "cz-check") as HTMLInputElement;
  cb.type = "checkbox";
  cb.checked = checked;
  cb.addEventListener("change", () => {
    row.classList.toggle("is-off", !cb.checked);
    onChange(cb.checked);
    updateDeckSummary();
  });
  const text = el("div", "cz-text");
  text.append(el("div", "cz-name", label));
  if (desc) text.append(el("div", "cz-desc", desc));
  if (changes) text.append(el("div", "cz-chg", changes));
  row.append(cb, text);
  return row;
}

/** A full-width config section: a header (with an optional "· N" count) over a
 *  2-column grid of rows. Picker rows and `.cz-span` fields span both columns. */
function deckSection(title: string, rows: HTMLElement[], count?: number): HTMLElement {
  const sec = el("div", "cz-sec");
  const head = el("div", "cz-sec-h", title);
  if (count !== undefined) head.append(el("span", "cz-sec-count", ` · ${count}`));
  const grid = el("div", "cz-sec-rows");
  grid.append(...rows);
  sec.append(head, grid);
  return sec;
}

/** Count the truthy flags — for a section's "· N" header. */
function countOn(...flags: boolean[]): number {
  return flags.filter(Boolean).length;
}

function updateDeckSummary(): void {
  const n =
    deckState.flatpakApps.length + (deckState.decky.enabled ? deckState.decky.plugins.length : 0);
  const sum = document.querySelector("#deck-summary");
  if (sum) {
    sum.textContent = `${n} item${n === 1 ? "" : "s"} selected — Decky ${deckState.decky.enabled ? "on" : "off"}.`;
  }
}

/** Snapshot the whole Deck config into a Profile. The Sunshine password rides in
 *  `secrets` (DPAPI-encrypted by main, E2E in the cloud) — never plaintext in ui.
 *  Same store + cloud sync as the ROG profiles. */
// The Deck's currently-loaded profile name (drives ProfileBar's Update button).
let deckLoadedProfile: string | null = null;
let deckProfileStatus = ""; // ProfileBar status line (Saved/Loaded/Deleted feedback)
let deckGithubKeys: string[] = []; // last GitHub-key lookup, for the SSH editor's live count
let deckGithubFetchedFor = ""; // the username deckGithubKeys was fetched for

function captureDeckProfile(name: string): Profile {
  const ui = JSON.parse(JSON.stringify(deckState)) as Record<string, unknown>;
  const sun = ui.sunshine as { pass?: string } | undefined;
  if (sun) sun.pass = undefined;
  const pass = deckState.sunshine.pass ?? "";
  return {
    name,
    deviceModel: session.deviceId || undefined,
    ui,
    secrets: pass ? { sunshinePass: pass } : {},
  };
}

/** Restore a saved Deck profile into deckState and re-render. */
function applyDeckProfile(p: Profile): void {
  const ui = (p.ui ?? {}) as Partial<DeckConfig>;
  Object.assign(deckState, ui);
  // Top-level optionals must be reset explicitly — JSON drops undefined keys, so a
  // profile saved without them wouldn't otherwise clear a currently-set value.
  deckState.hostname = (ui.hostname as string) || undefined;
  deckState.staticIp = (ui.staticIp as DeckConfig["staticIp"]) ?? undefined;
  deckState.sunshine = { ...deckState.sunshine, pass: p.secrets?.sunshinePass || undefined };
  // Caller re-renders the screen it's on (load lives on the deck config screen).
}

/** The shared Deck ProfileBar. "load" goes on the first config screen (pick a saved
 *  profile to start from); "save" on the last (where the full config exists). */
async function deckProfileBar(mode: "load" | "save"): Promise<HTMLElement> {
  const grouped = (await window.bootible?.groupProfiles?.(session.deviceId)) ?? {
    model: [],
    family: [],
  };
  const saveDeck = async (name: string): Promise<void> => {
    const r = await window.bootible?.saveProfile?.(captureDeckProfile(name));
    deckProfileStatus = r?.ok ? `✓ Saved "${name}" to this PC` : "Save failed.";
    void window.bootible?.cloud?.syncNow(); // push if signed in + unlocked
    deckLoadedProfile = name;
    void hydrateDeckSetup();
  };
  return ProfileBar({
    mode,
    profiles: grouped,
    modelLabel: `This ${session.deviceName || "device"}`,
    familyLabel: "Other compatible devices",
    loadedName: deckLoadedProfile,
    status: deckProfileStatus,
    onLoad: async (name) => {
      const p = await window.bootible?.loadProfile?.(name);
      if (p) {
        deckLoadedProfile = name;
        deckProfileStatus = `Loaded "${name}"`;
        applyDeckProfile(p);
        void hydrateDeck(); // re-render the start screen with the restored config
      }
    },
    onSaveNew: saveDeck,
    onUpdate: saveDeck,
    onDelete: async (name) => {
      await window.bootible?.deleteProfile?.(name);
      if (deckLoadedProfile === name) deckLoadedProfile = null;
      deckProfileStatus = `Deleted "${name}"`;
      void (mode === "load" ? hydrateDeck() : hydrateDeckSetup());
    },
  });
}

export async function hydrateDeck(): Promise<void> {
  const body = document.querySelector<HTMLElement>("#deck-body");
  if (!body) return;
  body.replaceChildren();

  // Load a saved profile to start from (save is on the device-setup screen).
  body.append(await deckProfileBar("load"));

  // Catalog (loaded once) drives which flatpak ids belong to the Emulators picker
  // and the Game-streaming section, so the Apps picker count excludes them — no
  // hardcoded id lists, no drift from the unified catalog.
  const deckApps = (await window.bootible?.getDeckApps?.()) ?? [];
  const EMULATOR_IDS = new Set(deckApps.filter((a) => a.category === "Emulator").map((a) => a.id));

  // ── 1. Apps, plugins & managers — the "what gets installed" hub (lead with it).
  // All rows span full width here so the hub reads as one clean vertical stack.
  const deckyToggle = deckCheck(
    "Decky Loader",
    deckState.decky.enabled,
    (v) => {
      deckState.decky.enabled = v;
      void hydrateDeck();
    },
    "The plugin framework for Gaming Mode — adds a plugin menu to the Quick Access panel. PowerTools is the main performance tool.",
    "installs decky-loader",
  );
  deckyToggle.classList.add("cz-span");
  // Moonlight pairs with Sunshine on the Device-setup screen; every other streaming
  // client lives in the Apps picker, so only Moonlight is excluded from the count.
  const appCount = deckState.flatpakApps.filter(
    (id) => !EMULATOR_IDS.has(id) && id !== "moonlight",
  ).length;
  const emuCount =
    deckState.flatpakApps.filter((id) => EMULATOR_IDS.has(id)).length + (deckState.emudeck ? 1 : 0);
  const installRows: HTMLElement[] = [
    deckPickerRow(
      "Apps",
      "Browsers, comms, media, launchers (Heroic / Lutris / Bottles), streaming & more — grouped by category.",
      appCount,
      "deckapps",
    ),
    deckPickerRow(
      "Emulators",
      "EmuDeck (sets everything up) or standalone RetroArch / Dolphin / PCSX2 / PPSSPP / DuckStation / RetroDeck.",
      emuCount,
      "deckemu",
    ),
    deckyToggle,
  ];
  if (deckState.decky.enabled) {
    installRows.push(
      deckPickerRow(
        "Decky plugins",
        "PowerTools, SteamGridDB, ProtonDB Badges and 100+ more — most-installed first.",
        deckState.decky.plugins.length,
        "deckplugins",
      ),
    );
  }
  installRows.push(
    deckPickerRow(
      "Password managers",
      "1Password, Bitwarden, KeePassXC, Proton Pass — pick any; choose Flatpak or Distrobox.",
      deckState.passwordManagers.managers.length,
      "deckpm",
    ),
  );
  const installCount =
    deckState.flatpakApps.length +
    (deckState.decky.enabled ? deckState.decky.plugins.length : 0) +
    deckState.passwordManagers.managers.length;
  body.append(deckSection("Apps & plugins", installRows, installCount));

  // ── 2. Compatibility (gaming).
  body.append(
    deckSection(
      "Compatibility",
      [
        deckCheck(
          "Proton-GE (latest)",
          deckState.proton.ge,
          (v) => {
            deckState.proton.ge = v;
          },
          "GloriousEggroll's Proton build — better compatibility for many non-Steam and anti-cheat games.",
          "downloads the latest GE into compatibilitytools.d",
        ),
        deckCheck(
          "ProtonUp-Qt",
          deckState.proton.protonUpQt,
          (v) => {
            deckState.proton.protonUpQt = v;
          },
          "A GUI to install + update Proton-GE and other compatibility tools later.",
          "flatpak net.davidotek.pupgui2",
        ),
        deckCheck(
          "protontricks",
          deckState.proton.protontricks,
          (v) => {
            deckState.proton.protontricks = v;
          },
          "Per-game Winetricks for fixing specific titles.",
          "flatpak com.github.Matoking.protontricks",
        ),
      ],
      countOn(deckState.proton.ge, deckState.proton.protonUpQt, deckState.proton.protontricks),
    ),
  );

  // ── 4. Extras.
  body.append(
    deckSection(
      "Extras",
      [
        deckCheck(
          "Waydroid",
          deckState.waydroid,
          (v) => {
            deckState.waydroid = v;
          },
          "Run Android apps on the Deck. The installer is interactive — finish it on-device.",
          "stages the Waydroid installer",
        ),
        deckCheck(
          "StickDeck",
          deckState.stickdeck,
          (v) => {
            deckState.stickdeck = v;
          },
          "Use the Deck as a wireless gamepad for your PC.",
          "installs StickDeck (latest release)",
        ),
      ],
      countOn(deckState.waydroid, deckState.stickdeck),
    ),
  );

  // ── 5. System (snapshot — hostname now lives on the Device-setup screen).
  body.append(
    deckSection(
      "System",
      [
        deckCheck(
          "Btrfs snapshot before changes",
          deckState.createSnapshot,
          (v) => {
            deckState.createSnapshot = v;
          },
          "A safe rollback point — undo everything if a tweak misbehaves.",
          "btrfs snapshot of / before any change",
        ),
      ],
      countOn(deckState.createSnapshot),
    ),
  );

  updateDeckSummary();
}

/** The Deck "Device setup" screen — the second stage, mirroring the ROG flow:
 *  name + network + game streaming + remote access. (Pickers + Proton/Extras/System
 *  stay on the first config screen.) */
export async function hydrateDeckSetup(): Promise<void> {
  const body = document.querySelector<HTMLElement>("#decksetup-body");
  if (!body) return;
  body.replaceChildren();

  // Save profiles — on this last config page, where the full config exists.
  body.append(await deckProfileBar("save"));

  // Hostname.
  const hostField = el("div", "cz-span deck-field");
  hostField.append(
    el("div", "cz-name", "Device name (for SSH)"),
    el(
      "div",
      "cz-desc",
      "The device's network name + SSH alias. Blank keeps the default (steamdeck); set one to tell devices apart, e.g. deck-living-room.",
    ),
  );
  const host = el("input", "uw-select") as HTMLInputElement;
  host.type = "text";
  host.placeholder = "steamdeck";
  host.value = deckState.hostname ?? "";
  host.addEventListener("input", () => {
    deckState.hostname = host.value.trim() || undefined;
  });
  hostField.append(host);
  body.append(deckSection("Device name", [hostField]));

  // Network — shared NetworkSettings (no host inference on-device).
  const deckNet = NetworkSettings({
    value: deckState.staticIp,
    interfaces: ["wifi", "ethernet"],
    onChange: (next) => {
      deckState.staticIp = next;
    },
  });
  deckNet.classList.add("cz-span");
  body.append(deckSection("Network", [deckNet], deckState.staticIp ? 1 : 0));

  // Game streaming — shared StreamingSettings (Sunshine host + creds + Moonlight).
  const streamMount = el("div", "cz-span");
  streamMount.id = "deck-streaming-mount";
  body.append(deckSection("Game streaming", [streamMount]));
  mountDeckStreaming();

  // Remote access — shared RemoteAccessSettings (VNC + Tailscale on the Deck).
  body.append(
    deckSection("Remote access", [
      RemoteAccessSettings({
        options: [
          {
            id: "vnc",
            label: "VNC remote desktop",
            desc: "Remote access to the Deck's KDE desktop from another machine.",
            enabled: deckState.vnc,
          },
          {
            id: "tailscale",
            label: "Tailscale",
            desc: "Zero-config mesh VPN — reach the Deck securely (run 'tailscale up' to log in).",
            enabled: deckState.tailscale,
          },
        ],
        onToggle: (id, on) => {
          if (id === "vnc") deckState.vnc = on;
          else if (id === "tailscale") deckState.tailscale = on;
        },
      }),
    ]),
  );

  // SSH access — shared SshAccessEditor (keys enable SSH; GitHub + paste + port).
  const sshMount = el("div", "cz-span");
  sshMount.id = "deck-ssh-mount";
  body.append(deckSection("SSH access", [sshMount]));
  mountDeckSsh();
}

/** (Re)mount the Deck's shared StreamingSettings (re-mounts only when a toggle
 *  changes which fields show, so typing in user/password keeps focus). */
function mountDeckStreaming(): void {
  const mount = document.querySelector<HTMLElement>("#deck-streaming-mount");
  if (!mount) return;
  const s = deckState.sunshine;
  mount.replaceChildren(
    StreamingSettings({
      value: {
        sunshineEnabled: s.enabled,
        sunshineUser: s.user,
        sunshinePass: s.pass,
        sunshinePromptPass: s.promptPass,
        moonlight: deckState.flatpakApps.includes("moonlight"),
      },
      onChange: (next) => {
        const toggled =
          s.enabled !== next.sunshineEnabled ||
          Boolean(s.promptPass) !== Boolean(next.sunshinePromptPass) ||
          deckState.flatpakApps.includes("moonlight") !== next.moonlight;
        deckState.sunshine = {
          enabled: next.sunshineEnabled,
          user: next.sunshineUser,
          pass: next.sunshinePass,
          promptPass: next.sunshinePromptPass,
        };
        const set = new Set(deckState.flatpakApps);
        if (next.moonlight) set.add("moonlight");
        else set.delete("moonlight");
        deckState.flatpakApps = [...set];
        if (toggled) mountDeckStreaming(); // show/hide creds without stealing input focus
      },
    }),
  );
}

/** (Re)mount the Deck's shared SshAccessEditor. Re-mounts on GitHub blur to show a
 *  live key count (the keys themselves are fetched on-device by the provision script). */
function mountDeckSsh(): void {
  const mount = document.querySelector<HTMLElement>("#deck-ssh-mount");
  if (!mount) return;
  const ghUser = deckState.ssh.githubUser ?? "";
  mount.replaceChildren(
    SshAccessEditor({
      hostKeys: [],
      showPort: true,
      // Only show a count once fetched for THIS username (a restored profile would
      // otherwise show a stale "0 keys" before the fetch runs).
      githubKeyCount: ghUser && deckGithubFetchedFor === ghUser ? deckGithubKeys.length : null,
      value: {
        hostKeyIds: [],
        pastedKeys: deckState.ssh.authorizedKeys,
        githubUser: deckState.ssh.githubUser,
        port: deckState.ssh.port,
      },
      onChange: (next) => {
        deckState.ssh.authorizedKeys = next.pastedKeys;
        deckState.ssh.githubUser = next.githubUser;
        deckState.ssh.port = next.port ?? 22;
        deckState.ssh.enabled = next.pastedKeys.length > 0 || Boolean(next.githubUser);
      },
      onGithubUser: (user) => {
        void fetchDeckGithub(user);
      },
    }),
  );
  // A username we haven't fetched yet (e.g. just restored from a profile) → fetch it.
  if (ghUser && deckGithubFetchedFor !== ghUser) void fetchDeckGithub(ghUser);
}

/** Fetch the GitHub user's public keys to show a live count + re-mount (on blur). */
async function fetchDeckGithub(user: string): Promise<void> {
  deckGithubFetchedFor = user; // set before the await so the re-mount doesn't re-trigger
  deckGithubKeys = user ? ((await window.bootible?.githubKeys?.(user)) ?? []) : [];
  mountDeckSsh();
}

/** A picker row (ROG style): name + description + a "Choose … (N) →" button that
 *  navigates to a dedicated picker screen. */
function deckPickerRow(label: string, desc: string, count: number, target: string): HTMLElement {
  const row = el("div", "cz-row cz-picker");
  const text = el("div", "cz-text");
  text.append(el("div", "cz-name", label), el("div", "cz-desc", desc));
  const pick = el(
    "button",
    "cz-applink",
    `Choose ${label.toLowerCase()} (${count}) →`,
  ) as HTMLButtonElement;
  pick.type = "button";
  pick.dataset.go = target;
  text.append(pick);
  row.append(text);
  return row;
}

/** Update a picker screen's "N selected" eyebrow. */
function setDeckPickCount(view: string, n: number, word: string): void {
  const tag = document.querySelector(`#${view}-count`);
  if (tag) tag.textContent = `${n} ${word}${n === 1 ? "" : "s"} selected`;
}

/** 1234567 → "1.2M", 34000 → "34K", 999 → "999". */
function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/** A simple app-row (checkbox + name + meta), the ROG picker-item style. */
function deckItemRow(
  name: string,
  meta: string,
  checked: boolean,
  onChange: (v: boolean) => void,
): HTMLElement {
  const row = el("label", "app-row");
  const cb = el("input", "app-check") as HTMLInputElement;
  cb.type = "checkbox";
  cb.checked = checked;
  cb.addEventListener("change", () => onChange(cb.checked));
  const m = el("span", "app-meta");
  m.append(el("span", "app-name", name));
  if (meta) m.append(el("span", "app-id", meta));
  row.append(cb, m);
  return row;
}

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
  const rows = emus.map((a) =>
    deckItemRow(a.name, "", deckState.flatpakApps.includes(a.id), (v) => {
      const set = new Set(deckState.flatpakApps);
      if (v) set.add(a.id);
      else set.delete(a.id);
      deckState.flatpakApps = [...set];
      update();
    }),
  );
  box.replaceChildren(emudeck, ...rows);
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

export async function hydrateDeckWrite(): Promise<void> {
  await refreshDeckDisks();
  updateDeckWriteButton();
}

let deckDiskPicker: ReturnType<typeof DiskPicker> | null = null;
async function refreshDeckDisks(): Promise<void> {
  const list = document.querySelector<HTMLElement>("#deck-disk-list");
  if (!list) return;
  if (!deckDiskPicker) {
    deckDiskPicker = DiskPicker({
      fetch: async () => (await window.bootible?.getUsbDisks?.()) ?? [],
      mode: "letter",
      selected: deckDisk,
      onSelect: (k) => {
        deckDisk = k;
        updateDeckWriteButton();
      },
    });
    list.replaceChildren(deckDiskPicker.root);
  }
  await deckDiskPicker.refresh();
}

function updateDeckWriteButton(): void {
  const btn = document.querySelector<HTMLButtonElement>("#deck-write-btn");
  const confirmed =
    document.querySelector<HTMLInputElement>("#deck-erase-confirm")?.checked ?? false;
  if (btn) btn.disabled = !(confirmed && deckDisk);
}

async function startDeckWrite(): Promise<void> {
  const api = window.bootible;
  if (!api?.writeDeckProvisionUsb || !deckDisk) return;
  document.querySelector('[data-view="deckwrite"] .uw-go')?.setAttribute("hidden", "");
  document.querySelector("#deck-progress")?.removeAttribute("hidden");
  onDeckProgress({
    pct: 1,
    message: "Formatting — accept the admin (UAC) prompt…",
    status: "running",
  });
  const result = await api.writeDeckProvisionUsb({ driveLetter: deckDisk, config: deckState });
  if (result && !result.started) {
    onDeckProgress({ pct: 0, message: "Couldn't start the write.", status: "error" });
  }
}

// Both Deck writers (provision-only + reimage) stream on usb:progress; route to
// whichever screen is active by its element prefix.
function onDeckProgress(event: UsbProgress): void {
  const view = document.body.dataset.view;
  const pfx = view === "deckreimage" ? "deckre" : view === "deckwrite" ? "deck" : null;
  if (!pfx) return;
  const msg = document.querySelector(`#${pfx}-msg`);
  const fill = document.querySelector<HTMLElement>(`#${pfx}-fill`);
  const pct = document.querySelector(`#${pfx}-pct`);
  if (msg) msg.textContent = event.message;
  if (fill) fill.style.width = `${event.pct}%`;
  if (pct) {
    const doneText =
      pfx === "deckre"
        ? "Done — boot the Deck from this USB and choose Reimage."
        : "Done — eject it and run bootible/provision.sh on your Deck.";
    pct.textContent =
      event.status === "error"
        ? "Failed — see the message above."
        : event.status === "done"
          ? doneText
          : `${event.pct}% — keep the app open.`;
  }
  // Offer Eject once the provision-only write finishes (reimage USBs are booted, not ejected).
  if (pfx === "deck") {
    document
      .querySelector("#deck-done-actions")
      ?.toggleAttribute("hidden", event.status !== "done");
  }
}

window.bootible?.onUsbProgress?.(onDeckProgress);

document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (target.closest("#deck-disk-refresh")) {
    void refreshDeckDisks();
    return;
  }
  // Disk selection is owned by the shared DiskPicker (refreshDeckDisks).
  if (target.closest("#deck-write-btn")) void startDeckWrite();
  // Hop to the Watch screen so the Deck can report "done" back to the host once
  // provision.sh finishes (the beacon carries this build's id → flagged "mine").
  if (target.closest("#deck-watch-btn")) location.hash = "watch";
  if (target.closest("#deck-usb-eject")) {
    void (async () => {
      const pct = document.querySelector("#deck-pct");
      if (pct) pct.textContent = "Ejecting…";
      const r = await window.bootible?.ejectUsb?.(deckDisk);
      if (pct)
        pct.textContent = r?.ok
          ? "✓ Ejected — safe to remove."
          : "Couldn't eject — close any windows on the drive and try again.";
    })();
  }
});

document.addEventListener("change", (event) => {
  if ((event.target as HTMLElement).id === "deck-erase-confirm") updateDeckWriteButton();
});

// ── Deck full reimage (Path B) ───────────────────────────────────────────────
let deckReDisk = -1; // selected USB disk NUMBER (flash needs the whole disk)

export async function hydrateDeckReimage(): Promise<void> {
  const imgEl = document.querySelector("#deckre-image");
  if (imgEl) imgEl.textContent = "Finding the latest image…";
  void window.bootible?.resolveDeckImage?.().then((r) => {
    if (imgEl) {
      imgEl.textContent = r ? r.name : "Couldn't reach the image server — check your connection.";
    }
  });
  await refreshDeckReimageDisks();
  updateDeckReimageButton();
}

let deckReDiskPicker: ReturnType<typeof DiskPicker> | null = null;
async function refreshDeckReimageDisks(): Promise<void> {
  const list = document.querySelector<HTMLElement>("#deckre-disk-list");
  if (!list) return;
  if (!deckReDiskPicker) {
    deckReDiskPicker = DiskPicker({
      fetch: async () => (await window.bootible?.getUsbDisks?.()) ?? [],
      mode: "number",
      selected: deckReDisk >= 0 ? String(deckReDisk) : "",
      onSelect: (k) => {
        deckReDisk = Number(k);
        updateDeckReimageButton();
      },
    });
    list.replaceChildren(deckReDiskPicker.root);
  }
  await deckReDiskPicker.refresh();
}

function updateDeckReimageButton(): void {
  const btn = document.querySelector<HTMLButtonElement>("#deckre-write-btn");
  const confirmed =
    document.querySelector<HTMLInputElement>("#deckre-erase-confirm")?.checked ?? false;
  if (btn) btn.disabled = !(confirmed && deckReDisk >= 0);
}

async function startDeckReimage(): Promise<void> {
  const api = window.bootible;
  if (!api?.writeDeckReimageUsb || deckReDisk < 0) return;
  document.querySelector('[data-view="deckreimage"] .uw-go')?.setAttribute("hidden", "");
  document.querySelector("#deckre-progress")?.removeAttribute("hidden");
  onDeckProgress({
    pct: 1,
    message: "Starting — accept the admin (UAC) prompt…",
    status: "running",
  });
  const result = await api.writeDeckReimageUsb({ diskNumber: deckReDisk, config: deckState });
  if (result && !result.started) {
    onDeckProgress({ pct: 0, message: "Couldn't start the write.", status: "error" });
  }
}

document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (target.closest("#deckre-disk-refresh")) {
    void refreshDeckReimageDisks();
    return;
  }
  // Disk selection is owned by the shared DiskPicker (refreshDeckReimageDisks).
  if (target.closest("#deckre-write-btn")) void startDeckReimage();
});

document.addEventListener("change", (event) => {
  if ((event.target as HTMLElement).id === "deckre-erase-confirm") updateDeckReimageButton();
});
