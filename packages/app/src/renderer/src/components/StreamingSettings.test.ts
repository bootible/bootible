// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { StreamingSettings } from "./StreamingSettings";

const get = <T extends Element>(r: Element, s: string): T => {
  const el = r.querySelector<T>(s);
  if (!el) throw new Error(`element not found: ${s}`);
  return el;
};
const fire = (el: Element, t: string) => el.dispatchEvent(new Event(t, { bubbles: true }));
const base = { sunshineEnabled: false, moonlight: false };

describe("StreamingSettings", () => {
  it("shows Sunshine credentials only when Sunshine is enabled", () => {
    expect(
      StreamingSettings({ value: base, onChange: vi.fn() }).querySelector(
        "[data-field=sunshine-user]",
      ),
    ).toBeNull();
    expect(
      StreamingSettings({
        value: { ...base, sunshineEnabled: true },
        onChange: vi.fn(),
      }).querySelector("[data-field=sunshine-user]"),
    ).not.toBeNull();
  });

  it("toggling Sunshine + Moonlight emits the change", () => {
    const onChange = vi.fn();
    const root = StreamingSettings({ value: base, onChange });
    const sun = get<HTMLInputElement>(root, "[data-toggle=sunshine]");
    sun.checked = true;
    fire(sun, "change");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sunshineEnabled: true }));
    const moon = get<HTMLInputElement>(root, "[data-toggle=moonlight]");
    moon.checked = true;
    fire(moon, "change");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ moonlight: true }));
  });

  it("hides the host toggles unless showHost is set", () => {
    const on = { ...base, sunshineEnabled: true, moonlight: true };
    const noHost = StreamingSettings({ value: on, onChange: vi.fn() });
    expect(noHost.querySelector("[data-toggle=sunshine-host]")).toBeNull();
    expect(noHost.querySelector("[data-toggle=moonlight-host]")).toBeNull();
    const withHost = StreamingSettings({ value: on, showHost: true, onChange: vi.fn() });
    expect(withHost.querySelector("[data-toggle=sunshine-host]")).not.toBeNull();
    expect(withHost.querySelector("[data-toggle=moonlight-host]")).not.toBeNull();
  });

  it("only shows a service's host toggle when that service is enabled", () => {
    const root = StreamingSettings({
      value: { ...base, sunshineEnabled: true, moonlight: false },
      showHost: true,
      onChange: vi.fn(),
    });
    expect(root.querySelector("[data-toggle=sunshine-host]")).not.toBeNull();
    expect(root.querySelector("[data-toggle=moonlight-host]")).toBeNull();
  });

  it("toggling a host option emits the change", () => {
    const onChange = vi.fn();
    const root = StreamingSettings({
      value: { ...base, sunshineEnabled: true },
      showHost: true,
      onChange,
    });
    const host = get<HTMLInputElement>(root, "[data-toggle=sunshine-host]");
    host.checked = true;
    fire(host, "change");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sunshineHost: true }));
  });

  it("deferring the password clears it and sets the prompt flag", () => {
    const onChange = vi.fn();
    const root = StreamingSettings({
      value: { ...base, sunshineEnabled: true, sunshinePass: "secret" },
      onChange,
    });
    const defer = get<HTMLInputElement>(root, "[data-field=defer]");
    defer.checked = true;
    fire(defer, "change");
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ sunshinePromptPass: true, sunshinePass: undefined }),
    );
  });
});
