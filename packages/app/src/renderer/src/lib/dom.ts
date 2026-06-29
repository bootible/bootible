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
