import { NetworkSettings } from "../../components/NetworkSettings";
import { RemoteAccessSettings } from "../../components/RemoteAccessSettings";
import { SshAccessEditor } from "../../components/SshAccessEditor";
import { StreamingSettings } from "../../components/StreamingSettings";
import { el } from "../../lib/dom";
import {
  countOn,
  deckCheck,
  deckProfileBar,
  deckSection,
  deckState,
  updateDeckSummary,
} from "./config";

let deckGithubKeys: string[] = []; // last GitHub-key lookup, for the SSH editor live count
let deckGithubFetchedFor = ""; // the username deckGithubKeys was fetched for
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
export function setDeckPickCount(view: string, n: number, word: string): void {
  const tag = document.querySelector(`#${view}-count`);
  if (tag) tag.textContent = `${n} ${word}${n === 1 ? "" : "s"} selected`;
}

/** 1234567 → "1.2M", 34000 → "34K", 999 → "999". */
export function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/** A simple app-row (checkbox + name + meta), the ROG picker-item style. */
export function deckItemRow(
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
