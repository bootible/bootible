/** Screens that only make sense for a chosen device — they read selectedDeviceId
 *  (device-tagged profiles, the base/customise plan, the Deck config). */
const DEVICE_VIEWS = new Set(["home", "base", "customise", "deck", "decksetup"]);

/**
 * True when a device-dependent screen was reached without a selected device — i.e.
 * via a deep link or a reload, which resets the renderer's selectedDeviceId. The
 * desktop USB-builder has no auto-detected handheld to fall back on, so the only
 * recovery is sending the user back to pick a device. Without this, customise runs
 * device-less: profiles get hidden and new saves are written untagged.
 */
export function needsDevicePick(view: string, selectedDeviceId: string): boolean {
  return DEVICE_VIEWS.has(view) && !selectedDeviceId;
}
