import { describe, expect, it } from "vitest";
import { allyCatalog } from "./ally-modules";
import {
  APP_GROUPS,
  appWingetIds,
  getSelectedAppCommands,
  getSelectedGithubReleases,
} from "./apps";
import type { ApplyContext } from "./orchestrator";

const device: ApplyContext["device"] = {
  id: "rog-ally",
  name: "ROG Ally",
  provisioning_models: ["on-device"],
};

describe("app catalog", () => {
  it("has unique app slugs and winget ids across all groups", () => {
    const apps = APP_GROUPS.flatMap((g) => g.apps);
    expect(new Set(apps.map((a) => a.id)).size).toBe(apps.length);
    // winget ids unique among the apps that have one (module/GitHub-release apps
    // like EmuDeck and Greenlight legitimately have none).
    const wingetIds = apps.map((a) => a.wingetId).filter(Boolean);
    expect(new Set(wingetIds).size).toBe(wingetIds.length);
  });

  it("offers Greenlight on Windows via its GitHub release (no winget)", () => {
    const apps = APP_GROUPS.flatMap((g) => g.apps);
    expect(apps.some((a) => a.id === "greenlight")).toBe(true); // shows in the Windows picker
    expect(getSelectedAppCommands(["greenlight"])).toEqual([]); // no winget command
    const gh = getSelectedGithubReleases(["greenlight"]);
    expect(gh).toHaveLength(1);
    expect(gh[0]?.repo).toBe("unknownskl/greenlight");
    expect(gh[0]?.silentArgs).toBe("/S");
  });

  it("dropped CCleaner and DriverEasy", () => {
    const ids = APP_GROUPS.flatMap((g) => g.apps).map((a) => a.wingetId);
    expect(ids).not.toContain("Piriform.CCleaner");
    expect(ids).not.toContain("Easeware.DriverEasy");
  });

  it("resolves selected slugs to winget ids and drops unknowns", () => {
    expect(appWingetIds(["powertoys", "steam", "nope"])).toEqual([
      "Microsoft.PowerToys",
      "Valve.Steam",
    ]);
  });

  it("the apps module installs only the selected picks", () => {
    const mod = allyCatalog.find((m) => m.id === "apps");
    expect(mod).toBeDefined();
    expect(mod?.apply({ device, config: { schema: 2, device: "rog-ally" } }, () => "").status).toBe(
      "skipped",
    );
    const calls: string[][] = [];
    const result = mod?.apply(
      {
        device,
        config: { schema: 2, device: "rog-ally", settings: { selected_apps: ["vlc", "discord"] } },
      },
      (cmd) => {
        calls.push(cmd);
        return "";
      },
    );
    expect(result?.status).toBe("applied");
    expect(calls.map((c) => c[3])).toEqual(["VideoLAN.VLC", "Discord.Discord"]);
  });

  it("getSelectedAppCommands emits winget installs", () => {
    const cmds = getSelectedAppCommands(["git"]);
    expect(cmds[0]?.slice(0, 4)).toEqual(["winget", "install", "--id", "Git.Git"]);
  });

  it("Store-only apps install via --source msstore", () => {
    const cmds = getSelectedAppCommands(["chatgpt"]);
    expect(cmds[0]).toContain("--source");
    expect(cmds[0]).toContain("msstore");
    expect(cmds[0]).toContain("9NT1R1C2HH7J");
  });
});
