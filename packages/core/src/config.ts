import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
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
  /** Selected module groups; absent = all groups. */
  groups?: string[];
  /** Device settings consumed by modules (e.g. power options). */
  settings?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * The shared, reusable config artifact — the keystone every method produces or
 * consumes: "Export" saves it, "Build USB" bakes it in, "Run on device"
 * applies it. Account mode and WiFi are install-time inputs (see UsbBuildSpec),
 * not part of the saved config, so secrets never land in a reusable file.
 */
export function buildConfig(opts: {
  device: string;
  groups?: string[];
  settings?: Record<string, unknown>;
}): BootibleConfig {
  return {
    schema: 2,
    device: opts.device,
    ...(opts.groups ? { groups: opts.groups } : {}),
    ...(opts.settings ? { settings: opts.settings } : {}),
  };
}

/** Serialize a config to YAML for `.bootible/config.yml` (and account export). */
export function serializeConfig(config: BootibleConfig): string {
  return stringify(config);
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
