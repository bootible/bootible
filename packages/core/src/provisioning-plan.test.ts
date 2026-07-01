import { describe, expect, it } from "vitest";
import {
  type BuildChoice,
  buildProvisioningPlan,
  buildSettings,
  chosenKeys,
  RECOMMENDED_SETTINGS,
  resolveModules,
} from "./provisioning-plan";

// No baseId → base module set is empty, so the tests isolate the modifier logic.
const base: BuildChoice = { modules: [] };

describe("chosenKeys", () => {
  it("trims and drops blank SSH keys", () => {
    expect(chosenKeys({ modules: [], sshPublicKeys: ["  ssh-ed25519 AAA  ", "", "   "] })).toEqual([
      "ssh-ed25519 AAA",
    ]);
  });
});

describe("resolveModules", () => {
  it("unions the explicit modules and drops disabled ones", () => {
    const ids = resolveModules({ modules: ["a", "b", "c"], disabledModules: ["b"] });
    expect(ids).toContain("a");
    expect(ids).toContain("c");
    expect(ids).not.toContain("b");
  });

  it("adds ssh-key only when a key is supplied", () => {
    expect(resolveModules(base)).not.toContain("ssh-key");
    expect(resolveModules({ ...base, sshPublicKeys: ["ssh-ed25519 AAA"] })).toContain("ssh-key");
  });

  it("adds static-ip, sunshine, moonlight and apps from the modifiers", () => {
    const ids = resolveModules({
      ...base,
      staticIp: { iface: "wifi", ip: "192.168.1.5", prefix: 24 },
      remoteAccess: { sunshine: true, moonlight: true },
      selectedApps: ["vlc"],
    });
    expect(ids).toEqual(expect.arrayContaining(["static-ip", "sunshine", "moonlight", "apps"]));
  });

  it("gates remote-desktop on Pro + rdp, and sunshine-creds on user+pass", () => {
    expect(resolveModules({ ...base, edition: "home", remoteAccess: { rdp: true } })).not.toContain(
      "remote-desktop",
    );
    expect(resolveModules({ ...base, edition: "pro", remoteAccess: { rdp: true } })).toContain(
      "remote-desktop",
    );
    expect(
      resolveModules({
        ...base,
        remoteAccess: { sunshine: true },
        sunshineUser: "gavin",
        sunshinePass: "pw",
      }),
    ).toContain("sunshine-creds");
  });
});

describe("buildSettings", () => {
  it("starts from RECOMMENDED_SETTINGS", () => {
    expect(buildSettings(base)).toMatchObject(RECOMMENDED_SETTINGS);
  });

  it("folds in keys, apps, removals and static IP when present", () => {
    const s = buildSettings({
      ...base,
      sshPublicKeys: ["ssh-ed25519 AAA"],
      selectedApps: ["vlc"],
      selectedRemovals: ["xbox"],
      staticIp: { iface: "wifi", ip: "10.0.0.2", prefix: 24 },
    });
    expect(s.ssh_public_keys).toEqual(["ssh-ed25519 AAA"]);
    expect(s.selected_apps).toEqual(["vlc"]);
    expect(s.strip_removals).toEqual(["xbox"]);
    expect(s.static_ip).toMatchObject({ ip: "10.0.0.2" });
  });

  it("only writes sunshine creds when both user and pass are set", () => {
    expect(
      buildSettings({ ...base, remoteAccess: { sunshine: true }, sunshineUser: "g" }),
    ).not.toHaveProperty("sunshine_pass");
    const s = buildSettings({
      ...base,
      remoteAccess: { sunshine: true },
      sunshineUser: "g",
      sunshinePass: "pw",
    });
    expect(s.sunshine_user).toBe("g");
    expect(s.sunshine_pass).toBe("pw");
  });
});

describe("buildProvisioningPlan", () => {
  it("returns the resolved modules and settings together", () => {
    const req: BuildChoice = { ...base, selectedApps: ["vlc"] };
    const plan = buildProvisioningPlan(req);
    expect(plan.modules).toEqual(resolveModules(req));
    expect(plan.settings).toEqual(buildSettings(req));
  });
});
