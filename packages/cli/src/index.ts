import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { allyExecutor, loadRegistry, onePasswordProvider } from "@bootible/core";
import { run } from "./run";

// NOTE (dev): schemas + registry are resolved relative to the repo. The
// compiled single-file binary will need them embedded — a follow-on slice.
const root = fileURLToPath(new URL("../../../", import.meta.url));
const deviceSchema = JSON.parse(readFileSync(`${root}schemas/device.schema.json`, "utf8"));

const exec = (cmd: string[]): string => {
  const [file, ...args] = cmd;
  return execFileSync(file ?? "", args, { encoding: "utf8" });
};

process.exitCode = run(process.argv.slice(2), {
  stdout: (line) => console.log(line),
  schemas: {
    config: JSON.parse(readFileSync(`${root}schemas/config.schema.json`, "utf8")),
    targets: JSON.parse(readFileSync(`${root}schemas/targets.schema.json`, "utf8")),
  },
  registry: loadRegistry(`${root}registry/devices`, deviceSchema),
  secrets: onePasswordProvider(exec),
  executor: allyExecutor(exec),
  workdir: join(tmpdir(), "bootible-work"),
  savesDest: join(tmpdir(), "bootible-saves"),
});
