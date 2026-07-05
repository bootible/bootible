import { describe, expect, it } from "vitest";
import { resolveModules, type BuildChoice } from "@bootible/core";
import { bootstrapCases } from "./bootstrap.mts";

describe("RDP edition gating (resolveModules — pure, no VM)", () => {
  const base: BuildChoice = { modules: [] };

  it("Pro + rdp adds remote-desktop", () => {
    expect(resolveModules({ ...base, edition: "pro", remoteAccess: { rdp: true } })).toContain(
      "remote-desktop",
    );
  });

  it("Home + rdp does NOT add remote-desktop", () => {
    expect(resolveModules({ ...base, edition: "home", remoteAccess: { rdp: true } })).not.toContain(
      "remote-desktop",
    );
  });

  it("no rdp opt-in, even on Pro, does NOT add remote-desktop", () => {
    expect(resolveModules({ ...base, edition: "pro" })).not.toContain("remote-desktop");
  });
});

describe("bootstrapCases shape (no VM — .run() on VM cases is not invoked here)", () => {
  it("registers exactly the RDP, SSH-on-Windows and MSA cases", () => {
    expect(bootstrapCases.map((c) => c.id)).toEqual([
      "bootstrap:rdp-pro",
      "bootstrap:ssh-on-windows",
      "bootstrap:msa-semi",
    ]);
  });

  it("RDP case targets win11 (Pro) with the remote-desktop module, auto tier", () => {
    const rdp = bootstrapCases.find((c) => c.id === "bootstrap:rdp-pro") as any;
    expect(rdp.vm).toBe("win11");
    expect(rdp.tier).toBe("auto");
    expect(rdp.req.modules).toContain("remote-desktop");
  });

  it("SSH-on-Windows case targets win11 with the ssh-key module, auto tier", () => {
    const ssh = bootstrapCases.find((c) => c.id === "bootstrap:ssh-on-windows") as any;
    expect(ssh.vm).toBe("win11");
    expect(ssh.tier).toBe("auto");
    expect(ssh.req.modules).toContain("ssh-key");
    expect(ssh.req.settings.ssh_public_keys.length).toBeGreaterThan(0);
  });

  it("MSA case is tier semi", () => {
    const msa = bootstrapCases.find((c) => c.id === "bootstrap:msa-semi");
    expect(msa?.tier).toBe("semi");
  });
});

describe("MSA case run() — pure (autounattend generation only, no VM)", () => {
  it("passes the semi-attended assertions and always reports skipped", async () => {
    const msa = bootstrapCases.find((c) => c.id === "bootstrap:msa-semi");
    const result = await msa!.run(undefined);
    expect(result.pass).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.skipped).toBe("manual OOBE sign-in with test MSA");
  });
});
