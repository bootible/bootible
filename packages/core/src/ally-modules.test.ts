import { describe, expect, it } from "vitest";
import { allyCatalog } from "./ally-modules";
import type { ApplyContext } from "./orchestrator";

const device: ApplyContext["device"] = {
  id: "rog-ally",
  name: "ROG Ally",
  provisioning_models: ["on-device"],
};

describe("allyCatalog", () => {
  it("covers all four setup groups", () => {
    const groups = new Set(allyCatalog.map((m) => m.group));
    expect(groups).toEqual(new Set(["system", "performance", "apps", "library"]));
  });

  it("has a real power module that emits powercfg actions when configured", () => {
    const power = allyCatalog.find((m) => m.id === "power");
    expect(power).toBeDefined();
    const calls: string[][] = [];
    const result = power?.apply(
      { device, config: { schema: 2, device: "rog-ally", settings: { sleep_mode: "hibernate" } } },
      (cmd) => {
        calls.push(cmd);
        return "";
      },
    );
    expect(result?.status).toBe("applied");
    expect(calls).toContainEqual(["powercfg", "/hibernate", "on"]);
    expect(result?.actions).toContain("powercfg /hibernate on");
  });

  it("skips power when no power settings are configured", () => {
    const power = allyCatalog.find((m) => m.id === "power");
    const result = power?.apply({ device, config: { schema: 2, device: "rog-ally" } }, () => "");
    expect(result?.status).toBe("skipped");
  });

  it("declares not-yet-ported modules as skipped without running anything", () => {
    const display = allyCatalog.find((m) => m.id === "display");
    expect(display).toBeDefined();
    const calls: string[][] = [];
    const result = display?.apply({ device, config: { schema: 2, device: "rog-ally" } }, (cmd) => {
      calls.push(cmd);
      return "";
    });
    expect(result?.status).toBe("skipped");
    expect(calls).toEqual([]);
  });
});
