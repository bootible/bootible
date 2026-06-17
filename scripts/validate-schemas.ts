#!/usr/bin/env bun
// Validate every $schema-headed YAML in the repo against its published JSON Schema.
// Phase-1 tooling: with no schema'd YAML yet (registry entries land in Phase-2),
// this validates zero files and passes. See docs/v2/plan.md Phase 1.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { findSchemaUrl, validateYamlAgainstSchema } from "@bootible/core";

const ROOT = process.cwd();
const SCAN_DIRS = ["registry"]; // where $schema-headed YAML will live
const SCHEMA_DIR = join(ROOT, "schemas");

function yamlFiles(): string[] {
  const out: string[] = [];
  for (const dir of SCAN_DIRS) {
    const abs = join(ROOT, dir);
    if (!existsSync(abs)) continue;
    for (const entry of readdirSync(abs, { recursive: true })) {
      const rel = String(entry);
      if (extname(rel) === ".yml" || extname(rel) === ".yaml") out.push(join(abs, rel));
    }
  }
  return out;
}

let checked = 0;
let failures = 0;

for (const file of yamlFiles()) {
  const text = readFileSync(file, "utf8");
  const url = findSchemaUrl(text);
  if (!url) continue; // no header — nothing to validate
  const schemaPath = join(SCHEMA_DIR, basename(new URL(url).pathname));
  if (!existsSync(schemaPath)) {
    console.error(`✗ ${file}: declares schema ${url} but ${schemaPath} is missing`);
    failures++;
    continue;
  }
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const result = validateYamlAgainstSchema(text, schema);
  checked++;
  if (result.valid) {
    console.log(`✓ ${file}`);
  } else {
    console.error(`✗ ${file}:`);
    for (const e of result.errors) console.error(`    ${e}`);
    failures++;
  }
}

console.log(`schema validation: ${checked} validated, ${failures} failed`);
if (failures > 0) process.exit(1);
