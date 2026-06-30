import { el } from "../lib/dom";

export interface PasswordFieldOptions {
  value: string;
  placeholder?: string;
  /** When true, the password is set on the device during setup rather than saved
   *  here — the input is hidden and nothing is baked onto the USB. */
  deferred: boolean;
  /** Label for the "set it on the device" toggle. */
  deferLabel?: string;
  onChange(value: string): void;
  onDeferChange(deferred: boolean): void;
}

/**
 * A password input shared across devices. Anything typed here is written to the USB
 * in plaintext (the provisioning script needs it), so it shows a warning and offers
 * to set the secret on the device during setup instead — the device wires what
 * "during setup" means (the Deck's provision.sh prompts; the ROG sets it on first run).
 */
export function PasswordField(o: PasswordFieldOptions): HTMLElement {
  const root = el("div", "password-field");

  const input = el("input", "uw-select") as HTMLInputElement;
  input.type = "password";
  input.dataset.field = "password";
  input.placeholder = o.placeholder ?? "Password";
  input.value = o.value;
  input.hidden = o.deferred;
  input.addEventListener("input", () => o.onChange(input.value));
  root.append(input);

  if (!o.deferred && o.value) {
    const warn = el(
      "p",
      "password-warning",
      "⚠ Saved in plaintext on the USB — anyone with the stick can read it.",
    );
    warn.dataset.field = "warning";
    root.append(warn);
  }

  const deferRow = el("label", "password-defer");
  const cb = el("input", "app-check") as HTMLInputElement;
  cb.type = "checkbox";
  cb.dataset.field = "defer";
  cb.checked = o.deferred;
  cb.addEventListener("change", () => o.onDeferChange(cb.checked));
  deferRow.append(cb, el("span", "", o.deferLabel ?? "Set it on the device during setup instead"));
  root.append(deferRow);

  return root;
}
