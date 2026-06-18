export type {
  Artifact,
  ArtifactSchemas,
  BootibleConfig,
  SyncTargetSpec,
  TargetsManifest,
} from "./config";
export { deepMerge, loadArtifact } from "./config";
export type { Capabilities, DeviceEntry, ProvisioningModel } from "./registry";
export { loadRegistry, parseDeviceEntry } from "./registry";
export { findSchemaUrl } from "./schema-header";
export type { SchemaValidationResult } from "./validate-schema";
export { parseValidatedYaml, validateYamlAgainstSchema } from "./validate-schema";
