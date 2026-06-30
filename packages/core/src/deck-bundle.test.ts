import { describe, expect, it } from "vitest";
import { buildDeckBundle } from "./deck-bundle";

describe("buildDeckBundle", () => {
  it("emits provision.sh, config.json and a README under bootible/", () => {
    const files = buildDeckBundle({});
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual(["bootible/README.txt", "bootible/config.json", "bootible/provision.sh"]);
  });

  it("provision.sh is the generated runner; config.json round-trips the config", () => {
    const files = buildDeckBundle({ flatpakApps: ["discord"], emudeck: true });
    const sh = files.find((f) => f.path === "bootible/provision.sh");
    const json = files.find((f) => f.path === "bootible/config.json");
    expect(sh?.content).toContain("#!/usr/bin/env bash");
    expect(sh?.content).toContain("com.discordapp.Discord");
    const cfg = JSON.parse(json?.content ?? "{}");
    expect(cfg.flatpakApps).toContain("discord");
    expect(cfg.emudeck).toBe(true);
  });

  it("README tailors the finish steps to what's enabled", () => {
    const withEmu = buildDeckBundle({ emudeck: true }).find(
      (f) => f.path === "bootible/README.txt",
    );
    expect(withEmu?.content).toContain("EmuDeck wizard");
    const noEmu = buildDeckBundle({ emudeck: false }).find((f) => f.path === "bootible/README.txt");
    expect(noEmu?.content).not.toContain("EmuDeck wizard");
  });

  it("points at the BOOTIBLE partition in the run instructions", () => {
    const readme = buildDeckBundle({}).find((f) => f.path === "bootible/README.txt");
    expect(readme?.content).toContain("/run/media/*/BOOTIBLE/bootible/provision.sh");
  });

  it("threads a buildId into the beacon and config.json", () => {
    const files = buildDeckBundle({ buildId: "feedface" });
    const sh = files.find((f) => f.path === "bootible/provision.sh");
    const json = files.find((f) => f.path === "bootible/config.json");
    expect(sh?.content).toContain("'feedface'"); // beacon broadcasts this token
    expect(sh?.content).toContain("50474");
    expect(JSON.parse(json?.content ?? "{}").buildId).toBe("feedface");
  });

  it("omits the beacon when no buildId is set (hand-built carrier)", () => {
    const sh = buildDeckBundle({}).find((f) => f.path === "bootible/provision.sh");
    expect(sh?.content).not.toContain("50474");
  });
});
