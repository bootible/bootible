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
