import type { BootibleConfig } from "./config";
import type { StepListener } from "./modules";
import type { Executor } from "./orchestrator";
import type { DeviceEntry } from "./registry";
import { getCheckpointCommand, getEnableRestoreCommands } from "./restore-points";
import type { Exec } from "./secrets";

export const FRESH_RESTORE_POINT = "Fresh Windows (pre-bootible)";
export const POST_CONFIG_RESTORE_POINT = "bootible configured";

export interface OnboardOptions {
  device: DeviceEntry;
  config: BootibleConfig;
  executor: Executor;
  exec: Exec;
  onStep?: StepListener;
}

export interface OnboardReceipt {
  restorePoints: string[];
  applied: string[];
}

/**
 * The on-device first-run flow the autounattend triggers at first logon:
 * enable System Restore, snapshot fresh Windows, apply the device's module
 * catalog, then snapshot the configured system. Restore commands run through
 * the injected `exec`, so the whole flow is testable without Windows; the real
 * proof is a first boot on the Ally.
 */
export function onboard(opts: OnboardOptions): OnboardReceipt {
  const restorePoints: string[] = [];

  for (const cmd of getEnableRestoreCommands()) {
    opts.exec(cmd);
  }

  opts.exec(getCheckpointCommand(FRESH_RESTORE_POINT));
  restorePoints.push(FRESH_RESTORE_POINT);

  const { actions } = opts.executor.apply(
    { device: opts.device, config: opts.config },
    opts.onStep,
  );

  opts.exec(getCheckpointCommand(POST_CONFIG_RESTORE_POINT));
  restorePoints.push(POST_CONFIG_RESTORE_POINT);

  return { restorePoints, applied: actions };
}
