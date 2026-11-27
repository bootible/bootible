import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { psq, type WindowsBuildManifest } from "./build-manifest";
import { buildConfig } from "./config";
import { buildSettings, resolveModules } from "./provisioning-plan";
import { parseVerifyOutput } from "./verify";
import {
  checkForCommand,
  generateWindowsVerify,
  windowsVerifyArgs,
  windowsVerifyChecks,
} from "./windows-verify";

function manifest(
  req: Parameters<typeof resolveModules>[0],
  extra: Partial<WindowsBuildManifest> = {},
): WindowsBuildManifest {
  return {
    schema: 1,
    os: "windows",
    path: "usb",
    config: buildConfig({
      device: "rog-ally",
      modules: resolveModules(req),
      settings: buildSettings(req),
    }),
    ...extra,
  };
}

const FULL = manifest(
  {
    baseId: "full-rog",
    modules: ["controller", "steam", "steam-bigpicture"],
    sshPublicKeys: ["ssh-ed25519 AAAA me@pc"],
    edition: "pro",
    remoteAccess: { rdp: true },
    staticIp: { iface: "wifi", ip: "10.0.0.5", prefix: 24 },
    selectedApps: ["vlc"],
  },
  {
    hostname: "ALLY",
    account: { mode: "local", username: "gavin" },
    locale: "en-NZ",
    timeZone: "New Zealand Standard Time",
  },
);

describe("checkForCommand", () => {
  it("turns a reg add into a typed registry check", () => {
    const c = checkForCommand("display", [
      "reg",
      "add",
      "HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers",
      "/v",
      "HwSchMode",
      "/t",
      "REG_DWORD",
      "/d",
      "2",
      "/f",
    ]);
    expect(c?.id).toBe("display:HwSchMode");
    expect(c?.body).toBe(
      "RegIs 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' 'HwSchMode' '2' -Number",
    );
  });

  it("maps sc.exe start types and winget installs", () => {
    expect(
      checkForCommand("optimization", ["sc.exe", "config", "DiagTrack", "start=", "demand"])?.body,
    ).toBe("SvcStart 'DiagTrack' 'Manual'");
    expect(
      checkForCommand("steam", ["winget", "install", "--id", "Valve.Steam", "--silent"])?.id,
    ).toBe("steam:winget:Valve.Steam");
  });

  it("checks powercfg minutes as the seconds Windows stores", () => {
    expect(
      checkForCommand("power", ["powercfg", "/change", "hibernate-timeout-dc", "30"])?.body,
    ).toBe("PowerIdx SUB_SLEEP HIBERNATEIDLE $false 1800");
    expect(
      checkForCommand("power", [
        "powercfg",
        "/setacvalueindex",
        "SCHEME_CURRENT",
        "SUB_BUTTONS",
        "PBUTTONACTION",
        "1",
      ])?.body,
    ).toBe("PowerIdx SUB_BUTTONS PBUTTONACTION $true 1");
  });

  it("returns null for commands it can't check on their own", () => {
    expect(checkForCommand("power", ["powercfg", "/setactive", "SCHEME_CURRENT"])).toBeNull();
    expect(checkForCommand("x", ["powershell", "-Command", "Restart-Service Foo"])).toBeNull();
  });
});

describe("windowsVerifyChecks", () => {
  const ids = windowsVerifyChecks(FULL).map((c) => c.id);

  it("covers the build's install-time choices", () => {
    for (const id of ["status", "hostname", "account", "locale", "timezone", "restore-point"])
      expect(ids).toContain(id);
  });

  it("derives checks from every module the build applied", () => {
    for (const id of [
      "power:hibernate",
      "display:HwSchMode",
      "windows-defaults:AllowTelemetry",
      "windows-defaults:copilot-app",
      "optimization:svc:DiagTrack",
      "controller:winget:Nefarius.HidHide",
      "steam:winget:Valve.Steam",
      "steam-bigpicture:BootibleSteamBigPicture",
      "ssh-key:sshd",
      "ssh-key:firewall",
      "ssh-key:keys",
      "remote-desktop:fDenyTSConnections",
      "remote-desktop:edition",
      "static-ip:address",
      "apps:winget:VideoLAN.VLC",
    ])
      expect(ids).toContain(id);
  });

  it("has no duplicate ids", () => {
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("checks strip removals only for the strip kit, defaulting to the recommended set", () => {
    const strip = windowsVerifyChecks({ ...FULL, path: "strip" }).map((c) => c.id);
    expect(strip).toContain("removed:mcafee");
    expect(strip).not.toContain("removed:phone-link");
    expect(ids).not.toContain("removed:mcafee");
  });

  it("checks only the modules the provisioner ran when the config names none", () => {
    const bare = (path: WindowsBuildManifest["path"]) =>
      windowsVerifyChecks({
        schema: 1,
        os: "windows",
        path,
        config: { schema: 2, device: "rog-ally", settings: {} },
      }).map((c) => c.id);
    // The strip kit falls back to the universal floor…
    expect(bare("strip")).toContain("windows-defaults:AllowTelemetry");
    expect(bare("strip")).not.toContain("steam:winget:Valve.Steam");
    // …while the bootstrap treats "no list" as every module.
    expect(bare("usb")).toContain("steam:winget:Valve.Steam");
  });

  it("keeps hostile values as data", () => {
    const evil = manifest({ modules: [], sshPublicKeys: ["x'; Remove-Item C:\\ -Recurse; '"] });
    const body = windowsVerifyChecks(evil).find((c) => c.id === "ssh-key:keys")?.body ?? "";
    expect(body).toContain("'x''; Remove-Item C:\\ -Recurse; '''");
  });

  it("emits a pure-ASCII script, even for non-ASCII and curly-quote values", () => {
    const script = generateWindowsVerify({
      ...FULL,
      path: "strip",
      hostname: "Gavin\u2019s Ally \u2014 caf\u00e9",
    });
    expect(/^[\t\n\r -~]*$/.test(script)).toBe(true);
    expect(psq("it\u2019s $x")).toBe('"it$([char]0x2019)s `$x"');
  });
});

function powershell(): string | null {
  try {
    execFileSync("powershell", ["-NoProfile", "-Command", "exit 0"], { stdio: "ignore" });
    return "powershell";
  } catch {
    return null;
  }
}
const PS = powershell();

describe.skipIf(!PS)("generateWindowsVerify (PowerShell)", () => {
  it("parses with no syntax errors", () => {
    const dir = mkdtempSync(join(tmpdir(), "bootible-wverify-"));
    const f = join(dir, "verify.ps1");
    writeFileSync(f, generateWindowsVerify({ ...FULL, path: "strip" }), "utf8");
    const r = spawnSync(
      PS as string,
      [
        "-NoProfile",
        "-Command",
        `$e=$null; [void][System.Management.Automation.Language.Parser]::ParseFile('${f}', [ref]$null, [ref]$e); $e | ForEach-Object { $_.Message }; exit $e.Count`,
      ],
      { encoding: "utf8" },
    );
    expect(r.stdout.trim()).toBe("");
    expect(r.status).toBe(0);
  });

  it("runs and reports one result per check (on this PC, most will fail — that's fine)", () => {
    const m = manifest({ modules: [] }, { hostname: "NOT-THIS-PC" });
    const f = join(mkdtempSync(join(tmpdir(), "bootible-wverify-")), "verify.ps1");
    writeFileSync(f, generateWindowsVerify(m), "ascii");
    const r = spawnSync(PS as string, windowsVerifyArgs(f), { encoding: "utf8", timeout: 120000 });
    const checks = parseVerifyOutput(r.stdout);
    expect(r.stderr).toBe("");
    expect(checks.map((c) => c.id)).toEqual(windowsVerifyChecks(m).map((c) => c.id));
    expect(checks.find((c) => c.id === "hostname")?.detail).toMatch(/^computer name is /);
  }, 150000);
});
