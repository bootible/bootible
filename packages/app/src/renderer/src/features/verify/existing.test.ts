// @vitest-environment jsdom
import type { DeviceVerifyResult } from "@bootible/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { session } from "../../lib/session";
import { hydrateVerifyExisting } from "./existing";

const verifyDevice = vi.fn(
  async (): Promise<DeviceVerifyResult> => ({
    reachable: true,
    output: "",
    checks: [{ status: "pass", id: "hostname", label: "Computer name", detail: "" }],
    summary: { pass: 1, fail: 0, skip: 0, total: 1 },
  }),
);

const tick = () => new Promise((r) => setTimeout(r, 0));

function verifyAs(user: string, ip: string): void {
  const host = document.querySelector(".verify-existing") as HTMLElement;
  const [userIn, ipIn] = [...host.querySelectorAll<HTMLInputElement>("input")] as [
    HTMLInputElement,
    HTMLInputElement,
  ];
  userIn.value = user;
  ipIn.value = ip;
  (host.querySelector(".sk-verify-row button") as HTMLButtonElement).click();
}

beforeEach(() => {
  document.body.innerHTML =
    '<p data-field="verify-eyebrow"></p><div class="verify-existing"></div>';
  verifyDevice.mockClear();
  (window as unknown as { bootible: unknown }).bootible = { verifyDevice };
  location.hash = "verify";
});

describe("hydrateVerifyExisting", () => {
  it("verifies a Deck with the bash checks, by address only (no beacon)", async () => {
    session.deviceId = "steamdeck";
    session.deviceName = "Steam Deck / Deck OLED";
    hydrateVerifyExisting();
    expect(document.body.textContent).not.toContain("Find my device");
    verifyAs("deck", "10.0.0.5");
    await tick();
    expect(verifyDevice).toHaveBeenCalledWith("10.0.0.5", "deck", "linux");
    expect(document.querySelector(".sk-report")?.textContent).toContain("All 1 checks passed");
  });

  it("verifies a ROG Ally with the PowerShell checks", async () => {
    session.deviceId = "rog-ally";
    session.deviceName = "ROG Ally";
    hydrateVerifyExisting();
    verifyAs("gavin", "ally.local");
    await tick();
    expect(verifyDevice).toHaveBeenCalledWith("ally.local", "gavin", "windows");
  });

  it("sends a device with no verifier back to its page", () => {
    session.deviceId = "not-a-device";
    hydrateVerifyExisting();
    expect(location.hash).toBe("#home");
    expect(document.querySelector(".verify-existing")?.childElementCount).toBe(0);
  });
});
