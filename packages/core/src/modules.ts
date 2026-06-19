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

/** A single unit of device setup, grouped for presentation. */
export interface BootibleModule {
  id: string;
  name: string;
  group: ModuleGroup;
  summary: string;
  apply(ctx: ApplyContext, exec: Exec): ModuleResult;
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

/** A group projected for the setup screen. */
export interface GroupSummary {
  group: ModuleGroup;
  label: string;
  description: string;
  moduleCount: number;
  modules: { id: string; name: string }[];
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

/** Group a flat module list into ordered group summaries for the setup screen. */
export function groupCatalog(modules: BootibleModule[]): GroupSummary[] {
  return GROUP_ORDER.map((group) => {
    const inGroup = modules.filter((m) => m.group === group);
    return {
      group,
      label: GROUP_META[group].label,
      description: GROUP_META[group].description,
      moduleCount: inGroup.length,
      modules: inGroup.map((m) => ({ id: m.id, name: m.name })),
    };
  }).filter((g) => g.moduleCount > 0);
}
