/**
 * Pure selection helpers for the app/emulator pickers — extracted from the
 * renderer so they can be unit-tested without a DOM.
 */

/**
 * How many of the selected ids appear in the given (visible) app set.
 *
 * A picker's header count must describe only what that picker shows: emulators
 * and streaming clients live on their own screens, so a Deck "apps" count must
 * not include them just because they're in the same `flatpakApps` set.
 */
export function countSelectedInView(
  visible: readonly { id: string }[],
  selectedIds: readonly string[],
): number {
  const selected = new Set(selectedIds);
  let n = 0;
  for (const app of visible) if (selected.has(app.id)) n++;
  return n;
}
