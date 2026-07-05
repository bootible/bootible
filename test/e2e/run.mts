import { ALL_CASES } from "./cases/index.mts";
import { exitCode, renderReport, type CaseResult } from "./lib/report.mts";

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const kind = opt("--kind");
const vm = opt("--vm");
const only = opt("--case");

const selected = ALL_CASES.filter(
  (c) => (!kind || c.kind === kind) && (!vm || c.vm === vm) && (!only || c.id === only),
);

const results: CaseResult[] = [];
for (const c of selected) {
  try {
    results.push(await c.run({}));
  } catch (e) {
    results.push({ id: c.id, vm: c.vm, tier: c.tier, pass: false, failures: [String(e)] });
  }
}

console.log(renderReport(results));
process.exit(exitCode(results));
