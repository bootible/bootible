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
