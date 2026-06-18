import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { localTarget } from "./sync-target";

describe("localTarget", () => {
  it("round-trips files through push then pull", () => {
    const base = mkdtempSync(join(tmpdir(), "bootible-"));
    const src = join(base, "src");
    const dest = join(base, "dest");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "save.dat"), "progress");

    const t = localTarget(join(base, "target"));
    t.connect();
    t.push(src, "saves");
    t.pull("saves", dest);

    expect(readFileSync(join(dest, "save.dat"), "utf8")).toBe("progress");
  });

  it("throws when pulling a scope the target lacks", () => {
    const base = mkdtempSync(join(tmpdir(), "bootible-"));
    const t = localTarget(join(base, "target"));
    t.connect();
    expect(() => t.pull("nope", join(base, "dest"))).toThrow("nope");
  });

  it("reports local capabilities", () => {
    const t = localTarget(mkdtempSync(join(tmpdir(), "bootible-")));
    expect(t.capabilities()).toEqual({
      selectiveList: true,
      continuous: false,
      contentAware: false,
    });
  });
});
