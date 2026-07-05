import { execFile } from "node:child_process";
import { promisify } from "node:util";

const pexec = promisify(execFile);

export function tiCommand(module: string, verb: string, vm: string): string[] {
  return [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    `Import-Module '${module}'; ti ${verb} ${vm}`,
  ];
}

async function runTi(
  module: string,
  verb: string,
  vm: string,
  timeoutMs = 180_000
): Promise<string> {
  const { stdout } = await pexec("pwsh", tiCommand(module, verb, vm), {
    timeout: timeoutMs,
  });
  return stdout;
}

export const up = (module: string, vm: string) => runTi(module, "up", vm);
export const reset = (module: string, vm: string) =>
  runTi(module, "reset", vm);
export const down = (module: string, vm: string) =>
  runTi(module, "down", vm);
export const ip = (module: string, vm: string) => runTi(module, "ip", vm);
