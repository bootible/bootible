// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { NetworkSettings } from "./NetworkSettings";

const q = <T extends Element>(root: Element, sel: string) => root.querySelector<T>(sel);
function fire(el: Element, type: string): void {
  el.dispatchEvent(new Event(type, { bubbles: true }));
}

describe("NetworkSettings", () => {
  it("starts on DHCP (no static fields shown) when value is undefined", () => {
    const root = NetworkSettings({ value: undefined, interfaces: ["wifi", "ethernet"], onChange: vi.fn() });
    expect(q<HTMLInputElement>(root, "[data-toggle=static]")?.checked).toBe(false);
    expect(q(root, "[data-field=ip]")).toBeNull();
  });

  it("enabling static emits a config with defaults (first interface, prefix 24)", () => {
    const onChange = vi.fn();
    const root = NetworkSettings({ value: undefined, interfaces: ["wifi", "ethernet"], onChange });
    const toggle = q<HTMLInputElement>(root, "[data-toggle=static]")!;
    toggle.checked = true;
    fire(toggle, "change");
    expect(onChange).toHaveBeenCalledWith({ iface: "wifi", ip: "", prefix: 24 });
  });

  it("prefills prefix/gateway/dns from the infer capability on enable (ROG)", () => {
    const onChange = vi.fn();
    const root = NetworkSettings({
      value: undefined,
      interfaces: ["wifi"],
      infer: { prefix: 23, gateway: "10.0.0.1", dns: "10.0.0.1" },
      onChange,
    });
    const toggle = q<HTMLInputElement>(root, "[data-toggle=static]")!;
    toggle.checked = true;
    fire(toggle, "change");
    expect(onChange).toHaveBeenCalledWith({
      iface: "wifi",
      ip: "",
      prefix: 23,
      gateway: "10.0.0.1",
      dns: "10.0.0.1",
    });
  });

  it("editing the address emits the updated ip", () => {
    const onChange = vi.fn();
    const root = NetworkSettings({
      value: { iface: "wifi", ip: "", prefix: 24 },
      interfaces: ["wifi"],
      onChange,
    });
    const ip = q<HTMLInputElement>(root, "[data-field=ip]")!;
    ip.value = "192.168.1.50";
    fire(ip, "input");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ ip: "192.168.1.50" }));
  });

  it("turning static off returns to DHCP (undefined)", () => {
    const onChange = vi.fn();
    const root = NetworkSettings({
      value: { iface: "wifi", ip: "10.0.0.5", prefix: 24 },
      interfaces: ["wifi"],
      onChange,
    });
    const toggle = q<HTMLInputElement>(root, "[data-toggle=static]")!;
    expect(toggle.checked).toBe(true);
    toggle.checked = false;
    fire(toggle, "change");
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("only renders the interfaces the device offers", () => {
    const root = NetworkSettings({
      value: { iface: "wifi", ip: "", prefix: 24 },
      interfaces: ["wifi"],
      onChange: vi.fn(),
    });
    const opts = [...root.querySelectorAll("[data-field=iface] option")].map(
      (o) => (o as HTMLOptionElement).value,
    );
    expect(opts).toEqual(["wifi"]);
  });
});
