import { allyExecutor } from "./ally-executor";
import { allyBundles, allyCatalog } from "./ally-modules";
import type { Bundle } from "./bundles";
import type { BootibleModule } from "./modules";
import type { Executor } from "./orchestrator";
import type { Exec } from "./secrets";

/**
 * Everything that makes a device fully supported by the generic provisioning
 * flow: its module catalog, its recommended bundles, and the executor that
 * runs them. Adding a device is a matter of adding a profile here — the
 * persona / bundles / tinker UI is device-agnostic and renders from this.
 */
export interface DeviceProfile {
  catalog: BootibleModule[];
  bundles: Bundle[];
  executor: (exec: Exec) => Executor;
}

const PROFILES: Record<string, DeviceProfile> = {
  "rog-ally": { catalog: allyCatalog, bundles: allyBundles, executor: allyExecutor },
};

/** The provisioning profile for a device id, or null if none is registered. */
export function deviceProfile(id: string): DeviceProfile | null {
  return PROFILES[id] ?? null;
}
