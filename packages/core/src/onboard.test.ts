import { describe, expect, it } from "vitest";
import { FRESH_RESTORE_POINT, onboard, POST_CONFIG_RESTORE_POINT } from "./onboard";
import type { Executor } from "./orchestrator";
import type { DeviceEntry } from "./registry";

const device: DeviceEntry = {
  id: "rog-ally",
  name: "ROG Ally",
  provisioning_models: ["on-device"],
};

describe("onboard", () => {
  it("enables restore, snapshots fresh, applies modules, snapshots configured", () => {
    const calls: string[][] = [];
    const exec = (cmd: string[]) => {
      calls.push(cmd);
      return "";
    };
    const executor: Executor = {
      apply: () => ({ actions: ["powercfg /hibernate on"] }),
    };

    const receipt = onboard({ device, config: { schema: 2, device: "rog-ally" }, executor, exec });

    expect(calls.some((c) => c.join(" ").includes("Enable-ComputerRestore"))).toBe(true);
    expect(calls.filter((c) => c.join(" ").includes("Checkpoint-Computer"))).toHaveLength(2);
    expect(receipt.restorePoints).toEqual([FRESH_RESTORE_POINT, POST_CONFIG_RESTORE_POINT]);
    expect(receipt.applied).toContain("powercfg /hibernate on");
  });

  it("creates the fresh checkpoint before running modules and post-config after", () => {
    const order: string[] = [];
    const exec = (cmd: string[]) => {
      const joined = cmd.join(" ");
      if (joined.includes(FRESH_RESTORE_POINT)) order.push("fresh");
      if (joined.includes(POST_CONFIG_RESTORE_POINT)) order.push("post");
      return "";
    };
    const executor: Executor = {
      apply: () => {
        order.push("apply");
        return { actions: [] };
      },
    };

    onboard({ device, config: { schema: 2, device: "rog-ally" }, executor, exec });
    expect(order).toEqual(["fresh", "apply", "post"]);
  });
});
