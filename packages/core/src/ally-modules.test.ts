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
    expect(calls.every((c) => c[0] === "sc.exe" && c[1] === "config")).toBe(true);
    expect(calls).toContainEqual(["sc.exe", "config", "DiagTrack", "start=", "demand"]);
  });

  it("xbox-fullscreen sets the Xbox app as the gaming home app (enables Xbox mode)", () => {
    const xbox = allyCatalog.find((m) => m.id === "xbox-fullscreen");
    expect(xbox).toBeDefined();
    expect(xbox?.planned).toBeFalsy();
    const calls: string[][] = [];
    const result = xbox?.apply({ device, config: { schema: 2, device: "rog-ally" } }, (cmd) => {
      calls.push(cmd);
      return "";
    });
    expect(result?.status).toBe("applied");
    const regAdd = calls.find(
      (c) => c[0] === "reg" && c[1] === "add" && c.includes("GamingHomeApp"),
    );
    expect(regAdd).toBeDefined();
    // writes the Xbox app's AUMID as the home app
    expect(regAdd?.some((a) => a.includes("Microsoft.Xbox.App"))).toBe(true);
  });

  it("xbox-fullscreen.check reports applied only when the Xbox home app is set", () => {
    const xbox = allyCatalog.find((m) => m.id === "xbox-fullscreen");
    const ctx = { device, config: { schema: 2 as const, device: "rog-ally" } };
    expect(
      xbox?.check?.(
        ctx,
        () => "    GamingHomeApp    REG_SZ    Microsoft.GamingApp_8wekyb3d8bbwe!Microsoft.Xbox.App",
      ),
    ).toBe("applied");
    expect(xbox?.check?.(ctx, () => "")).toBe("pending");
  });

  it("ssh-key skips cleanly when no public key is provided", () => {
    const ssh = allyCatalog.find((m) => m.id === "ssh-key");
    expect(ssh).toBeDefined();
    const calls: string[][] = [];
    const result = ssh?.apply({ device, config: { schema: 2, device: "rog-ally" } }, (cmd) => {
      calls.push(cmd);
      return "";
    });
    expect(result?.status).toBe("skipped");
    expect(calls).toEqual([]);
  });

  it("ssh-key installs OpenSSH via winget, opens the firewall, authorises the key", () => {
    const ssh = allyCatalog.find((m) => m.id === "ssh-key");
    const calls: string[][] = [];
    const result = ssh?.apply(
      {
        device,
        config: {
          schema: 2,
          device: "rog-ally",
          settings: { ssh_public_key: "ssh-ed25519 AAAAC3Nz gavin@nerdz" },
        },
      },
      (cmd) => {
        calls.push(cmd);
        return "";
      },
    );
    expect(result?.status).toBe("applied");
    // installs OpenSSH via winget (NOT the dism/FoD path that can stall)
    expect(calls).toContainEqual([
      "winget",
      "install",
      "--id",
      "Microsoft.OpenSSH.Preview",
      "--accept-source-agreements",
      "--accept-package-agreements",
      "--silent",
    ]);
    expect(calls.some((c) => c[0] === "dism.exe")).toBe(false);
    // opens the firewall for inbound SSH on TCP 22
    expect(calls.some((c) => c[0] === "powershell" && c.join(" ").includes("LocalPort 22"))).toBe(
      true,
    );
    // writes the key into administrators_authorized_keys with a locked ACL
    const keyWrite = calls.find(
      (c) => c[0] === "powershell" && c.join(" ").includes("administrators_authorized_keys"),
    );
    expect(keyWrite?.join(" ")).toContain("ssh-ed25519 AAAAC3Nz gavin@nerdz");
    expect(keyWrite?.join(" ")).toContain("icacls");
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

  it("declares still-planned modules (sync-target) as skipped without running anything", () => {
    const syncTarget = allyCatalog.find((m) => m.id === "sync-target");
    expect(syncTarget?.planned).toBe(true);
    const calls: string[][] = [];
    const result = syncTarget?.apply(
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

describe("newly-real modules", () => {
  it("leaves only sync-target planned", () => {
    expect(allyCatalog.filter((m) => m.planned).map((m) => m.id)).toEqual(["sync-target"]);
  });

  it("controller installs the controller tools (system group)", () => {
    const controller = allyCatalog.find((m) => m.id === "controller");
    expect(controller?.group).toBe("system");
    expect(controller?.planned).toBeFalsy();
    const calls: string[][] = [];
    controller?.apply({ device, config: { schema: 2, device: "rog-ally" } }, (cmd) => {
      calls.push(cmd);
      return "";
    });
    const ids = calls.map((c) => c[3]);
    expect(ids).toEqual(["BenjaminLSR.HandheldCompanion", "Nefarius.HidHide"]);
  });

  it("emudeck installs its prerequisites; streaming installs the clients", () => {
    const emudeck = allyCatalog.find((m) => m.id === "emudeck");
    const streaming = allyCatalog.find((m) => m.id === "streaming");
    const grab = (m?: (typeof allyCatalog)[number]) => {
      const calls: string[][] = [];
      m?.apply({ device, config: { schema: 2, device: "rog-ally" } }, (cmd) => {
        calls.push(cmd);
        return "";
      });
      return calls.map((c) => c[3]);
    };
    expect(grab(emudeck)).toEqual(["Git.Git", "Python.Python.3.12"]);
    expect(grab(streaming)).toEqual([
      "MoonlightGameStreamingProject.Moonlight",
      "Streetpea.Chiaki-ng",
    ]);
  });

  it("every module carries a description", () => {
    for (const module of allyCatalog) expect(module.description.length).toBeGreaterThan(0);
  });
});

describe("health module", () => {
  const ctx = { device, config: { schema: 2 as const, device: "rog-ally" } };
  const health = () => {
    const m = allyCatalog.find((mod) => mod.id === "health");
    if (!m) throw new Error("health missing");
    return m;
  };

  it("reports all good when every probe matches (read-only — no commands change state)", () => {
    const result = health().apply(ctx, (cmd) => {
      const s = cmd.join(" ");
      if (s.includes("HibernateEnabled")) return "REG_DWORD 0x1";
      if (s.includes("HwSchMode")) return "REG_DWORD 0x2";
      if (s.includes("AllowTelemetry")) return "REG_DWORD 0x0";
      if (s.includes("DiagTrack")) return "START_TYPE : 3 DEMAND_START";
      return "";
    });
    expect(result.status).toBe("applied");
    expect(result.detail).toContain("all good");
  });

  it("lists what isn't set when probes miss", () => {
    const result = health().apply(ctx, () => "");
    expect(result.detail).toContain("not set");
    expect(result.detail).toContain("gpu scheduling");
  });
});
