import { runBash, runPwsh } from "./remote.mts";
import type { Target } from "./config.mts";

export async function commandOnPath(t: Target, key: string, bin: string): Promise<string | null> {
  const r = await runBash(t, `command -v ${bin} >/dev/null && echo Y || echo N`, key);
  return r.out.includes("Y") ? null : `${bin} not on PATH`;
}

export async function flatpakInstalled(t: Target, key: string, ref: string): Promise<string | null> {
  const r = await runBash(t, `flatpak list --app --columns=application`, key);
  return r.out.includes(ref) ? null : `flatpak ${ref} not installed`;
}

export async function serviceEnabled(t: Target, key: string, unit: string): Promise<string | null> {
  const r = await runBash(t, `systemctl is-enabled ${unit} 2>/dev/null`, key);
  return r.out.includes("enabled") ? null : `${unit} not enabled`;
}

export function receiptHasOk(receipt: string, step: string): string | null {
  return new RegExp(`^ok\\s+${escapeRe(step)}`, "m").test(receipt)
    ? null : `receipt missing ok line: "${step}"`;
}

export function textContains(hay: string, needle: string, label: string): string | null {
  return hay.includes(needle) ? null : `${label}: expected to contain "${needle}"`;
}

export function bundleHasFile(files: { path: string }[], path: string): string | null {
  return files.some(f => f.path === path) ? null : `bundle missing file: ${path}`;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Windows probes (runPwsh) — used by strip-kit and other Windows-VM cases ──

export async function wingetListed(t: Target, key: string, id: string): Promise<string | null> {
  const r = await runPwsh(t, `winget list --id ${id} -e 2>$null | Select-String ${id}`, key);
  return r.out.includes(id) ? null : `winget ${id} not installed`;
}

export async function regEquals(
  t: Target,
  key: string,
  path: string,
  name: string,
  val: string,
): Promise<string | null> {
  const r = await runPwsh(t, `(Get-ItemProperty '${path}' -Name '${name}' -EA SilentlyContinue).'${name}'`, key);
  return r.out.trim() === val ? null : `${path}\\${name} != ${val} (got ${r.out.trim()})`;
}

export async function appxAbsent(t: Target, key: string, pattern: string): Promise<string | null> {
  const r = await runPwsh(
    t,
    `Get-AppxPackage -AllUsers ${pattern} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name`,
    key,
  );
  return r.out.trim().length === 0 ? null : `appx matching ${pattern} still present: ${r.out.trim()}`;
}

export async function portOpen(t: Target, key: string, port: number): Promise<string | null> {
  const r = await runPwsh(
    t,
    `(Test-NetConnection -ComputerName localhost -Port ${port} -WarningAction SilentlyContinue).TcpTestSucceeded`,
    key,
  );
  return r.out.trim().toLowerCase() === "true" ? null : `port ${port} not open`;
}
