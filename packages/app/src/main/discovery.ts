import { createSocket, type Socket } from "node:dgram";
import { BEACON_PORT, CHANNELS, parseBeacon } from "@bootible/core";
import type { WebContents } from "electron";
import { lastBuild } from "./build-state";

// ── device discovery (the beacon listener) ───────────────────────────────────

let beaconSocket: Socket | null = null;

/** Listen for device beacons on the LAN and stream each to the renderer. The
 *  device broadcasts {bootible, buildId, mac, ip, hostname, status}; we match
 *  buildId against the last build to flag "mine". */
export function startDiscovery(sender: WebContents): void {
  if (beaconSocket) return;
  try {
    const sock = createSocket({ type: "udp4", reuseAddr: true });
    sock.on("message", (buf) => {
      const device = parseBeacon(buf, lastBuild.id);
      if (device && !sender.isDestroyed()) sender.send(CHANNELS.beaconDevice, device);
    });
    sock.on("error", () => {
      try {
        sock.close();
      } catch {}
      beaconSocket = null;
    });
    sock.bind(BEACON_PORT);
    beaconSocket = sock;
  } catch {
    beaconSocket = null;
  }
}

export function stopDiscovery(): void {
  if (beaconSocket) {
    try {
      beaconSocket.close();
    } catch {}
    beaconSocket = null;
  }
}
