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
    // Plugged in (AC): never sleep OR hibernate, so downloads, installs and
    // Windows Update aren't interrupted while charging. The unattended-sleep
    // timeout (which fires during background activity with no user present) is
    // zeroed too — it's the usual cause of "it slept mid-download".
    commands.push(["/change", "standby-timeout-ac", "0"]);
    commands.push(["/change", "hibernate-timeout-ac", "0"]);
    commands.push(["/setacvalueindex", "SCHEME_CURRENT", "SUB_SLEEP", "UNATTENDSLEEP", "0"]);
    needsActivate = true;
    // On battery (DC): never sleep, but hibernate after the idle time so it
    // doesn't drain in your bag.
    commands.push(["/change", "standby-timeout-dc", "0"]);
    if (opts.hibernateAfterMinutes && opts.hibernateAfterMinutes > 0) {
      commands.push(["/change", "hibernate-timeout-dc", String(opts.hibernateAfterMinutes)]);
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
