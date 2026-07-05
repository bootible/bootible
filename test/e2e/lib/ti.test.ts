import { describe, it, expect } from "vitest";
import { tiCommand } from "./ti.mts";

describe("ti argv builder", () => {
  it("imports the module and runs the verb non-interactively", () => {
    const argv = tiCommand("G:/x/ti/ti.psd1", "reset", "bazzite");
    expect(argv[0]).toBe("-NoProfile");
    const cmd = argv.join(" ");
    expect(cmd).toContain("Import-Module 'G:/x/ti/ti.psd1'");
    expect(cmd).toContain("ti reset bazzite");
  });
});
