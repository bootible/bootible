/**
 * Which saved profiles to show for the current device. When no device is selected
 * (unknown context — e.g. reached the screen via a reload or the home-detected
 * path), show EVERYTHING: hiding a profile because we don't know the device is the
 * worse failure. Otherwise show untagged profiles plus those tagged to this device.
 *
 * Family-level visibility (a windows profile on any windows handheld) is core's
 * visibleProfiles — eventually this filtering moves main-side so it can use it
 * without the renderer value-importing core. Kept here so it's pure + tested.
 */
export function profilesForDevice<T extends { deviceId?: string }>(
  profiles: readonly T[],
  deviceId: string,
): T[] {
  return profiles.filter((p) => !deviceId || !p.deviceId || p.deviceId === deviceId);
}
