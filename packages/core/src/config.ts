import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseValidatedYaml } from "./validate-schema";

type Plain = Record<string, unknown>;

function isPlainObject(v: unknown): v is Plain {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Recursively merge `override` onto `base`. Nested plain objects merge;
 * scalars and arrays from `override` win. Neither input is mutated.
 */
export function deepMerge<T extends object>(base: T, override: Partial<T>): T {
  const out: Plain = { ...(base as Plain) };
  for (const [key, value] of Object.entries(override as Plain)) {
    const existing = out[key];
    out[key] = isPlainObject(existing) && isPlainObject(value) ? deepMerge(existing, value) : value;
  }
  return out as T;
}

export interface BootibleConfig {
  schema: number;
  device: string;
  [key: string]: unknown;
}

export interface SyncTargetSpec {
  name: string;
  kind: string;
  roles: string[];
  [key: string]: unknown;
}

export interface TargetsManifest {
  schema: number;
  targets: SyncTargetSpec[];
}

export interface Artifact {
  config: BootibleConfig;
  targets: TargetsManifest;
}

export interface ArtifactSchemas {
  config: object;
  targets: object;
}

/**
 * Load a `.bootible/` bundle — config.yml + targets.yml — validating each
 * against its schema. Throws (with the file name) on invalid content.
 */
export function loadArtifact(dir: string, schemas: ArtifactSchemas): Artifact {
  const config = parseValidatedYaml<BootibleConfig>(
    readFileSync(join(dir, "config.yml"), "utf8"),
    schemas.config,
    "config.yml",
  );
  const targets = parseValidatedYaml<TargetsManifest>(
    readFileSync(join(dir, "targets.yml"), "utf8"),
    schemas.targets,
    "targets.yml",
  );
  return { config, targets };
}
