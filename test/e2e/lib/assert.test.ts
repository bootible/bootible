import { describe, it, expect } from "vitest";
import { receiptHasOk, textContains, bundleHasFile } from "./assert.mts";

describe("assertion primitives", () => {
  it("receiptHasOk returns null on a present ok line, message otherwise", () => {
    const receipt = "ok   flathub ready\nok   flatpak apps done\n";
    expect(receiptHasOk(receipt, "flatpak apps done")).toBeNull();
    expect(receiptHasOk(receipt, "Proton-GE installed")).toMatch(/Proton-GE/);
  });
  it("bundleHasFile finds an expected artifact path", () => {
    const files = [{ path: "autounattend.xml" }, { path: "sources/$OEM$/$1/bootible/bootstrap.ps1" }];
    expect(bundleHasFile(files, "autounattend.xml")).toBeNull();
    expect(bundleHasFile(files, "missing.xml")).toMatch(/missing.xml/);
  });
});
