import type { AppGroup, BaseOption, GroupSummary, HostSshKey, StaticIp } from "@bootible/core";

/**
 * The shared mutable state of the ROG (Windows) flow — the ~35 module-level vars
 * the device-pick → customise → apps → ssh → bundles → method → provisioning →
 * profiles → USB-writer → watch screens all read and write. Centralised here as one
 * object (reassign its properties; mutate the Sets/objects in place) so those
 * screens can move into `features/rog/*` without each owning a slice of a
 * god-file's `let`s. The `rog*`-prefixed originals drop the prefix here.
 */
export const rog = {
  // ── SSH / GitHub (the sign-in key editor) ──
  sshHydrated: false,
  githubKeys: [] as string[], // keys fetched from the chosen GitHub user (baked at build)
  githubFetchedFor: "", // the username githubKeys was fetched for
  pastedKeys: [] as string[], // was rogPastedKeys
  githubUser: "", // was rogGithubUser
  hostSshKeys: [] as HostSshKey[],
  selectedKeyIds: new Set<string>(),
  // ── streaming / remote access ──
  sunshineEnabled: false,
  sunshineUser: "",
  sunshinePass: "", // held in JS; the shared PasswordField owns the input
  sunshinePromptPass: false, // defer — set on the device instead of baking onto the USB
  sunshineHost: false, // also install the Sunshine host on this PC
  moonlight: false,
  moonlightHost: false, // also install the Moonlight client on this PC
  rdp: false, // Windows Remote Desktop (Pro only)
  // ── account / clean-install (the typed source of truth — the account-screen
  //    inputs mirror these, so profile capture + gatherUsbRequest read state, not
  //    the DOM; matches the Deck's deckState round-trip) ──
  hostname: "",
  edition: "home" as "home" | "pro",
  accountMode: "local" as "local" | "microsoft",
  acctUser: "ally", // clean-install local admin (the input defaults to "ally" too)
  acctPass: "", // held in JS like sunshinePass; the DOM input mirrors it
  wifiSsid: "",
  wifiPass: "",
  // ── base / catalog / customise ──
  baseOptions: [] as BaseOption[], // cached base list (device summary + customise label)
  catalog: [] as GroupSummary[],
  selectedBaseId: "",
  loadedProfileName: "", // the profile currently loaded (drives Update vs Save-as-new)
  customiseHydrated: false,
  keepRestoredCustomise: false,
  disabledModules: new Set<string>(), // unticked floor/base modules
  enabledExtras: new Set<string>(), // ticked optional extras (incl. "apps")
  selectedRemovals: new Set<string>(),
  // ── app / emulator picker ──
  appGroups: [] as AppGroup[],
  selectedApps: new Set<string>(),
  defaultBrowser: undefined as string | undefined, // catalog id of the browser to set default
  openGroups: new Set<string>(), // which app-picker groups are expanded
  appsHydrated: false,
  pickerMode: "apps" as "apps" | "emulators",
  // ── network ──
  netSuggestion: null as { prefix: number; gateway: string; subnet: string } | null,
  intendedStaticIp: "",
  staticIp: undefined as StaticIp | undefined, // was rogStaticIp
  // ── personalize ──
  wallpaperPath: "",
  lockscreenPath: "",
  // ── profiles ──
  profileStatus: "", // was rogProfileStatus
  // ── in-app USB writer ──
  usbState: { isoId: "", isoPath: "", regionId: "", disk: -1 } as {
    isoId: string;
    isoPath: string;
    regionId: string;
    disk: number;
  },
};
