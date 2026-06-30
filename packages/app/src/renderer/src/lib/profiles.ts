/**
 * Group saved profiles for the current device into two sections for the dropdown:
 * **model** (tagged to this exact device model) shown first, then **family**
 * (other devices of the same family, plus untagged profiles that apply anywhere).
 * Profiles from a different family are hidden. When no device is selected (unknown
 * context — e.g. a deep link), everything goes in the model group rather than
 * hiding anything.
 *
 * `familyOf` mirrors core's deviceFamilyOf — the renderer can't value-import core.
 * The eventual home for this grouping is main-side (see device-class-vs-instance).
 */
function familyOf(deviceId: string | undefined): string {
  const id = (deviceId ?? "").toLowerCase();
  if (!id) return "unknown";
  if (id.includes("deck")) return "steamos";
  if (id.includes("ally") || id.includes("rog")) return "windows";
  return "unknown";
}

export interface GroupedProfiles<T> {
  model: T[];
  family: T[];
}

export function groupProfilesForDevice<T extends { deviceId?: string }>(
  profiles: readonly T[],
  deviceId: string,
): GroupedProfiles<T> {
  if (!deviceId) return { model: [...profiles], family: [] };
  const fam = familyOf(deviceId);
  const model: T[] = [];
  const family: T[] = [];
  for (const p of profiles) {
    const pf = familyOf(p.deviceId);
    if (pf !== "unknown" && pf !== fam) continue; // a different family — not shown here
    if (p.deviceId === deviceId) model.push(p);
    else family.push(p); // same family, or untagged (applies anywhere)
  }
  return { model, family };
}
