import { capabilitiesFor } from "@bootible/core/browser";
import { DeviceReach } from "../../components/DeviceReach";
import { fill } from "../../lib/dom";
import { session } from "../../lib/session";

/** The "Verify existing device" screen: deep-verify a device bootible set up
 *  earlier, reached by address. Which shell the checks run under comes from the
 *  device's verify capability, so a new device needs no change here. */
export function hydrateVerifyExisting(): void {
  const host = document.querySelector<HTMLElement>(".verify-existing");
  if (!host) return;
  const mode = capabilitiesFor(session.deviceId)?.verify;
  fill("verify-eyebrow", `Verify existing device · ${session.deviceName}`);
  if (!mode) {
    host.replaceChildren();
    location.hash = "home";
    return;
  }
  host.replaceChildren(
    DeviceReach({
      onVerify: (ip, user) =>
        window.bootible?.verifyDevice?.(ip, user, mode) ??
        Promise.resolve({ reachable: false, output: "unavailable" }),
      userPlaceholder: mode === "linux" ? "account, e.g. deck" : "account from OOBE",
    }),
  );
}
