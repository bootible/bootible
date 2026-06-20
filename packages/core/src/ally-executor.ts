import { allyCatalog } from "./ally-modules";
import { type StepListener, selectModules } from "./modules";
import type { ApplyContext, Executor, ExecutorReceipt } from "./orchestrator";
import type { Exec } from "./secrets";

/**
 * The ROG Ally / Windows executor — runs the Ally module catalog through an
 * injected command runner (testable without Windows; real proof comes on the
 * device). Each module emits a `running` event then a terminal status to the
 * optional listener, so the desktop app can stream a live setup log.
 */
export function allyExecutor(exec: Exec): Executor {
  return {
    apply(ctx: ApplyContext, onStep?: StepListener): ExecutorReceipt {
      const actions: string[] = [];
      const modules = selectModules(allyCatalog, ctx.config.groups);

      for (const mod of modules) {
        const base = { moduleId: mod.id, name: mod.name, group: mod.group };
        onStep?.({ ...base, status: "running" });
        try {
          const result = mod.apply(ctx, exec);
          if (result.actions) actions.push(...result.actions);
          onStep?.({ ...base, status: result.status, detail: result.detail });
        } catch (error) {
          onStep?.({ ...base, status: "failed", detail: (error as Error).message });
        }
      }

      return { actions };
    },
  };
}
