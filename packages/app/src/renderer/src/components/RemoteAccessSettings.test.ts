// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { RemoteAccessSettings } from "./RemoteAccessSettings";

const get = <T extends Element>(r: Element, s: string): T => {
  const el = r.querySelector<T>(s);
  if (!el) throw new Error(`element not found: ${s}`);
  return el;
};
const fire = (el: Element, t: string) => el.dispatchEvent(new Event(t, { bubbles: true }));

const opts = [
  { id: "vnc", label: "VNC", desc: "Remote desktop.", enabled: false },
  { id: "tailscale", label: "Tailscale", desc: "Mesh VPN.", enabled: true },
];

describe("RemoteAccessSettings", () => {
  it("renders a toggle per option reflecting its state", () => {
    const root = RemoteAccessSettings({ options: opts, onToggle: vi.fn() });
    expect(get<HTMLInputElement>(root, "[data-toggle=vnc]").checked).toBe(false);
    expect(get<HTMLInputElement>(root, "[data-toggle=tailscale]").checked).toBe(true);
  });

  it("emits (id, enabled) on toggle", () => {
    const onToggle = vi.fn();
    const root = RemoteAccessSettings({ options: opts, onToggle });
    const cb = get<HTMLInputElement>(root, "[data-toggle=vnc]");
    cb.checked = true;
    fire(cb, "change");
    expect(onToggle).toHaveBeenCalledWith("vnc", true);
  });

  it("disables an option and shows its note (e.g. RDP needs Windows Pro)", () => {
    const root = RemoteAccessSettings({
      options: [
        {
          id: "rdp",
          label: "RDP",
          desc: "Remote Desktop.",
          enabled: false,
          disabled: true,
          note: "Windows Pro only",
        },
      ],
      onToggle: vi.fn(),
    });
    expect(get<HTMLInputElement>(root, "[data-toggle=rdp]").disabled).toBe(true);
    expect(root.textContent).toContain("Windows Pro only");
  });
});
