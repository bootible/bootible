import type { ApplyContext } from "./orchestrator";
import type { Exec } from "./secrets";

/** The four setup groups, in the order they run. */
export type ModuleGroup = "system" | "performance" | "apps" | "library";

/** Outcome of running a single module. */
export interface ModuleResult {
  status: "applied" | "skipped";
  /** Human note, e.g. why it was skipped. */
  detail?: string;
  /** Commands actually run (for the receipt). */
  actions?: string[];
}

/** Whether a module's effect is already present on the running device. */
export type ModuleState = "applied" | "pending" | "unknown";

/** A single unit of device setup, grouped for presentation. */
export interface BootibleModule {
  id: string;
  name: string;
  group: ModuleGroup;
  /** Plain-language "what this does", shown to the user. */
  description: string;
  /** One-line transparency note of what it actually touches (e.g. "6 registry
   *  values", "Valve.Steam (winget)"). Shown in the advanced view. */
  changes?: string;
  /** True for modules declared but not yet implemented — shown as "coming
   *  soon", never selectable. */
  planned?: boolean;
  apply(ctx: ApplyContext, exec: Exec): ModuleResult;
  /**
   * Read-only probe of current state — runs no-change commands (reg query,
   * sc qc, winget list, powercfg) so the UI can show "already set" vs "will
   * change" before applying. Omitted on planned modules.
   */
  check?(ctx: ApplyContext, exec: Exec): ModuleState;
}

export interface ModuleStateReport {
  id: string;
  name: string;
  group: ModuleGroup;
  state: ModuleState;
}

/** Probe each module's current state (read-only). Errors map to "unknown". */
export function checkModules(
  modules: BootibleModule[],
  ctx: ApplyContext,
  exec: Exec,
): ModuleStateReport[] {
  return modules.map((module) => {
    let state: ModuleState = "unknown";
    if (module.check) {
      try {
        state = module.check(ctx, exec);
      } catch {
        state = "unknown";
      }
    }
    return { id: module.id, name: module.name, group: module.group, state };
  });
}

export type StepStatus = "running" | "applied" | "skipped" | "failed";

/** Emitted as the executor works through the catalog, one per status change. */
export interface StepEvent {
  moduleId: string;
  name: string;
  group: ModuleGroup;
  status: StepStatus;
  detail?: string;
}

export type StepListener = (event: StepEvent) => void;

/** A module projected for the setup screen. */
export interface ModuleSummary {
  id: string;
  name: string;
  description: string;
  changes?: string;
  planned: boolean;
}

/** A group projected for the setup screen. */
export interface GroupSummary {
  group: ModuleGroup;
  label: string;
  description: string;
  moduleCount: number;
  modules: ModuleSummary[];
}

export const GROUP_META: Record<ModuleGroup, { label: string; description: string }> = {
  system: {
    label: "System essentials",
    description: "Power, controller, display & sensible Windows defaults.",
  },
  performance: {
    label: "Performance",
    description: "Drivers, background trim & storage tuned for games.",
  },
  apps: {
    label: "Apps & emulation",
    description: "Handheld overlay, Steam & EmuDeck — kept current, never frozen.",
  },
  library: {
    label: "Library & saves",
    description: "Connect a sync target; links to legal, first-party game sources.",
  },
};

const GROUP_ORDER: ModuleGroup[] = ["system", "performance", "apps", "library"];

/**
 * Filter a catalog to the selected module ids. `undefined` selects everything
 * (the default); an explicit list runs only those modules — this is what makes
 * the setup-screen per-module toggles gate what provisioning does. An empty
 * list selects nothing.
 */
export function selectModules(modules: BootibleModule[], ids?: string[]): BootibleModule[] {
  if (!ids) return modules;
  const selected = new Set(ids);
  return modules.filter((module) => selected.has(module.id));
}

/** Group a flat module list into ordered group summaries for the setup screen. */
export function groupCatalog(modules: BootibleModule[]): GroupSummary[] {
  return GROUP_ORDER.map((group) => {
    const inGroup = modules.filter((m) => m.group === group);
    return {
      group,
      label: GROUP_META[group].label,
      description: GROUP_META[group].description,
      moduleCount: inGroup.length,
      modules: inGroup.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        changes: m.changes,
        planned: m.planned ?? false,
      })),
    };
  }).filter((g) => g.moduleCount > 0);
}
