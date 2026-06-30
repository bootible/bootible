/**
 * Minimal element builder for renderer components — DOM-only so components stay
 * unit-testable under jsdom (no dependency on the main.ts entry script).
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text = "",
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** Set the text of every `[data-field="<field>"]` element on the page. */
export function fill(field: string, value: string): void {
  for (const node of document.querySelectorAll<HTMLElement>(`[data-field="${field}"]`)) {
    node.textContent = value;
  }
}

/** "1 step" / "3 steps" — pluralise a step count. */
export function steps(n: number): string {
  return `${n} step${n === 1 ? "" : "s"}`;
}
