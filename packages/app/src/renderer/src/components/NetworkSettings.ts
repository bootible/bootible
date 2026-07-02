import type { StaticIp } from "@bootible/core";
import { el } from "../lib/dom";

export interface NetworkSettingsOptions {
  /** Current config; `undefined` = DHCP (the default). */
  value: StaticIp | undefined;
  /** Interfaces this device offers (e.g. Deck: wifi+ethernet; some devices: wifi only). */
  interfaces: ("wifi" | "ethernet")[];
  /**
   * Platform capability: inferred network params. ROG derives prefix/gateway/dns
   * from the host subnet ("minimize typing"), so when present they pre-fill on
   * enable. Devices that can't infer (Deck) omit it and the user fills the fields.
   * Same component either way — the difference is data, not a separate screen.
   */
  infer?: { prefix?: number; gateway?: string; dns?: string };
  onChange: (next: StaticIp | undefined) => void;
}

const IFACE_LABEL: Record<"wifi" | "ethernet", string> = { wifi: "Wi-Fi", ethernet: "Ethernet" };

/**
 * One network/static-IP editor shared by every device. Default DHCP; enabling
 * static reveals interface + address + prefix + gateway + DNS with identical
 * layout and validation everywhere. (Cohesion standard: "same task = same
 * experience"; capability differences are expressed via `interfaces`/`infer`.)
 */
export function NetworkSettings(opts: NetworkSettingsOptions): HTMLElement {
  const { value, interfaces, infer, onChange } = opts;
  const root = el("div", "network-settings");

  const toggleRow = el("label", "ns-toggle");
  const toggle = el("input") as HTMLInputElement;
  toggle.type = "checkbox";
  toggle.dataset.toggle = "static";
  toggle.checked = Boolean(value);
  toggleRow.append(toggle, el("span", "", "Static IP"));
  root.append(toggleRow);

  const fields = el("div", "ns-fields cz-span");
  root.append(fields);

  // Each field carries a PERSISTENT label (not just a placeholder) — a filled
  // field must still say what it is, or you get an unlabelled column of numbers.
  const labelledField = (
    field: string,
    label: string,
    placeholder: string,
    val: string,
    onInput: (v: string) => void,
    type = "text",
  ): HTMLElement => {
    const wrap = el("div", "ns-field");
    wrap.append(el("div", "cz-name", label));
    const input = el("input", "uw-select") as HTMLInputElement;
    input.type = type;
    input.dataset.field = field;
    input.placeholder = placeholder;
    input.value = val;
    input.addEventListener("input", () => onInput(input.value));
    wrap.append(input);
    return wrap;
  };

  const renderFields = (cfg: StaticIp): void => {
    const ifaceWrap = el("div", "ns-field");
    ifaceWrap.append(el("div", "cz-name", "Interface"));
    const ifaceSel = el("select", "uw-select") as HTMLSelectElement;
    ifaceSel.dataset.field = "iface";
    for (const i of interfaces) {
      const o = document.createElement("option");
      o.value = i;
      o.textContent = IFACE_LABEL[i];
      if (cfg.iface === i) o.selected = true;
      ifaceSel.append(o);
    }
    ifaceSel.addEventListener("change", () =>
      onChange({ ...cfg, iface: ifaceSel.value as "wifi" | "ethernet" }),
    );
    ifaceWrap.append(ifaceSel);

    fields.replaceChildren(
      ifaceWrap,
      labelledField("ip", "IP address", "e.g. 192.168.1.50", cfg.ip, (v) => {
        cfg = { ...cfg, ip: v.trim() };
        onChange(cfg);
      }),
      labelledField(
        "prefix",
        "Prefix (1–32)",
        "24 for a /24 network",
        String(cfg.prefix),
        (v) => {
          cfg = { ...cfg, prefix: Number(v) || 24 };
          onChange(cfg);
        },
        "number",
      ),
      labelledField("gateway", "Gateway (optional)", "e.g. 192.168.1.1", cfg.gateway ?? "", (v) => {
        cfg = { ...cfg, gateway: v.trim() || undefined };
        onChange(cfg);
      }),
      labelledField("dns", "DNS (optional)", "e.g. 1.1.1.1, 8.8.8.8", cfg.dns ?? "", (v) => {
        cfg = { ...cfg, dns: v.trim() || undefined };
        onChange(cfg);
      }),
    );
  };

  if (value) renderFields(value);

  toggle.addEventListener("change", () => {
    if (toggle.checked) {
      const cfg: StaticIp = {
        iface: interfaces[0] ?? "wifi",
        ip: "",
        prefix: infer?.prefix ?? 24,
        ...(infer?.gateway ? { gateway: infer.gateway } : {}),
        ...(infer?.dns ? { dns: infer.dns } : {}),
      };
      renderFields(cfg);
      onChange(cfg);
    } else {
      fields.replaceChildren();
      onChange(undefined);
    }
  });

  return root;
}
