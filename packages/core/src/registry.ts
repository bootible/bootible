import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseValidatedYaml } from "./validate-schema";

export type ProvisioningModel = "on-device" | "host-media-prep" | "guided" | "android-host";

export interface Capabilities {
  great?: string[];
  varies?: string[];
  none?: string[];
}

/** Hardware whitelist for auto-detecting a device on the running machine. */
export interface DeviceDetect {
  manufacturer?: string;
  models?: string[];
}

export interface DeviceEntry {
  id: string;
  name: string;
  provisioning_models: ProvisioningModel[];
  /** Registry OS id ("steamos", "windows", …); drives platform + carrier routing. */
  os?: string;
  capabilities?: Capabilities;
  detect?: DeviceDetect;
  [key: string]: unknown;
}

/**
 * Parse a device registry entry from YAML and validate it against the device
 * JSON Schema. Throws with the validation errors if the entry is invalid.
 */
export function parseDeviceEntry(yamlText: string, schema: object): DeviceEntry {
  return parseValidatedYaml<DeviceEntry>(yamlText, schema, "device entry");
}

/**
 * Load every `*.yml` device entry in a registry directory, validating each
 * against the device schema. Throws (with the file name) on the first invalid
 * entry.
 */
export function loadRegistry(dir: string, schema: object): DeviceEntry[] {
  const entries: DeviceEntry[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".yml") && !file.endsWith(".yaml")) continue;
    const text = readFileSync(join(dir, file), "utf8");
    try {
      entries.push(parseDeviceEntry(text, schema));
    } catch (e) {
      throw new Error(`${file}: ${(e as Error).message}`);
    }
  }
  return entries;
}
