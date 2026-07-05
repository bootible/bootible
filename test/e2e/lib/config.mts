import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export type TargetName = "bazzite" | "cachyos" | "win11" | "win11home";
export interface Target { ip: string; user: string; os: "linux" | "windows"; }
export interface E2EConfig { keyPath: string; tiModule: string; targets: Record<string, Target>; }

export function parseConfig(raw: unknown): E2EConfig {
  const c = raw as Partial<E2EConfig>;
  if (!c || typeof c.keyPath !== "string") throw new Error("e2e config: keyPath (string) is required");
  if (typeof c.tiModule !== "string") throw new Error("e2e config: tiModule (string) is required");
  if (!c.targets || typeof c.targets !== "object") throw new Error("e2e config: targets map is required");
  return { keyPath: c.keyPath, tiModule: c.tiModule, targets: c.targets };
}

export function loadConfig(): E2EConfig {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = join(here, "..", "e2e.config.json");
  return parseConfig(JSON.parse(readFileSync(path, "utf8")));
}
