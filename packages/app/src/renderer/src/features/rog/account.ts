import { defaultBrowserSelect } from "../../components/DefaultBrowser";
import { NetworkSettings } from "../../components/NetworkSettings";
import { RemoteAccessSettings } from "../../components/RemoteAccessSettings";
import { Section } from "../../components/Section";
import { SshAccessEditor } from "../../components/SshAccessEditor";
import { StreamingSettings } from "../../components/StreamingSettings";
import { ACCESS_LABELS } from "../../lib/access-labels";
import { el, fill } from "../../lib/dom";
import { rog } from "../../lib/rog-state";
import { hydrateDevices, hydratePlatforms, selectDeviceAndGo } from "./device";

// ── Account screen scaffolding ──────────────────────────────────────────────
// hydrateAccount() builds the config as shared Section cards — the same treatment
// (and the same ACCESS_LABELS) the Deck's device-setup screen uses, so the two
// "Account & access" pages match. Every element id the mount fns + delegated
// handlers rely on is preserved, so the write/gather logic is untouched.

/** A Deck-style labelled input field (cz-name/cz-desc + uw-select), full width. */
function accountField(
  id: string,
  type: string,
  label: string,
  desc: string | undefined,
  placeholder?: string,
): HTMLElement {
  const wrap = el("div", "cz-span deck-field");
  wrap.append(el("div", "cz-name", label));
  if (desc) wrap.append(el("div", "cz-desc", desc));
  const input = el("input", "uw-select") as HTMLInputElement;
  input.id = id;
  input.type = type;
  input.autocomplete = "off";
  input.spellcheck = false;
  if (placeholder) input.placeholder = placeholder;
  wrap.append(input);
  return wrap;
}

/** A Section whose single row is an empty mount div (filled by a mountRog* fn). */
function mountSection(label: string, mountId: string, count?: number): HTMLElement {
  const mount = el("div", "cz-span");
  mount.id = mountId;
  return Section(label, [mount], count);
}

/** Windows-edition radios (Home/Pro) — clean-install only (hidden in strip mode). */
function editionSection(): HTMLElement {
  const pick = el("div", "edition-pick cz-span");
  const opt = (id: string, text: string, checked: boolean): HTMLElement => {
    const lab = el("label", "edition-opt");
    const radio = el("input") as HTMLInputElement;
    radio.type = "radio";
    radio.name = "edition";
    radio.id = id;
    radio.checked = checked;
    lab.append(radio, el("span", "", text));
    return lab;
  };
  pick.append(
    opt("edition-home", "Home", rog.edition !== "pro"),
    opt("edition-pro", "Pro", rog.edition === "pro"),
  );
  const sec = Section("Windows edition", [pick]);
  sec.dataset.clean = "";
  return sec;
}

/** Wallpaper + lock-screen pickers (name spans re-hydrated from rog state). */
function personalizeSection(): HTMLElement {
  const pick = (btnId: string, nameId: string, text: string, path: string): HTMLElement => {
    const row = el("div", "img-pick");
    const btn = el("button", "img-btn", text) as HTMLButtonElement;
    btn.type = "button";
    btn.id = btnId;
    const name = el("span", "img-name");
    name.id = nameId;
    if (path) name.textContent = path.split(/[\\/]/).pop() ?? "";
    row.append(btn, name);
    return row;
  };
  const wrap = el("div", "cz-span");
  wrap.append(
    pick("pick-wallpaper", "wallpaper-name", "Choose wallpaper…", rog.wallpaperPath),
    pick("pick-lockscreen", "lockscreen-name", "Choose lock screen…", rog.lockscreenPath),
  );
  return Section("Personalize", [wrap]);
}

/** Build the account-screen config as Section cards. Must run before the mountRog*
 *  fns and syncAccountInputsFromState (they query the ids created here). */
export function hydrateAccount(): void {
  const host = document.getElementById("account-sections");
  if (!host) return;

  const user = accountField("acct-user", "text", "Username", undefined);
  const pass = accountField(
    "acct-pass",
    "password",
    "Password (optional)",
    undefined,
    "leave blank for none",
  );
  const localAccount = Section("Local account", [user, pass]);
  localAccount.dataset.when = "local";
  localAccount.dataset.clean = "";

  const sections = [
    Section(ACCESS_LABELS.deviceName, [
      accountField("device-hostname", "text", "Device name (for SSH)", undefined, "my-handheld"),
    ]),
    mountSection(ACCESS_LABELS.network, "static-ip-mount", rog.staticIp ? 1 : 0),
    editionSection(),
    localAccount,
    mountSection(ACCESS_LABELS.streaming, "rog-streaming-mount"),
    mountSection(ACCESS_LABELS.remote, "rog-remote-access-mount"),
    mountSection(ACCESS_LABELS.ssh, "ssh-mount"),
  ];
  // Default browser — only when a browser was picked in the app list (Windows opens
  // its Default-apps prompt for a one-tap set; MS blocks the automated path).
  const browserSel = defaultBrowserSelect([...rog.selectedApps], rog.defaultBrowser, (id) => {
    rog.defaultBrowser = id;
  });
  if (browserSel) {
    const wrap = el("div", "cz-span deck-field");
    wrap.append(el("div", "cz-name", "Default browser"), browserSel);
    sections.push(Section("Default browser", [wrap]));
  }
  sections.push(personalizeSection());
  host.replaceChildren(...sections);
}

// ── SSH source: BYO key / GitHub / Both ─────────────────────────────────────
// ROG game-streaming + remote-access state — the single source of truth (the
// shared StreamingSettings / RemoteAccessSettings render from it; gather/profile
// read it), the same pattern the Sunshine password already used.

function currentEditionIsPro(): boolean {
  return rog.edition === "pro";
}

// The account-screen text/radio inputs mirror the typed rog.* fields (hostname,
// edition, account mode, local-admin user/pass, WiFi ssid/pass). rog is the source
// of truth — these two functions keep the DOM and state in sync so profile capture
// + gatherUsbRequest read state, never the DOM (matches the Deck's deckState model).
const ACCT_INPUTS: { id: string; get: () => string; set: (v: string) => void }[] = [
  { id: "device-hostname", get: () => rog.hostname, set: (v) => (rog.hostname = v) },
  { id: "acct-user", get: () => rog.acctUser, set: (v) => (rog.acctUser = v) },
  { id: "acct-pass", get: () => rog.acctPass, set: (v) => (rog.acctPass = v) },
  { id: "wifi-ssid", get: () => rog.wifiSsid, set: (v) => (rog.wifiSsid = v) },
  { id: "wifi-pass", get: () => rog.wifiPass, set: (v) => (rog.wifiPass = v) },
];

/** Push the typed rog.* account fields into the screen's inputs. Call on entering
 *  the account screen (and after a profile load) so the DOM reflects the state. */
export function syncAccountInputsFromState(): void {
  for (const f of ACCT_INPUTS) {
    const input = document.getElementById(f.id) as HTMLInputElement | null;
    if (input) input.value = f.get();
  }
  const pro = document.getElementById("edition-pro") as HTMLInputElement | null;
  const home = document.getElementById("edition-home") as HTMLInputElement | null;
  if (pro) pro.checked = rog.edition === "pro";
  if (home) home.checked = rog.edition !== "pro";
  document.body.dataset.account = rog.accountMode;
}

// Mirror keystrokes/edits in those inputs straight back into rog (the source of truth).
document.addEventListener("input", (event) => {
  const t = event.target as HTMLElement;
  const field = ACCT_INPUTS.find((f) => f.id === t.id);
  if (field) field.set((t as HTMLInputElement).value);
});

/** (Re)mount the shared StreamingSettings for the ROG (Sunshine host + creds +
 *  Moonlight + the "also set it up on this PC" host toggles). */
export function mountRogStreaming(): void {
  const mount = document.querySelector<HTMLElement>("#rog-streaming-mount");
  if (!mount) return;
  mount.replaceChildren(
    StreamingSettings({
      showHost: true,
      value: {
        sunshineEnabled: rog.sunshineEnabled,
        sunshineUser: rog.sunshineUser || undefined,
        sunshinePass: rog.sunshinePromptPass ? undefined : rog.sunshinePass || undefined,
        sunshinePromptPass: rog.sunshinePromptPass,
        sunshineHost: rog.sunshineHost,
        moonlight: rog.moonlight,
        moonlightHost: rog.moonlightHost,
      },
      onChange: (next) => {
        // Re-mount only when a toggle changes which fields show, so typing in
        // user/password keeps focus (matches the Deck's mountDeckStreaming).
        const toggled =
          rog.sunshineEnabled !== next.sunshineEnabled ||
          rog.moonlight !== next.moonlight ||
          Boolean(rog.sunshinePromptPass) !== Boolean(next.sunshinePromptPass);
        rog.sunshineEnabled = next.sunshineEnabled;
        rog.sunshineUser = next.sunshineUser ?? "";
        rog.sunshinePromptPass = Boolean(next.sunshinePromptPass);
        rog.sunshinePass = next.sunshinePromptPass ? "" : (next.sunshinePass ?? "");
        rog.sunshineHost = Boolean(next.sunshineHost);
        rog.moonlight = next.moonlight;
        rog.moonlightHost = Boolean(next.moonlightHost);
        if (toggled) mountRogStreaming();
      },
    }),
  );
}

/** (Re)mount the shared RemoteAccessSettings for the ROG (just RDP; disabled — and
 *  cleared — unless the edition is Pro, since Home can't host Remote Desktop). */
export function mountRogRemoteAccess(): void {
  const mount = document.querySelector<HTMLElement>("#rog-remote-access-mount");
  if (!mount) return;
  const pro = currentEditionIsPro();
  mount.replaceChildren(
    RemoteAccessSettings({
      options: [
        {
          id: "rdp",
          label: "Windows Remote Desktop",
          desc: "The full Windows desktop via mstsc, from another machine.",
          enabled: rog.rdp && pro,
          disabled: !pro,
          note: pro ? undefined : "needs Windows Pro — switch the edition above",
        },
      ],
      onToggle: (_id, on) => {
        rog.rdp = on;
      },
    }),
  );
}

/** (Re)mount the shared SshAccessEditor on the ROG account screen (host-key
 *  discovery + GitHub + paste; keys enable SSH). */
export function mountRogSsh(): void {
  const mount = document.querySelector<HTMLElement>("#ssh-mount");
  if (!mount) return;
  const editor = SshAccessEditor({
    hostKeys: rog.hostSshKeys,
    value: {
      hostKeyIds: [...rog.selectedKeyIds],
      pastedKeys: rog.pastedKeys,
      githubUser: rog.githubUser || undefined,
    },
    // Only show a count once we've actually fetched for THIS username (else a
    // restored profile would show a stale "0 keys" before the fetch runs).
    githubKeyCount:
      rog.githubUser && rog.githubFetchedFor === rog.githubUser ? rog.githubKeys.length : null,
    onChange: (next) => {
      rog.selectedKeyIds.clear();
      for (const id of next.hostKeyIds) rog.selectedKeyIds.add(id);
      rog.pastedKeys = next.pastedKeys;
      rog.githubUser = next.githubUser ?? "";
    },
    onGithubUser: (user) => {
      void fetchRogGithub(user);
    },
  });
  mount.replaceChildren(editor);
  // No SSH key on this PC yet? Offer to generate one (handler at #ssh-generate).
  if (rog.hostSshKeys.length === 0) {
    const gen = el("button", "linkbtn", "Generate a key on this PC") as HTMLButtonElement;
    gen.type = "button";
    gen.id = "ssh-generate";
    editor.prepend(gen);
  }
  // A username we haven't fetched yet (e.g. just restored from a profile) → fetch it.
  if (rog.githubUser && rog.githubFetchedFor !== rog.githubUser)
    void fetchRogGithub(rog.githubUser);
}

/** Fetch the GitHub user's public keys (baked into the build) + re-mount to show
 *  the live count. Runs on blur, so the re-mount doesn't steal focus mid-type. */
export async function fetchRogGithub(user: string): Promise<void> {
  rog.githubFetchedFor = user; // set before the await so the re-mount doesn't re-trigger
  rog.githubKeys = user ? ((await window.bootible?.githubKeys?.(user)) ?? []) : [];
  mountRogSsh();
}

/** RDP is only usable on Pro (Home can't host Remote Desktop), so clear it on Home
 *  and re-mount the remote-access component (which greys the toggle out). */
export function updateEditionState(): void {
  if (!currentEditionIsPro()) rog.rdp = false;
  mountRogRemoteAccess();
}

/** Fetch the host's SSH public keys and pre-select them all the first time. */
export async function hydrateSshKeys(): Promise<void> {
  const api = window.bootible;
  if (!api?.getHostSshKeys) return;
  try {
    rog.hostSshKeys = await api.getHostSshKeys();
  } catch {
    rog.hostSshKeys = [];
  }
  if (!rog.sshHydrated) {
    for (const k of rog.hostSshKeys) rog.selectedKeyIds.add(k.id);
    rog.sshHydrated = true;
  }
  mountRogSsh();
  updateEditionState();
  // Learn this PC's subnet so the network editor can infer prefix/gateway/dns
  // (the user types only the host), then mount the shared NetworkSettings editor.
  if (!rog.netSuggestion && api.suggestNetwork) {
    try {
      rog.netSuggestion = await api.suggestNetwork();
    } catch {}
  }
  mountRogNetwork();
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
    rog.selectedBaseId = id;
    rog.customiseHydrated = false; // re-resolve the plan for the newly chosen base
    // Full ROG reuses the account screen for SSH/access but hides the
    // clean-install-only fields (account mode, edition, password).
    document.body.classList.toggle("is-strip", id === "full-rog");
    location.hash = "customise";
  }
});

void hydratePlatforms();

export function mountRogNetwork(): void {
  const mount = document.querySelector<HTMLElement>("#static-ip-mount");
  if (!mount) return;
  const infer = rog.netSuggestion
    ? {
        prefix: rog.netSuggestion.prefix,
        gateway: rog.netSuggestion.gateway,
        dns: rog.netSuggestion.gateway,
      }
    : undefined;
  mount.replaceChildren(
    NetworkSettings({
      value: rog.staticIp,
      interfaces: ["wifi", "ethernet"],
      infer,
      onChange: (next) => {
        rog.staticIp = next;
        rog.intendedStaticIp = next?.ip ?? "";
      },
    }),
  );
}
