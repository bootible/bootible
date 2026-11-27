import { describe, expect, it } from "vitest";
import { artifactBytes, outputTail } from "./vmcase.mts";

describe("artifactBytes", () => {
  it("prefixes .ps1 with a UTF-8 BOM, like the app's strip-kit writer", () => {
    const [data, enc] = artifactBytes({ ext: "ps1", content: "Write-Host 'a — b'" });
    expect(data.charCodeAt(0)).toBe(0xfeff);
    expect(data.slice(1)).toBe("Write-Host 'a — b'");
    expect(enc).toBe("utf8");
  });

  it("writes .bat as ASCII with no BOM", () => {
    expect(artifactBytes({ ext: "bat", content: "@echo off" })).toEqual(["@echo off", "ascii"]);
  });

  it("leaves other artifacts as plain UTF-8", () => {
    expect(artifactBytes({ ext: "xml", content: "<a/>" })).toEqual(["<a/>", "utf8"]);
  });
});

describe("outputTail", () => {
  it("returns the last non-blank lines, indented under the failure", () => {
    const tail = outputTail("one\n\ntwo\r\nthree\n  \n", 2);
    expect(tail).toBe("\n            two\n            three");
  });

  it("is empty when there was no output", () => {
    expect(outputTail("\n \n")).toBe("");
  });
});
