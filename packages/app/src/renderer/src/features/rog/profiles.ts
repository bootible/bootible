import type { Profile, StaticIp } from "@bootible/core";
import { ProfileBar } from "../../components/ProfileBar";
import { rog } from "../../lib/rog-state";
import { session } from "../../lib/session";
import {
  fetchRogGithub,
  mountRogNetwork,
  mountRogSsh,
  mountRogStreaming,
  updateEditionState,
} from "./account";
import { hydrateCustomise } from "./customise";

// ── config profiles: capture / apply the whole UI state ─────────────────────
// A pure typed round-trip: capture/apply read + write rog.* only (the account
// inputs mirror rog via account.ts), so a Profile is a snapshot of the typed state
// — never the DOM. Matches the Deck's deckState clone.

/** Snapshot every UI selection into a Profile (passwords go in `secrets`, which
 *  main encrypts with DPAPI). */
function captureProfile(name: string): Profile {
  return {
    name,
    deviceModel: session.deviceId || undefined,
    baseId: rog.selectedBaseId || undefined,
    ui: {
      selectedApps: [...rog.selectedApps],
      selectedRemovals: [...rog.selectedRemovals],
      enabledExtras: [...rog.enabledExtras],
      disabledModules: [...rog.disabledModules],
      selectedKeyIds: [...rog.selectedKeyIds],
      githubUser: rog.githubUser,
      sshPaste: rog.pastedKeys.join("\n"),
      hostname: rog.hostname,
      staticIp: rog.staticIp, // the whole {iface,ip,prefix,gateway,dns}, not just the address
      edition: rog.edition,
      accountMode: rog.accountMode,
      acctUser: rog.acctUser,
      sunshineUser: rog.sunshineUser,
      sunshinePromptPass: rog.sunshinePromptPass,
      wifiSsid: rog.wifiSsid,
      ra: { sunshine: rog.sunshineEnabled, moonlight: rog.moonlight, rdp: rog.rdp },
      raHost: { sunshine: rog.sunshineHost, moonlight: rog.moonlightHost },
      wallpaperPath: rog.wallpaperPath,
      lockscreenPath: rog.lockscreenPath,
    },
    secrets: {
      sunshinePass: rog.sunshinePromptPass ? "" : rog.sunshinePass,
      acctPass: rog.acctPass,
      wifiPass: rog.wifiPass,
    },
  };
}

/** Restore a loaded Profile into the UI (Sets, inputs, checkboxes, derived UI). */
function applyProfile(p: Profile): void {
  rog.loadedProfileName = p.name ?? "";
  const ui = (p.ui ?? {}) as Record<string, unknown>;
  const list = (k: string) => (Array.isArray(ui[k]) ? (ui[k] as string[]) : []);
  rog.selectedBaseId = p.baseId ?? "";
  const restore = (set: Set<string>, k: string) => {
    set.clear();
    for (const v of list(k)) set.add(v);
  };
  // The lookup keys must match captureProfile's `ui` keys exactly (a bare
  // "selectedApps", not "rog.selectedApps") — else a loaded profile restores
  // nothing into these Sets.
  restore(rog.selectedApps, "selectedApps");
  restore(rog.selectedRemovals, "selectedRemovals");
  restore(rog.enabledExtras, "enabledExtras");
  restore(rog.disabledModules, "disabledModules");
  restore(rog.selectedKeyIds, "selectedKeyIds");
  rog.githubUser = typeof ui.githubUser === "string" ? ui.githubUser : "";
  rog.pastedKeys =
    typeof ui.sshPaste === "string"
      ? ui.sshPaste
          .split("\n")
          .map((k) => k.trim())
          .filter(Boolean)
      : [];
  rog.hostname = typeof ui.hostname === "string" ? ui.hostname : "";
  // Restore static IP into the held config + re-mount the editor. Handles legacy
  // profiles where staticIp was just the address string + a separate staticIpIface.
  const savedIp = ui.staticIp;
  if (savedIp && typeof savedIp === "object") {
    rog.staticIp = savedIp as StaticIp;
  } else if (typeof savedIp === "string" && savedIp.trim()) {
    rog.staticIp = {
      iface: (ui.staticIpIface as "wifi" | "ethernet") || "wifi",
      ip: savedIp.trim(),
      prefix: rog.netSuggestion?.prefix ?? 24,
      gateway: rog.netSuggestion?.gateway,
      dns: rog.netSuggestion?.gateway,
    };
  } else {
    rog.staticIp = undefined;
  }
  rog.intendedStaticIp = rog.staticIp?.ip ?? "";
  mountRogNetwork();
  rog.edition = ui.edition === "pro" ? "pro" : "home";
  rog.accountMode = ui.accountMode === "microsoft" ? "microsoft" : "local";
  rog.acctUser = typeof ui.acctUser === "string" ? ui.acctUser : "";
  rog.wifiSsid = typeof ui.wifiSsid === "string" ? ui.wifiSsid : "";
  rog.sunshineUser = typeof ui.sunshineUser === "string" ? ui.sunshineUser : "";
  const ra = (ui.ra ?? {}) as Record<string, unknown>;
  rog.sunshineEnabled = Boolean(ra.sunshine);
  rog.moonlight = Boolean(ra.moonlight);
  rog.rdp = Boolean(ra.rdp);
  const raHost = (ui.raHost ?? {}) as Record<string, unknown>;
  rog.sunshineHost = Boolean(raHost.sunshine);
  rog.moonlightHost = Boolean(raHost.moonlight);
  rog.sunshinePromptPass = Boolean(ui.sunshinePromptPass);
  rog.sunshinePass = rog.sunshinePromptPass ? "" : (p.secrets?.sunshinePass ?? "");
  // Edition was restored just above; clamp RDP to Pro and (re)mount both the
  // streaming + remote-access components from the restored JS state.
  updateEditionState();
  mountRogStreaming();
  rog.acctPass = p.secrets?.acctPass ?? "";
  rog.wifiPass = p.secrets?.wifiPass ?? "";
  rog.wallpaperPath = (ui.wallpaperPath as string) ?? "";
  rog.lockscreenPath = (ui.lockscreenPath as string) ?? "";
  // Show the remembered image filenames on the picker buttons (the paths are saved
  // but the labels were blank, so it looked like the images weren't remembered).
  const imgName = (path: string) => (path ? (path.split(/[\\/]/).pop() ?? path) : "");
  const wn = document.querySelector("#wallpaper-name");
  if (wn) wn.textContent = imgName(rog.wallpaperPath);
  const ln = document.querySelector("#lockscreen-name");
  if (ln) ln.textContent = imgName(rog.lockscreenPath);
  document.body.classList.toggle("is-strip", rog.selectedBaseId === "full-rog");
  // Re-fetch the restored GitHub user's keys so they're baked + counted, then
  // (re)mount the SSH editor with the restored selection.
  if (rog.githubUser) void fetchRogGithub(rog.githubUser);
  else mountRogSsh();
  rog.customiseHydrated = false; // re-resolve the plan for the restored base
  rog.keepRestoredCustomise = true; // ...but keep the restored extras/disabled modules
}

/** Render the shared ProfileBar on the ROG configure (customise) screen — same
 *  component + behaviour as the Deck. Load at the start (customise) + save at the
 *  end (account); one function, two mounts/modes. */
export async function mountRogProfileBar(mode: "load" | "save"): Promise<void> {
  const mount = document.querySelector<HTMLElement>(
    mode === "load" ? "#rog-profile-load" : "#rog-profile-mount",
  );
  if (!mount) return;
  const grouped = (await window.bootible?.groupProfiles?.(session.deviceId)) ?? {
    model: [],
    family: [],
  };
  const save = async (name: string): Promise<void> => {
    const r = await window.bootible?.saveProfile?.(captureProfile(name));
    if (r?.ok) {
      rog.loadedProfileName = r.name;
      rog.profileStatus = `✓ Saved "${r.name}" to this PC`;
      void window.bootible?.cloud?.syncNow(); // push if signed in + unlocked
    } else {
      rog.profileStatus = "Save failed.";
    }
    void mountRogProfileBar("save");
  };
  mount.replaceChildren(
    ProfileBar({
      mode,
      profiles: grouped,
      modelLabel: `This ${session.deviceName || "device"}`,
      familyLabel: "Other compatible devices",
      loadedName: rog.loadedProfileName || null,
      status: rog.profileStatus,
      onLoad: async (name) => {
        const p = await window.bootible?.loadProfile?.(name);
        if (p) {
          applyProfile(p); // restores account UI (ssh/network/hostname) + marks customise stale
          rog.loadedProfileName = name;
          rog.profileStatus = `Loaded "${name}"`;
          void hydrateCustomise(); // re-render customise + the load bar with restored config
        }
      },
      onSaveNew: save,
      onUpdate: save,
      onDelete: async (name) => {
        await window.bootible?.deleteProfile?.(name);
        if (rog.loadedProfileName === name) rog.loadedProfileName = "";
        rog.profileStatus = `Deleted "${name}"`;
        void mountRogProfileBar(mode);
      },
    }),
  );
}
