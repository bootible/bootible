import type { Case } from "./payload.mts";
import type { CaseResult } from "../lib/report.mts";
import { loadConfig } from "../lib/config.mts";
import { withTiKey, genDeckProvision } from "../lib/generate.mts";
import { push, runBash } from "../lib/remote.mts";
import { reset } from "../lib/ti.mts";
import { receiptHasOk } from "../lib/assert.mts";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function deckCase(
  id: string,
  config: any,
  expectOk: string[],
  timeoutMs = 240_000,
): Case & { config: any } {
  return {
    id,
    vm: "bazzite",
    kind: "deck-provision",
    tier: "auto",
    timeoutMs,
    config: withTiKey(config),
    async run(): Promise<CaseResult> {
      const cfg = loadConfig();
      const t = cfg.targets.bazzite;
      await reset(cfg.tiModule, "bazzite");
      const sh = genDeckProvision(config);
      const tmp = join(tmpdir(), `${id.replace(/[:]/g, "_")}.sh`);
      writeFileSync(tmp, sh);
      await push(t, tmp, "~/provision.sh", cfg.keyPath);
      const r = await runBash(t, "bash ~/provision.sh; echo EXIT=$?", cfg.keyPath, timeoutMs);
      const receipt = (await runBash(t, "cat ~/.bootible/receipt", cfg.keyPath)).out;
      const failures = [
        r.out.includes("EXIT=0") ? null : `provision exited non-zero`,
        ...expectOk.map((step) => receiptHasOk(receipt, step)),
      ].filter((f): f is string => !!f);
      return { id, vm: "bazzite", tier: "auto", pass: failures.length === 0, failures };
    },
  };
}

const base = {
  ssh: { enabled: true, port: 22, authorizedKeys: [] },
  createSnapshot: false,
  decky: { enabled: false, plugins: [] },
  proton: { ge: false, protonUpQt: false, protontricks: false },
};
export const deckCases: (Case & { config: any })[] = [
  deckCase(
    "deck:minimal",
    { ...base, createSnapshot: false, flatpakApps: ["flatseal"] },
    ["flathub ready", "flatpak apps done", "ssh ready"],
  ),
  deckCase(
    "deck:flatpak-apps",
    { ...base, flatpakApps: ["flatseal", "vlc", "discord"] },
    ["flatpak apps done"],
  ),
  deckCase(
    "deck:default-browser",
    { ...base, flatpakApps: ["chrome"], defaultBrowser: "chrome" },
    ["default browser: Chrome"],
  ),
  deckCase("deck:tailscale", { ...base, tailscale: true }, ["Trayscale installed"]),
  deckCase(
    "deck:sunshine",
    { ...base, sunshine: { enabled: true, user: "nerdz", pass: "x" } },
    ["Sunshine credentials set"],
  ),
  deckCase("deck:vnc", { ...base, vnc: true }, ["flatpak apps done"]),
  deckCase(
    "deck:static-ip",
    { ...base, staticIp: { iface: "wifi", ip: "172.30.90.13", prefix: 24 } },
    ["static IP"],
  ),
  deckCase("deck:stickdeck", { ...base, stickdeck: true }, ["StickDeck installed"]),
  deckCase(
    "deck:pw-flatpak",
    { ...base, passwordManagers: { managers: ["bitwarden"], method: "flatpak" } },
    ["flatpak apps done"],
  ),
  deckCase(
    "deck:pw-distrobox",
    { ...base, passwordManagers: { managers: ["bitwarden"], method: "distrobox" } },
    ["ssh ready"],
    900_000,
  ),
  deckCase(
    "deck:everything-on",
    {
      ...base,
      hostname: "ti-bazzite",
      flatpakApps: ["flatseal", "vlc"],
      tailscale: true,
      sunshine: { enabled: true, user: "nerdz", pass: "x" },
      vnc: true,
      stickdeck: true,
      waydroid: true,
      passwordManagers: { managers: ["bitwarden"], method: "distrobox" },
    },
    ["flatpak apps done", "ssh ready", "Trayscale installed"],
    900_000,
  ),
];
