import { runBash } from "./remote.mts";
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
