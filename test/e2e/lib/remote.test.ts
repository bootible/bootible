import { describe, it, expect } from "vitest";
import { sshArgs, scpArgs } from "./remote.mts";

describe("remote argv builders", () => {
  it("ssh uses the key, disables host-key prompts, no tty by default", () => {
    const a = sshArgs("K", "test-infra", "172.30.90.13").join(" ");
    expect(a).toContain("-i K");
    expect(a).toContain("StrictHostKeyChecking=accept-new");
    expect(a).toContain("test-infra@172.30.90.13");
    expect(a).not.toContain("-tt");
  });
  it("ssh adds -tt only when tty requested", () => {
    expect(sshArgs("K", "u", "1.1.1.1", { tty: true })).toContain("-tt");
  });
  it("scp targets user@ip:dst", () => {
    expect(scpArgs("K", "a.sh", "u", "1.1.1.1", "~/a.sh").join(" ")).toContain("u@1.1.1.1:~/a.sh");
  });
});
