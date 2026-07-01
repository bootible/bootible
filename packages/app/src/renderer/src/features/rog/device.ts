import type { BaseOption, DeviceOption, PlatformOption } from "@bootible/core";
import { StatusMessage } from "../../components/StatusMessage";
import { el, fill } from "../../lib/dom";
import { APP_LOGOS, DEVICE_BRAND, DEVICE_LOGOS, logoEl, OS_LOGOS } from "../../lib/logos";
import { session } from "../../lib/session";

// ── device picker (page 1 platform → page 2 device → summary) ───────────────
// A platform/device card, styled like the persona method-cards. Ready cards are
// clickable (data-pick); coming-soon cards are dimmed and inert.
function pickCard(
  kind: "platform" | "device",
  id: string,
  title: string,
  desc: string,
  status: string,
): HTMLElement {
  const ready = status === "ready";
  const card = el("button", `method-card${ready ? "" : " is-soon"}`) as HTMLButtonElement;
  card.type = "button";
  if (ready) {
    card.dataset.pick = kind;
    card.dataset.id = id;
  } else {
    card.disabled = true;
  }
  // Brand/OS logo (masked) when we have one, else a placeholder glyph.
  const logoUrl = kind === "platform" ? OS_LOGOS[id] : DEVICE_LOGOS[DEVICE_BRAND[id] ?? id];
  const icon = logoUrl
    ? logoEl(logoUrl, "method-icon method-icon-img")
    : el("span", "method-icon", kind === "platform" ? "❖" : "◈");
  icon.setAttribute("aria-hidden", "true");
  const main = el("span", "method-main");
  main.append(el("span", "method-name", title));
  if (desc) main.append(el("span", "method-desc", desc));
  const meta = el("span", "method-meta");
  meta.append(el("span", "group-tag", ready ? "ready" : "coming soon"));
  if (ready) meta.append(el("span", "arrow", "→"));
  card.append(icon, main, meta);
  return card;
}

/** Page 1 — render the platform families. */
export async function hydratePlatforms(): Promise<void> {
  const api = window.bootible;
  const list = document.querySelector<HTMLElement>(".platform-list");
  if (!api?.getPlatforms || !list) return;
  list.replaceChildren(StatusMessage({ kind: "loading", message: "Loading platforms…" }));
  let platforms: PlatformOption[] = [];
  try {
    platforms = await api.getPlatforms();
  } catch {
    list.replaceChildren(
      StatusMessage({
        kind: "error",
        message: "Couldn't load the device list.",
        onRetry: () => void hydratePlatforms(),
      }),
    );
    return;
  }
  list.replaceChildren(
    ...platforms.map((p) => pickCard("platform", p.id, p.label, p.blurb, p.status)),
  );
}

/** Page 2 — render the devices for the chosen platform. */
export async function hydrateDevices(platformId: string): Promise<void> {
  const api = window.bootible;
  const list = document.querySelector<HTMLElement>(".device-list");
  if (!api?.getDevices || !list) return;
  list.replaceChildren(StatusMessage({ kind: "loading", message: "Loading devices…" }));
  let devices: DeviceOption[] = [];
  try {
    devices = await api.getDevices(platformId);
  } catch {
    list.replaceChildren(
      StatusMessage({
        kind: "error",
        message: "Couldn't load the devices for this platform.",
        onRetry: () => void hydrateDevices(platformId),
      }),
    );
    return;
  }
  list.replaceChildren(...devices.map((d) => pickCard("device", d.id, d.name, "", d.status)));
}

/** Record the picked device and fill the summary screen from its summary. */
export async function selectDeviceAndGo(id: string): Promise<void> {
  const api = window.bootible;
  if (!api?.selectDevice) return;
  const device = await api.selectDevice(id);
  if (!device) return;
  session.deviceId = id;
  session.deviceName = device.name;
  fill("name", device.name);
  fill("system", device.system);
  fill("device-sub", `${device.system} handheld — selected.`);
  fill("base-eyebrow", `Your ${device.name}`);
  // The Deck (SteamOS) uses the host-carrier flow, not the Windows base/customise
  // wizard — point the home "Set up" button at the Deck config screen.
  const isDeck = usesDeckCarrierOs(device.os);
  const setupBtn = document.querySelector<HTMLElement>(
    '.view[data-view="home"] .actions [data-go]',
  );
  if (setupBtn) setupBtn.dataset.go = isDeck ? "deck" : "base";
  const flowLine = document.querySelector<HTMLElement>(
    '.view[data-view="home"] .readout .rline:nth-child(3) .rval',
  );
  if (flowLine) {
    flowLine.textContent = isDeck
      ? "configure (you install SteamOS)"
      : "wipe → install → configure";
  }
  location.hash = "home";
}

/** A base card — the experience picker (charcoal/amber method-card style). */
// Base → representative logo: Raw Windows, Steam Big Picture, Full ROG.
const BASE_LOGO: Record<string, string | undefined> = {
  raw: OS_LOGOS.windows,
  "steam-bp": APP_LOGOS.steam,
  "full-rog": DEVICE_LOGOS.rog,
};
export function baseCard(base: BaseOption): HTMLElement {
  const card = el("button", "method-card") as HTMLButtonElement;
  card.type = "button";
  card.dataset.pick = "base";
  card.dataset.id = base.id;
  const url = BASE_LOGO[base.id];
  const icon = url
    ? logoEl(url, "method-icon method-icon-img")
    : el("span", "method-icon", base.recommended ? "★" : "◆");
  icon.setAttribute("aria-hidden", "true");
  const main = el("span", "method-main");
  main.append(el("span", "method-name", base.label), el("span", "method-desc", base.description));
  const meta = el("span", "method-meta");
  if (base.tag) meta.append(el("span", "group-tag", base.tag));
  meta.append(el("span", "arrow", "→"));
  card.append(icon, main, meta);
  return card;
}

/** Render the base selector (the page after the device summary). */

const CARRIER_OSES = new Set(["steamos"]);
function usesDeckCarrierOs(os: string): boolean {
  return CARRIER_OSES.has(os);
}
