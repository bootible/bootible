import { el } from "../lib/dom";

export interface RemoteAccessOption {
  id: string;
  label: string;
  desc: string;
  enabled: boolean;
  /** Greyed out + uncheckable (e.g. RDP on Windows Home). */
  disabled?: boolean;
  /** Why it's disabled, shown alongside. */
  note?: string;
}

export interface RemoteAccessSettingsOptions {
  options: readonly RemoteAccessOption[];
  onToggle(id: string, enabled: boolean): void;
}

/**
 * Capability-driven remote-access toggles shared across devices — each device passes
 * the options it supports (Deck: VNC + Tailscale; ROG: RDP). SSH lives in its own
 * editor; this is the rest of "reach this device remotely".
 */
export function RemoteAccessSettings(o: RemoteAccessSettingsOptions): HTMLElement {
  const root = el("div", "remote-access");
  for (const opt of o.options) {
    const row = el(
      "label",
      `cz-row cz-span${opt.enabled ? "" : " is-off"}${opt.disabled ? " is-disabled" : ""}`,
    );
    const cb = el("input", "cz-check") as HTMLInputElement;
    cb.type = "checkbox";
    cb.dataset.toggle = opt.id;
    cb.checked = opt.enabled;
    cb.disabled = Boolean(opt.disabled);
    cb.addEventListener("change", () => o.onToggle(opt.id, cb.checked));
    const meta = el("span", "cz-text");
    meta.append(el("span", "cz-name", opt.label));
    const desc = opt.note ? `${opt.desc} (${opt.note})` : opt.desc;
    meta.append(el("span", "cz-desc", desc));
    row.append(cb, meta);
    root.append(row);
  }
  return root;
}
