import { el } from "../lib/dom";
import { PasswordField } from "./PasswordField";

export interface StreamingValue {
  sunshineEnabled: boolean;
  sunshineUser?: string;
  sunshinePass?: string;
  /** Set the Sunshine password on the device during setup, not baked onto the USB. */
  sunshinePromptPass?: boolean;
  moonlight: boolean;
}

export interface StreamingSettingsOptions {
  value: StreamingValue;
  onChange(next: StreamingValue): void;
}

/** A labelled checkbox row (name + description). */
function toggleRow(
  toggle: string,
  label: string,
  desc: string,
  checked: boolean,
  onToggle: (on: boolean) => void,
): HTMLElement {
  const row = el("label", `cz-row cz-span${checked ? "" : " is-off"}`);
  const cb = el("input", "cz-check") as HTMLInputElement;
  cb.type = "checkbox";
  cb.dataset.toggle = toggle;
  cb.checked = checked;
  cb.addEventListener("change", () => onToggle(cb.checked));
  const meta = el("span", "cz-text");
  meta.append(el("span", "cz-name", label), el("span", "cz-desc", desc));
  row.append(cb, meta);
  return row;
}

/**
 * Game-streaming settings shared across devices (cohesion): Sunshine host (with
 * credentials) + Moonlight client. The Sunshine password uses PasswordField, so the
 * plaintext-on-USB warning + "set it on the device instead" choice are consistent
 * everywhere. The device wires what "on the device" means (Deck prompts in
 * provision.sh; ROG sets it on first run).
 */
export function StreamingSettings(o: StreamingSettingsOptions): HTMLElement {
  // Track the live value in a mutable object so one control's change doesn't clobber
  // another's (e.g. ticking "defer" must not wipe the username typed moments earlier).
  const v = { ...o.value };
  const emit = (patch: Partial<StreamingValue>): void => {
    Object.assign(v, patch);
    o.onChange({ ...v });
  };
  const root = el("div", "streaming-settings");

  root.append(
    toggleRow(
      "sunshine",
      "Sunshine (host)",
      "Stream games FROM this device to a Moonlight client on another screen.",
      v.sunshineEnabled,
      (on) => emit({ sunshineEnabled: on }),
    ),
  );

  if (v.sunshineEnabled) {
    const creds = el("div", "cz-span deck-field");
    creds.append(
      el("div", "cz-desc", "Optional Sunshine login — pre-configured so there's nothing to type."),
    );
    const user = el("input", "uw-select") as HTMLInputElement;
    user.type = "text";
    user.dataset.field = "sunshine-user";
    user.placeholder = "Sunshine username";
    user.value = v.sunshineUser ?? "";
    user.addEventListener("input", () => emit({ sunshineUser: user.value.trim() || undefined }));
    creds.append(user);
    creds.append(
      PasswordField({
        value: v.sunshinePass ?? "",
        placeholder: "Sunshine password",
        deferred: Boolean(v.sunshinePromptPass),
        deferLabel: "Set the Sunshine password on the device during setup instead",
        onChange: (val) => emit({ sunshinePass: val || undefined }),
        onDeferChange: (deferred) =>
          emit({
            sunshinePromptPass: deferred,
            sunshinePass: deferred ? undefined : v.sunshinePass,
          }),
      }),
    );
    root.append(creds);
  }

  root.append(
    toggleRow(
      "moonlight",
      "Moonlight (client)",
      "Play games streamed FROM another PC (running Sunshine / GeForce Experience).",
      v.moonlight,
      (on) => emit({ moonlight: on }),
    ),
  );

  return root;
}
