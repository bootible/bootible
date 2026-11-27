// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VIEWS } from "./router";

// Every .view is display:none until a body[data-view=X] rule shows it, so a
// routed screen missing its rule (or its markup) renders as a blank page.
const renderer = join(__dirname, "..", "..");
const css = readFileSync(join(renderer, "src", "styles.css"), "utf8");
const html = readFileSync(join(renderer, "index.html"), "utf8");

describe("routed views", () => {
  it.each([...VIEWS])("%s has markup and a rule that shows it", (view) => {
    expect(html).toContain(`data-view="${view}"`);
    expect(css).toContain(`body[data-view="${view}"] .view[data-view="${view}"]`);
  });
});
