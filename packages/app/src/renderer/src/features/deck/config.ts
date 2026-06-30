import type { DeckConfig, Profile } from "@bootible/core";
import { DEFAULT_DECK_CONFIG } from "@bootible/core/browser";
import { ProfileBar } from "../../components/ProfileBar";
import { el } from "../../lib/dom";
import { session } from "../../lib/session";
// applyDeckProfile re-hydrates the setup screen after a load (function-level
// import — safe with the setup→config dependency; neither runs at module top).
import { hydrateDeck, hydrateDeckSetup } from "./setup";

// ── Steam Deck config + provision-only USB (Path A) ──────────────────────────

/** The Deck choices — the single source of truth (buildDeckBundle normalizes).
 *  Seeded from core's DEFAULT_DECK_CONFIG (deep-cloned so the UI can mutate it),
 *  so the renderer never re-hardcodes the defaults — one source, no drift. */
export const deckState: DeckConfig = structuredClone(DEFAULT_DECK_CONFIG);

/** A rich toggle row in the ROG `.cz-*` style: name + description + an optional
 *  "what it does" line, bound to a setter on deckState. */
export function deckCheck(
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
export function deckSection(title: string, rows: HTMLElement[], count?: number): HTMLElement {
  const sec = el("div", "cz-sec");
  const head = el("div", "cz-sec-h", title);
  if (count !== undefined) head.append(el("span", "cz-sec-count", ` · ${count}`));
  const grid = el("div", "cz-sec-rows");
  grid.append(...rows);
  sec.append(head, grid);
  return sec;
}

/** Count the truthy flags — for a section's "· N" header. */
export function countOn(...flags: boolean[]): number {
  return flags.filter(Boolean).length;
}

export function updateDeckSummary(): void {
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
export async function deckProfileBar(mode: "load" | "save"): Promise<HTMLElement> {
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
