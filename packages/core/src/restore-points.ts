// Windows System Restore command builders. The executor's runner actually
// invokes these on the device. System Restore captures registry/services/
// drivers — it does NOT reliably undo winget app installs, so the durable
// "reuse" path is: roll back to the fresh point, then re-apply the saved config.

/**
 * Enable System Restore on a drive and uncap the checkpoint frequency. Windows
 * throttles to one restore point per 1440 minutes by default; without clearing
 * `SystemRestorePointCreationFrequency` the post-config checkpoint (created
 * minutes after the fresh one) is silently skipped.
 */
export function getEnableRestoreCommands(drive = "C:\\"): string[][] {
  return [
    ["powershell", "-Command", `Enable-ComputerRestore -Drive "${drive}"`],
    [
      "reg",
      "add",
      "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\SystemRestore",
      "/v",
      "SystemRestorePointCreationFrequency",
      "/t",
      "REG_DWORD",
      "/d",
      "0",
      "/f",
    ],
  ];
}

/** Build a `Checkpoint-Computer` command for a named restore point. */
export function getCheckpointCommand(
  description: string,
  type: "MODIFY_SETTINGS" | "APPLICATION_INSTALL" = "MODIFY_SETTINGS",
): string[] {
  return [
    "powershell",
    "-Command",
    `Checkpoint-Computer -Description "${description}" -RestorePointType "${type}"`,
  ];
}
