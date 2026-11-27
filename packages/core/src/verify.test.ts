import { describe, expect, it } from "vitest";
import { CHECK_MARKER, parseVerifyOutput, summarizeChecks } from "./verify";

const line = (...f: string[]) => [CHECK_MARKER, ...f].join("\t");

describe("parseVerifyOutput", () => {
  it("parses marker lines into checks and ignores everything else", () => {
    const out = [
      "some noise from a login shell",
      line("pass", "flatpak:spotify", "Spotify", ""),
      line("fail", "plugin:TabMaster", "Decky plugin: TabMaster", "not in ~/homebrew/plugins"),
      line("skip", "snapshot", "Rollback snapshot", "root is not btrfs"),
      "WARN something unrelated",
    ].join("\n");
    expect(parseVerifyOutput(out)).toEqual([
      { status: "pass", id: "flatpak:spotify", label: "Spotify", detail: "" },
      {
        status: "fail",
        id: "plugin:TabMaster",
        label: "Decky plugin: TabMaster",
        detail: "not in ~/homebrew/plugins",
      },
      { status: "skip", id: "snapshot", label: "Rollback snapshot", detail: "root is not btrfs" },
    ]);
  });

  it("tolerates CRLF (Windows OpenSSH) and a missing detail field", () => {
    const out = `${line("pass", "hostname", "Hostname")}\r\n`;
    expect(parseVerifyOutput(out)).toEqual([
      { status: "pass", id: "hostname", label: "Hostname", detail: "" },
    ]);
  });

  it("drops lines with an unknown status", () => {
    expect(parseVerifyOutput(line("maybe", "x", "X", ""))).toEqual([]);
  });
});

describe("summarizeChecks", () => {
  it("counts each status", () => {
    const s = summarizeChecks([
      { status: "pass", id: "a", label: "A", detail: "" },
      { status: "pass", id: "b", label: "B", detail: "" },
      { status: "fail", id: "c", label: "C", detail: "" },
      { status: "skip", id: "d", label: "D", detail: "" },
    ]);
    expect(s).toEqual({ pass: 2, fail: 1, skip: 1, total: 4 });
  });
});
