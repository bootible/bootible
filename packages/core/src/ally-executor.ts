import type { ApplyContext, Executor, ExecutorReceipt } from "./orchestrator";
import { getPowerConfigCommands } from "./power";
import type { Exec } from "./secrets";

/**
 * The ROG Ally / Windows executor — implements the Executor seam by running
 * native commands through an injected runner (testable without Windows; real
 * proof comes on the device). Phase-1 slice: the power/hibernate module.
 */
export function allyExecutor(exec: Exec): Executor {
  return {
    apply(ctx: ApplyContext): ExecutorReceipt {
      const settings = (ctx.config.settings ?? {}) as Record<string, unknown>;
      const actions: string[] = [];

      const powerCommands = getPowerConfigCommands({
        sleepMode: settings.sleep_mode as string | undefined,
        hibernateAfterMinutes: settings.hibernate_after_minutes as number | undefined,
        powerButtonAction: settings.power_button_action as string | undefined,
        disableCpuBoostOnBattery: settings.disable_cpu_boost_on_battery as boolean | undefined,
      });
      for (const args of powerCommands) {
        exec(["powercfg", ...args]);
        actions.push(`powercfg ${args.join(" ")}`);
      }

      return { actions };
    },
  };
}
