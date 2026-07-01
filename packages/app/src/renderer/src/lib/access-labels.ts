/** Section labels shared by the ROG account screen (features/rog/account.ts) and
 *  the Deck device-setup screen (features/deck/setup.ts). Both "Account & access"
 *  pages build the same Section cards from these, so the two can't drift apart. */
export const ACCESS_LABELS = {
  deviceName: "Device name",
  network: "Network",
  streaming: "Game streaming",
  remote: "Remote access",
  ssh: "SSH access",
} as const;
