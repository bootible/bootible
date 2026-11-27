import type { DeviceVerifyResult, VerifyCheck } from "@bootible/core";
import { el } from "../lib/dom";

const MARK: Record<VerifyCheck["status"], string> = { pass: "✓", fail: "✗", skip: "–" };

function checkRow(c: VerifyCheck): HTMLElement {
  const li = el("li", `vr-check vr-${c.status}`);
  li.append(el("span", "vr-mark", MARK[c.status]), el("span", "vr-label", c.label));
  if (c.detail) li.append(el("span", "vr-detail muted", c.detail));
  return li;
}

/**
 * A Verify result as a person reads it: a one-line verdict, then every failed
 * check with its reason, then the skipped ones, with the passes folded away.
 * Without a deep verify (an older build with no manifest) it shows the receipt.
 */
export function VerifyReport(result: DeviceVerifyResult): HTMLElement {
  const root = el("div", "verify-report");
  if (!result.reachable) {
    root.append(el("pre", "watch-result fail", `Couldn't reach it: ${result.output}`));
    return root;
  }
  if (result.alias) {
    root.append(el("div", "watch-alias", `✓ reachable — now just \`ssh ${result.alias}\``));
  }

  const checks = result.checks ?? [];
  const s = result.summary;
  if (!s || checks.length === 0) {
    if (result.checksNote) root.append(el("p", "vr-note muted", result.checksNote));
    root.append(
      el("pre", "watch-result ok", result.output || "Connected, but it returned no receipt yet."),
    );
    return root;
  }

  root.append(
    el(
      "p",
      `vr-verdict ${s.fail ? "fail" : "ok"}`,
      s.fail
        ? `✗ ${s.fail} of ${s.total} checks failed`
        : `✓ All ${s.pass} checks passed${s.skip ? ` (${s.skip} not applicable)` : ""}`,
    ),
  );
  const failed = checks.filter((c) => c.status === "fail");
  const skipped = checks.filter((c) => c.status === "skip");
  const passed = checks.filter((c) => c.status === "pass");
  if (failed.length || skipped.length) {
    const list = el("ul", "vr-list");
    list.append(...failed.map(checkRow), ...skipped.map(checkRow));
    root.append(list);
  }
  if (passed.length) {
    const more = el("details", "vr-passed");
    more.append(el("summary", "", `${passed.length} passed`));
    const list = el("ul", "vr-list");
    list.append(...passed.map(checkRow));
    more.append(list);
    root.append(more);
  }
  return root;
}
