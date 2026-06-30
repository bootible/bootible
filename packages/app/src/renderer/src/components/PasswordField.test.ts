// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { PasswordField } from "./PasswordField";

const get = <T extends Element>(r: Element, s: string): T => {
  const el = r.querySelector<T>(s);
  if (!el) throw new Error(`element not found: ${s}`);
  return el;
};
const fire = (el: Element, t: string) => el.dispatchEvent(new Event(t, { bubbles: true }));

describe("PasswordField", () => {
  it("warns about plaintext-on-USB only when a password is typed and not deferred", () => {
    expect(
      PasswordField({
        value: "",
        deferred: false,
        onChange: vi.fn(),
        onDeferChange: vi.fn(),
      }).querySelector("[data-field=warning]"),
    ).toBeNull();
    expect(
      PasswordField({
        value: "hunter2",
        deferred: false,
        onChange: vi.fn(),
        onDeferChange: vi.fn(),
      }).querySelector("[data-field=warning]"),
    ).not.toBeNull();
  });

  it("hides the input + warning when deferred to the device", () => {
    const f = PasswordField({
      value: "hunter2",
      deferred: true,
      onChange: vi.fn(),
      onDeferChange: vi.fn(),
    });
    expect(get<HTMLInputElement>(f, "[data-field=password]").hidden).toBe(true);
    expect(f.querySelector("[data-field=warning]")).toBeNull();
  });

  it("emits the typed value", () => {
    const onChange = vi.fn();
    const f = PasswordField({ value: "", deferred: false, onChange, onDeferChange: vi.fn() });
    const input = get<HTMLInputElement>(f, "[data-field=password]");
    input.value = "secret";
    fire(input, "input");
    expect(onChange).toHaveBeenCalledWith("secret");
  });

  it("toggling defer emits onDeferChange", () => {
    const onDeferChange = vi.fn();
    const f = PasswordField({ value: "", deferred: false, onChange: vi.fn(), onDeferChange });
    const cb = get<HTMLInputElement>(f, "[data-field=defer]");
    cb.checked = true;
    fire(cb, "change");
    expect(onDeferChange).toHaveBeenCalledWith(true);
  });
});
