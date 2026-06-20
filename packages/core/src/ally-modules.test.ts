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

  it("installs Steam via winget and reports applied", () => {
    const steam = allyCatalog.find((m) => m.id === "steam");
    expect(steam).toBeDefined();
    const calls: string[][] = [];
    const result = steam?.apply({ device, config: { schema: 2, device: "rog-ally" } }, (cmd) => {
      calls.push(cmd);
      return "";
    });
    expect(result?.status).toBe("applied");
    expect(calls).toContainEqual([
      "winget",
      "install",
      "--id",
      "Valve.Steam",
      "--accept-source-agreements",
      "--accept-package-agreements",
      "--silent",
    ]);
  });

  it("installs the verified desktop utility set", () => {
    const utilities = allyCatalog.find((m) => m.id === "utilities");
    const calls: string[][] = [];
    utilities?.apply({ device, config: { schema: 2, device: "rog-ally" } }, (cmd) => {
      calls.push(cmd);
      return "";
    });
    const ids = calls.map((c) => c[3]);
    expect(ids).toEqual([
      "Microsoft.PowerToys",
      "7zip.7zip",
      "voidtools.Everything",
      "Microsoft.WindowsTerminal",
    ]);
  });

  it("applies Windows defaults via reg add", () => {
    const wd = allyCatalog.find((m) => m.id === "windows-defaults");
    expect(wd).toBeDefined();
    const calls: string[][] = [];
    const result = wd?.apply({ device, config: { schema: 2, device: "rog-ally" } }, (cmd) => {
      calls.push(cmd);
      return "";
    });
    expect(result?.status).toBe("applied");
    expect(calls.every((c) => c[0] === "reg" && c[1] === "add")).toBe(true);
    expect(calls.some((c) => c.includes("AllowTelemetry"))).toBe(true);
  });

  it("trims background services via sc config", () => {
    const trim = allyCatalog.find((m) => m.id === "optimization");
    expect(trim).toBeDefined();
    const calls: string[][] = [];
    const result = trim?.apply({ device, config: { schema: 2, device: "rog-ally" } }, (cmd) => {
      calls.push(cmd);
      return "";
    });
    expect(result?.status).toBe("applied");
    expect(calls.every((c) => c[0] === "sc" && c[1] === "config")).toBe(true);
    expect(calls).toContainEqual(["sc", "config", "DiagTrack", "start=", "demand"]);
  });

  it("applies display/GPU tweaks via reg add", () => {
    const display = allyCatalog.find((m) => m.id === "display");
    expect(display).toBeDefined();
    const calls: string[][] = [];
    const result = display?.apply({ device, config: { schema: 2, device: "rog-ally" } }, (cmd) => {
      calls.push(cmd);
      return "";
    });
    expect(result?.status).toBe("applied");
    expect(calls.some((c) => c.includes("HwSchMode"))).toBe(true);
  });

  it("power.check reads HibernateEnabled (applied when on, pending when off)", () => {
    const power = allyCatalog.find((m) => m.id === "power");
    const ctx = { device, config: { schema: 2 as const, device: "rog-ally" } };
    const on = (cmd: string[]) =>
      cmd.includes("HibernateEnabled") ? "    HibernateEnabled    REG_DWORD    0x1" : "";
    const off = (cmd: string[]) =>
      cmd.includes("HibernateEnabled") ? "    HibernateEnabled    REG_DWORD    0x0" : "";
    expect(power?.check?.(ctx, on)).toBe("applied");
    expect(power?.check?.(ctx, off)).toBe("pending");
  });

  it("steam.check reports applied only when winget lists the package", () => {
    const steam = allyCatalog.find((m) => m.id === "steam");
    const ctx = { device, config: { schema: 2 as const, device: "rog-ally" } };
    expect(steam?.check?.(ctx, () => "Valve.Steam  Steam  1.0")).toBe("applied");
    expect(steam?.check?.(ctx, () => "No installed package found")).toBe("pending");
  });

  it("declares not-yet-ported modules as skipped without running anything", () => {
    const controller = allyCatalog.find((m) => m.id === "controller");
    expect(controller).toBeDefined();
    const calls: string[][] = [];
    const result = controller?.apply(
      { device, config: { schema: 2, device: "rog-ally" } },
      (cmd) => {
        calls.push(cmd);
        return "";
      },
    );
    expect(result?.status).toBe("skipped");
    expect(calls).toEqual([]);
  });
});
