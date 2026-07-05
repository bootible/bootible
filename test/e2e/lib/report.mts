export interface CaseResult {
  id: string; vm: string; tier: "auto" | "semi" | "manual";
  pass: boolean; failures: string[]; skipped?: string;
}

export function exitCode(results: CaseResult[]): number {
  return results.some(r => !r.skipped && r.pass === false) ? 1 : 0;
}

export function renderReport(results: CaseResult[]): string {
  const lines: string[] = ["", "=== bootible E2E results ==="];
  for (const r of results) {
    const mark = r.skipped ? "SKIP" : r.pass ? "PASS" : "FAIL";
    lines.push(`  [${mark}] ${r.id.padEnd(28)} ${r.vm.padEnd(10)} (${r.tier})${r.skipped ? ` — skipped: ${r.skipped}` : ""}`);
    for (const f of r.failures) lines.push(`         └─ ${f}`);
  }
  const failed = results.filter(r => !r.skipped && !r.pass).length;
  const passed = results.filter(r => !r.skipped && r.pass).length;
  const skipped = results.filter(r => r.skipped).length;
  lines.push("", `  ${passed} passed, ${failed} failed, ${skipped} skipped`, "");
  return lines.join("\n");
}
