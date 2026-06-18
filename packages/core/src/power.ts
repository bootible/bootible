export interface PowerOptions {
  sleepMode?: string;
  hibernateAfterMinutes?: number;
  powerButtonAction?: string;
  disableCpuBoostOnBattery?: boolean;
}

const BUTTON_INDEX: Record<string, string> = {
  sleep: "1",
  hibernate: "2",
  shutdown: "3",
};

/**
 * Build the list of `powercfg` argument arrays for the requested power config.
 * Pure (no side effects); ported from v1 config/rog-ally/lib/power-helpers.ps1.
 * PBUTTONACTION indices: 1=sleep, 2=hibernate, 3=shut down.
 */
export function getPowerConfigCommands(opts: PowerOptions): string[][] {
  const commands: string[][] = [];
  let needsActivate = false;

  if (opts.sleepMode === "hibernate") {
    commands.push(["/hibernate", "on"]);
    commands.push(["/change", "standby-timeout-ac", "0"]);
    commands.push(["/change", "standby-timeout-dc", "0"]);
    if (opts.hibernateAfterMinutes && opts.hibernateAfterMinutes > 0) {
      const n = String(opts.hibernateAfterMinutes);
      commands.push(["/change", "hibernate-timeout-ac", n]);
      commands.push(["/change", "hibernate-timeout-dc", n]);
    }
  }

  const buttonIndex = opts.powerButtonAction ? BUTTON_INDEX[opts.powerButtonAction] : undefined;
  if (buttonIndex) {
    commands.push([
      "/setacvalueindex",
      "SCHEME_CURRENT",
      "SUB_BUTTONS",
      "PBUTTONACTION",
      buttonIndex,
    ]);
    commands.push([
      "/setdcvalueindex",
      "SCHEME_CURRENT",
      "SUB_BUTTONS",
      "PBUTTONACTION",
      buttonIndex,
    ]);
    needsActivate = true;
  }

  if (opts.disableCpuBoostOnBattery) {
    commands.push(["/setdcvalueindex", "SCHEME_CURRENT", "SUB_PROCESSOR", "PERFBOOSTMODE", "0"]);
    needsActivate = true;
  }

  if (needsActivate) {
    commands.push(["/setactive", "SCHEME_CURRENT"]);
  }

  return commands;
}
