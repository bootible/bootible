/**
 * The tiny slice of renderer state that's shared ACROSS feature areas — the
 * currently-selected device's class (model id) and display name. Kept in one
 * mutable object so feature modules (ROG flow in main.ts, the Deck flow in
 * features/deck.ts) read and write the same source without a circular import.
 *
 * This is device CLASS context for the UI (see device-class-vs-instance) — not a
 * communicatable instance.
 */
export const session: {
  /** The selected device model id (e.g. "rog-ally", "steamdeck"); "" before pick. */
  deviceId: string;
  /** The device's display name, shown in profile labels and the receipt. */
  deviceName: string;
} = {
  deviceId: "",
  deviceName: "ROG Ally X",
};
