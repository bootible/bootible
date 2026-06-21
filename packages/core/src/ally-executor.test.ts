import { describe, expect, it } from "vitest";
import { allyExecutor } from "./ally-executor";
import type { StepEvent } from "./modules";
import type { ApplyContext } from "./orchestrator";

const device: ApplyContext["device"] = {
  id: "rog-ally",
  name: "ROG Ally",
  provisioning_models: ["on-device"],
};

describe("allyExecutor", () => {
  it("applies hibernate power config via powercfg and records the actions", () => {
    const calls: string[][] = [];
    const exec = (cmd: string[]) => {
      calls.push(cmd);
      return "";
    };
    const receipt = allyExecutor(exec).apply({
      device,
      config: { schema: 2, device: "rog-ally", settings: { sleep_mode: "hibernate" } },
    });
    expect(calls).toContainEqual(["powercfg", "/hibernate", "on"]);
    expect(receipt.actions).toContain("powercfg /hibernate on");
  });

  it("skips power when unconfigured but still runs the app-install modules", () => {
    const calls: string[][] = [];
    const exec = (cmd: string[]) => {
      calls.push(cmd);
      return "";
    };
    const receipt = allyExecutor(exec).apply({
      device,
      config: { schema: 2, device: "rog-ally" },
    });
    // no powercfg without power settings...
    expect(calls.some((c) => c[0] === "powercfg")).toBe(false);
    // ...but Steam's winget install still runs
    expect(calls).toContainEqual([
      "winget",
      "install",
      "--id",
      "Valve.Steam",
      "--accept-source-agreements",
      "--accept-package-agreements",
      "--silent",
    ]);
    expect(receipt.actions.length).toBeGreaterThan(0);
  });

  it("runs only the selected modules when config.modules is set", () => {
    const events: StepEvent[] = [];
    allyExecutor(() => "").apply(
      { device, config: { schema: 2, device: "rog-ally", modules: ["steam"] } },
      (e) => events.push(e),
    );
    const running = events.filter((e) => e.status === "running").map((e) => e.moduleId);
    expect(running).toEqual(["steam"]);
    expect(running).not.toContain("power");
  });

  it("streams a running event then a terminal status for every module", () => {
    const events: StepEvent[] = [];
    allyExecutor(() => "").apply({ device, config: { schema: 2, device: "rog-ally" } }, (e) =>
      events.push(e),
    );

    const running = events.filter((e) => e.status === "running").map((e) => e.moduleId);
    expect(running).toContain("power");
    expect(running).toContain("emudeck");

    // every module that started also reported a terminal (non-running) status
    const terminal = events.filter((e) => e.status !== "running");
    expect(terminal).toHaveLength(running.length);
  });
});
