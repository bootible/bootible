import { createSocket } from "node:dgram";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BEACON_PORT, parseBeacon } from "@bootible/core";
import type { Case } from "./payload.mts";
import type { CaseResult } from "../lib/report.mts";
import { loadConfig } from "../lib/config.mts";
import { withTiKey, genDeckProvision } from "../lib/generate.mts";
import { push, runBash, waitForSsh } from "../lib/remote.mts";
import { reset } from "../lib/ti.mts";

/** How long, after the provision script returns, to keep listening for the
 *  end-of-provision beacon before giving up (see deck-provision.ts beaconBlock
 *  — the guest fires one within a few seconds of finishing, every 5s after). */
const BEACON_WINDOW_MS = 30_000;

/** Bind a host-side UDP listener on the beacon port and resolve true as soon as
 *  a beacon matching buildId arrives, or false once deadlineMs passes with
 *  nothing matching. Binds immediately so no beacon sent while the provision
 *  script is still running is missed. */
function waitForMatchingBeacon(buildId: string, deadlineMs: number): { result: Promise<boolean>; close(): void } {
  const sock = createSocket({ type: "udp4", reuseAddr: true });
  let settled = false;
  let resolveFn: (v: boolean) => void;
  const result = new Promise<boolean>((resolve) => {
    resolveFn = resolve;
  });
  const finish = (v: boolean): void => {
    if (settled) return;
    settled = true;
    try {
      sock.close();
    } catch {}
    resolveFn(v);
  };
  sock.on("message", (buf) => {
    const device = parseBeacon(buf, buildId);
    if (device?.mine) finish(true);
  });
  sock.on("error", () => finish(false));
  try {
    sock.bind(BEACON_PORT);
  } catch {
    finish(false);
  }
  const timer = setTimeout(() => finish(false), deadlineMs);
  return {
    result: result.finally(() => clearTimeout(timer)),
    close: () => finish(false),
  };
}

/** End-to-end discovery: bake a fixed buildId into a Deck provision, run it on
 *  the bazzite target, and assert the desktop-side beacon parser (see
 *  packages/core/src/beacon.ts parseBeacon) would recognise the guest's
 *  end-of-provision beacon as "mine" within BEACON_WINDOW_MS of it finishing.
 *  ti-net carries broadcast host<->guest so the real UDP broadcast the device
 *  emits reaches this host socket, same as it would reach the real app. */
const discoveryCase: Case & { config: any } = {
  id: "discovery:beacon-e2e",
  vm: "bazzite",
  kind: "discovery",
  tier: "auto",
  timeoutMs: 240_000,
  config: withTiKey({
    ssh: { enabled: true, port: 22, authorizedKeys: [] },
    createSnapshot: false,
    decky: { enabled: false, plugins: [] },
    proton: { ge: false, protonUpQt: false, protontricks: false },
  }),
  async run(): Promise<CaseResult> {
    const cfg = loadConfig();
    const t = cfg.targets.bazzite;
    await reset(cfg.tiModule, "bazzite");
    await waitForSsh(t, cfg.keyPath);

    const buildId = randomBytes(6).toString("hex");
    const deckConfig = withTiKey({
      ssh: { enabled: true, port: 22, authorizedKeys: [] },
      createSnapshot: false,
      decky: { enabled: false, plugins: [] },
      proton: { ge: false, protonUpQt: false, protontricks: false },
      buildId,
    });
    const sh = genDeckProvision(deckConfig);
    const tmp = join(tmpdir(), "discovery_beacon-e2e.sh");
    writeFileSync(tmp, sh);
    await push(t, tmp, "~/provision.sh", cfg.keyPath);

    // Bind before running so a beacon fired the instant provisioning finishes
    // (it's nohup'd, detached from the ssh session) is never missed.
    const listener = waitForMatchingBeacon(buildId, 240_000 + BEACON_WINDOW_MS);
    const r = await runBash(t, "bash ~/provision.sh; echo EXIT=$?", cfg.keyPath, 240_000);
    const arrived = await listener.result;

    const failures = [
      r.out.includes("EXIT=0") ? null : "provision exited non-zero",
      arrived ? null : `no matching beacon (buildId=${buildId}) arrived within ${BEACON_WINDOW_MS}ms of provisioning finishing`,
    ].filter((f): f is string => !!f);
    return {
      id: "discovery:beacon-e2e",
      vm: "bazzite",
      tier: "auto",
      pass: failures.length === 0,
      failures,
    };
  },
};

export const discoveryCases: (Case & { config: any })[] = [discoveryCase];
