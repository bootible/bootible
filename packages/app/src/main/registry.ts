import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BASES,
  type Base,
  type Bundle,
  baseById,
  baseModuleIds,
  type DeviceEntry,
  type DeviceProfile,
  type DeviceSummary,
  deviceProfile,
  deviceSummary,
  type GroupSummary,
  groupCatalog,
  loadRegistry,
  PLATFORMS,
  type PlanModule,
  type ProvisioningMethod,
  platformForOs,
  provisioningMethods,
  ROADMAP_DEVICES,
  selectDevice,
  UNIVERSAL_FLOOR,
  usesDeckCarrier,
} from "@bootible/core";
import { dataRoot } from "./paths";
import { getSystemInfo } from "./system";

/** Load + validate the device registry. */
function loadRegistryEntries(): DeviceEntry[] {
  const deviceSchema = JSON.parse(
    readFileSync(join(dataRoot, "schemas/device.schema.json"), "utf8"),
  );
  return loadRegistry(join(dataRoot, "registry/devices"), deviceSchema);
}

/** The device THIS machine is (hardware whitelist match), or null — used by
 *  detection, on-device state, and the hard-blocked Run-on-device apply. */
export function loadDeviceEntry(): DeviceEntry | null {
  return selectDevice(loadRegistryEntries(), getSystemInfo());
}

/** The device the user picked on the device-selector pages (page 1/2). Drives
 *  the catalog, bundles, methods and the build from here on. */
let selectedDeviceId: string | null = null;

/** The device we build media / configs FOR (host-side) — the user's pick, or the
 *  Ally as a fallback. Works from any PC, since you build a handheld's USB from
 *  your desktop. */
export function targetDevice(): DeviceEntry | null {
  const registry = loadRegistryEntries();
  if (selectedDeviceId) {
    const picked = registry.find((d) => d.id === selectedDeviceId);
    if (picked) return picked;
  }
  return registry.find((d) => d.id === "rog-ally") ?? registry[0] ?? null;
}

/** Platform families with ready/coming-soon status (page 1). A platform is
 *  ready if any of its registry devices has a buildable DeviceProfile. */
export function getPlatforms(): { id: string; label: string; blurb: string; status: string }[] {
  const registry = loadRegistryEntries();
  return PLATFORMS.map((p) => {
    const ready = registry.some((d) => platformForOs(d.os) === p.id && buildable(d));
    return { id: p.id, label: p.label, blurb: p.blurb, status: ready ? "ready" : "coming-soon" };
  });
}

/** Devices for a platform (page 2): registry devices (ready if they have a
 *  profile) followed by roadmap placeholders, ready first. */
export function getDevices(platformId: string): { id: string; name: string; status: string }[] {
  const registry = loadRegistryEntries();
  const real = registry
    .filter((d) => platformForOs(d.os) === platformId)
    .map((d) => ({
      id: d.id,
      name: d.name,
      status: buildable(d) ? "ready" : "coming-soon",
    }));
  const roadmap = ROADMAP_DEVICES.filter((r) => r.platform === platformId).map((r) => ({
    id: r.id,
    name: r.name,
    status: "coming-soon",
  }));
  return [...real, ...roadmap].sort(
    (a, b) => (a.status === "ready" ? 0 : 1) - (b.status === "ready" ? 0 : 1),
  );
}

/** Record the picked device (only if buildable) and return its summary for the
 *  summary screen, or null if it isn't a real, ready device. */
export function selectDeviceById(id: string): DeviceSummary | null {
  const entry = loadRegistryEntries().find((d) => d.id === id);
  if (!entry || !buildable(entry)) return null;
  selectedDeviceId = entry.id;
  return deviceSummary(entry);
}

/** The provisioning profile (catalog + bundles + executor) for a device. */
export function profileFor(device: DeviceEntry | null): DeviceProfile | null {
  return device ? deviceProfile(device.id) : null;
}

/** A device is buildable when it has a Windows-style DeviceProfile OR its OS
 *  uses the SteamOS/Linux host-carrier flow (which has no DeviceProfile). */
function buildable(device: DeviceEntry): boolean {
  return !!deviceProfile(device.id) || usesDeckCarrier(device.os);
}

/** Optional plain-toggle extras on the review/customise screen. (Apps and
 *  Emulators are their own picker rows, handled in the renderer; EmuDeck lives
 *  inside the Emulators picker.) */
const CUSTOMISE_EXTRAS: string[] = [];

/** The review/customise plan for a base: the always-on floor, what the base
 *  adds, and the optional extras — each with display info from the catalog. */
export function getBasePlan(baseId: string): {
  floor: PlanModule[];
  base: PlanModule[];
  extras: PlanModule[];
} {
  const cat = profileFor(targetDevice())?.catalog ?? [];
  const info = (id: string): PlanModule => {
    const m = cat.find((x) => x.id === id);
    return { id, name: m?.name ?? id, description: m?.description ?? "", changes: m?.changes };
  };
  const base = baseById(baseId);
  const baseIds = base ? baseModuleIds(base) : [...UNIVERSAL_FLOOR];
  return {
    floor: UNIVERSAL_FLOOR.filter((id) => baseIds.includes(id)).map(info),
    base: baseIds.filter((id) => !UNIVERSAL_FLOOR.includes(id)).map(info),
    extras: CUSTOMISE_EXTRAS.filter((id) => !baseIds.includes(id)).map(info),
  };
}

/** Project the detected device for the renderer, or null if none matches. */
export function getDevice(): DeviceSummary | null {
  try {
    const entry = loadDeviceEntry();
    return entry ? deviceSummary(entry) : null;
  } catch (error) {
    console.error("device:get failed", error);
    return null;
  }
}

/** The target device's module catalog, grouped for the setup screen. */
export function getCatalog(): GroupSummary[] {
  const profile = profileFor(targetDevice());
  return profile ? groupCatalog(profile.catalog) : [];
}

/** The target device's recommended bundles (the "set it up for me" path). */
export function getBundles(): Bundle[] {
  return profileFor(targetDevice())?.bundles ?? [];
}

/** The base catalog (page after device summary) — the experience the handheld
 *  boots into. Projects just what the renderer needs. */
export function getBases(): Array<
  Pick<Base, "id" | "label" | "description" | "tag" | "recommended">
> {
  return BASES.map((b) => ({
    id: b.id,
    label: b.label,
    description: b.description,
    tag: b.tag,
    recommended: b.recommended,
  }));
}

/** Provisioning methods for the target device — derived from its registry
 *  provisioning_models, so the method screen supports any device type. */
export function getMethods(): ProvisioningMethod[] {
  const device = targetDevice();
  return device ? provisioningMethods(device) : [];
}
