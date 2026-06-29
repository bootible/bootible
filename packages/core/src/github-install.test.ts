import { describe, expect, it } from "vitest";
import { generateGithubReleaseInstall } from "./github-install";

const greenlight = {
  id: "greenlight",
  repo: "unknownskl/greenlight",
  assetPattern: "^Greenlight-Setup-.*\\.exe$",
  silentArgs: "/S",
};

describe("generateGithubReleaseInstall", () => {
  it("is empty when no GitHub-release apps are selected", () => {
    expect(generateGithubReleaseInstall([], "$Root")).toBe("");
  });

  it("resolves + downloads the matched asset from the latest release", () => {
    const s = generateGithubReleaseInstall([greenlight], "$Root");
    expect(s).toContain("'unknownskl/greenlight'"); // repo in the entry
    expect(s).toContain("api.github.com/repos/$($g.repo)/releases/latest"); // latest-release lookup
    expect(s).toContain("'^Greenlight-Setup-.*\\.exe$'"); // the asset-name pattern
    expect(s).toContain("Invoke-WebRequest");
  });

  it("runs the silent installer in the USER session via RunOnce (per-user installer)", () => {
    const s = generateGithubReleaseInstall([greenlight], "$Root");
    expect(s).toContain("RunOnce");
    expect(s).toContain("/S");
  });

  it("single-quote-escapes embedded values", () => {
    const s = generateGithubReleaseInstall(
      [{ id: "x", repo: "a/b", assetPattern: "it's.exe", silentArgs: "/S" }],
      "$Root",
    );
    expect(s).toContain("'it''s.exe'");
  });
});
