import { NetworkSettings } from "../../components/NetworkSettings";
import { RemoteAccessSettings } from "../../components/RemoteAccessSettings";
import { SshAccessEditor } from "../../components/SshAccessEditor";
import { StreamingSettings } from "../../components/StreamingSettings";
import { el, fill } from "../../lib/dom";
import { rog } from "../../lib/rog-state";
import { hydrateDevices, hydratePlatforms, selectDeviceAndGo } from "./device";

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
