import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { allyExecutor } from "./ally-executor";
import {
  deckManifestJson,
  manifestEdition,
  manifestProbe,
  parseBuildManifest,
  type WindowsBuildManifest,
  windowsCommand,
  windowsManifestJson,
  windowsProbeCommand,
  writeWindowsManifestPs,
} from "./build-manifest";
import { buildUsbBundle } from "./bundle";
import { generateDeckProvision } from "./deck-provision";
import type { DeviceEntry } from "./registry";

const WIN: WindowsBuildManifest = {
  schema: 1,
  os: "windows",
  path: "usb",
  hostname: "Gavin’s Ally",
  config: {
    schema: 2,
    device: "rog-ally",
    modules: ["sunshine-creds"],
    settings: { sunshine_user: "me", sunshine_pass: "hunter2", ssh_public_keys: ["ssh-ed25519 A"] },
  },
};

describe("build manifest", () => {
  it("never carries a password", () => {
    const win = windowsManifestJson(WIN);
    expect(win).not.toContain("hunter2");
    expect(win).toContain("sunshine_user");
    expect(win).toContain("ssh-ed25519 A");
    const deck = deckManifestJson({ sunshine: { enabled: true, user: "me", pass: "hunter2" } });
    expect(deck).not.toContain("hunter2");
    expect(parseBuildManifest(deck)).toMatchObject({
      os: "linux",
      deck: { sunshine: { user: "me" } },
    });
  });

  it("parses only real manifests (BOM tolerated)", () => {
    expect(parseBuildManifest(`﻿${windowsManifestJson(WIN)}`)?.os).toBe("windows");
    expect(parseBuildManifest("bootible configured 2026-11-27")).toBeNull();
    expect(parseBuildManifest('{"schema":2,"os":"linux","deck":{}}')).toBeNull();
  });

  it("maps the app's edition string", () => {
    expect(manifestEdition("Windows 11 Pro")).toBe("pro");
    expect(manifestEdition("Windows 11 Home")).toBe("home");
    expect(manifestEdition(undefined)).toBeUndefined();
  });

  it("is written by the Deck provisioner and the USB bootstrap", () => {
    const deckScript = generateDeckProvision({
      hostname: "Deck",
      decky: { enabled: true, plugins: ["$(evil)"] },
    });
    const b64 = /printf '%s' '([A-Za-z0-9+/=]+)' \| base64 -d > "\$BOOTIBLE_DIR\/build\.json"/.exec(
      deckScript,
    )?.[1];
    expect(parseBuildManifest(atob(b64 ?? ""))).toMatchObject({ deck: { hostname: "Deck" } });
    const files = buildUsbBundle(
      {
        device: {
          id: "rog-ally",
          name: "ROG Ally",
          provisioning_models: ["on-device"],
        } as DeviceEntry,
        config: { schema: 2, device: "rog-ally", modules: [] },
        account: { mode: "local", username: "gavin", password: "pw-secret" },
        computerName: "ALLY",
        edition: "Windows 11 Pro",
      },
      allyExecutor,
    );
    const bootstrap = files.find((f) => f.path.endsWith("bootstrap.ps1"))?.content ?? "";
    expect(bootstrap).toContain("build.json");
    expect(bootstrap).toContain('"edition":"pro"');
    expect(bootstrap).not.toContain("pw-secret");
  });
});

function powershell(): boolean {
  try {
    execFileSync("powershell", ["-NoProfile", "-Command", "exit 0"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe.skipIf(!powershell())("writeWindowsManifestPs (PowerShell)", () => {
  it("round-trips the manifest, non-ASCII included", () => {
    const dir = mkdtempSync(join(tmpdir(), "bootible-manifest-"));
    const r = spawnSync(
      "powershell",
      ["-NoProfile", "-Command", `$Root = '${dir}'; ${writeWindowsManifestPs(WIN, "$Root")}`],
      { encoding: "utf8" },
    );
    expect(r.stderr).toBe("");
    const back = parseBuildManifest(readFileSync(join(dir, "build.json"), "utf8"));
    expect(back).toMatchObject({ os: "windows", hostname: "Gavin’s Ally" });
  });
});

describe("Windows probe commands", () => {
  it("run the same under a cmd or a PowerShell login shell (no $ or quotes inside)", () => {
    const cmd = manifestProbe("windows");
    expect(cmd.startsWith('powershell -NoProfile -NonInteractive -Command "')).toBe(true);
    expect(cmd.slice(cmd.indexOf('"') + 1, -1)).not.toMatch(/["$`]/);
    expect(windowsProbeCommand("Get-Content C:\\x")).toContain("'BOOTIBLE-MANIFEST'");
    expect(() => windowsCommand("Write-Host $env:USERNAME")).toThrow();
  });
});
