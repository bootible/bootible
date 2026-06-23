import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createSocket, type Socket } from "node:dgram";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, networkInterfaces } from "node:os";
import { dirname, join } from "node:path";
import {
  type AccountMode,
  BASES,
  type Base,
  BEACON_PORT,
  type Bundle,
  baseById,
  baseModuleIds,
  buildConfig,
  buildUsbBundle,
  checkModules,
  type DeviceEntry,
  type DeviceProfile,
  type DeviceSummary,
  DISPLAY_LANGUAGES,
  defaultKeyboardRegion,
  deviceProfile,
  deviceSummary,
  type Exec,
  type GroupSummary,
  generateBootstrapScript,
  groupCatalog,
  KEYBOARD_REGIONS,
  keyboardRegionById,
  loadRegistry,
  type ModuleStateReport,
  PLATFORMS,
  type ProvisioningMethod,
  platformForOs,
  provisioningMethods,
  ROADMAP_DEVICES,
  type StepEvent,
  type SystemInfo,
  selectDevice,
  serializeConfig,
  type UsbBuildSpec,
} from "@bootible/core";
import { app, BrowserWindow, dialog, ipcMain, shell, type WebContents } from "electron";

// Resource roots. In dev, schemas/registry live at the repo root and the USB
// script under packages/app/resources. In a packaged app they're shipped as
// extraResources under process.resourcesPath (see electron-builder config).
const repoRoot = join(__dirname, "../../../../");
const dataRoot = app.isPackaged ? process.resourcesPath : repoRoot;
const prepareUsbScript = app.isPackaged
  ? join(process.resourcesPath, "prepare-usb.ps1")
  : join(repoRoot, "packages/app/resources/prepare-usb.ps1");

/** Read a value from the BIOS hardware key (fast, no WMI), or undefined. */
function regBios(value: string): string | undefined {
  try {
    const out = execFileSync(
      "reg",
      ["query", "HKLM\\HARDWARE\\DESCRIPTION\\System\\BIOS", "/v", value],
      { encoding: "utf8" },
    );
    return out.match(new RegExp(`${value}\\s+REG_SZ\\s+(.+)`))?.[1]?.trim();
  } catch {
    return undefined;
  }
}

/** What this machine reports about itself, for hardware whitelist detection. */
function getSystemInfo(): SystemInfo {
  return {
    platform: process.platform,
    manufacturer: regBios("SystemManufacturer"),
    model: regBios("SystemProductName"),
  };
}

/** Load + validate the device registry. */
function loadRegistryEntries(): DeviceEntry[] {
  const deviceSchema = JSON.parse(
    readFileSync(join(dataRoot, "schemas/device.schema.json"), "utf8"),
  );
  return loadRegistry(join(dataRoot, "registry/devices"), deviceSchema);
}

/** The device THIS machine is (hardware whitelist match), or null — used by
 *  detection, on-device state, and the hard-blocked Run-on-device apply. */
function loadDeviceEntry(): DeviceEntry | null {
  return selectDevice(loadRegistryEntries(), getSystemInfo());
}

/** The device the user picked on the device-selector pages (page 1/2). Drives
 *  the catalog, bundles, methods and the build from here on. */
let selectedDeviceId: string | null = null;

/** The device we build media / configs FOR (host-side) — the user's pick, or the
 *  Ally as a fallback. Works from any PC, since you build a handheld's USB from
 *  your desktop. */
function targetDevice(): DeviceEntry | null {
  const registry = loadRegistryEntries();
  if (selectedDeviceId) {
    const picked = registry.find((d) => d.id === selectedDeviceId);
    if (picked) return picked;
  }
  return registry.find((d) => d.id === "rog-ally") ?? registry[0] ?? null;
}

/** Platform families with ready/coming-soon status (page 1). A platform is
 *  ready if any of its registry devices has a buildable DeviceProfile. */
function getPlatforms(): { id: string; label: string; blurb: string; status: string }[] {
  const registry = loadRegistryEntries();
  return PLATFORMS.map((p) => {
    const ready = registry.some((d) => platformForOs(d.os) === p.id && !!deviceProfile(d.id));
    return { id: p.id, label: p.label, blurb: p.blurb, status: ready ? "ready" : "coming-soon" };
  });
}

/** Devices for a platform (page 2): registry devices (ready if they have a
 *  profile) followed by roadmap placeholders, ready first. */
function getDevices(platformId: string): { id: string; name: string; status: string }[] {
  const registry = loadRegistryEntries();
  const real = registry
    .filter((d) => platformForOs(d.os) === platformId)
    .map((d) => ({
      id: d.id,
      name: d.name,
      status: deviceProfile(d.id) ? "ready" : "coming-soon",
    }));
  const roadmap = ROADMAP_DEVICES.filter((r) => r.platform === platformId).map((r) => ({
    id: r.id,
    name: r.name,
    status: "coming-soon",
  }));
  return [...real, ...roadmap].sort(
    (a, b) => (a.status === "ready" ? 0 : 1) - (b.status === "ready" ? 0 : 1),
  );
}

/** Record the picked device (only if buildable) and return its summary for the
 *  summary screen, or null if it isn't a real, ready device. */
function selectDeviceById(id: string): DeviceSummary | null {
  const entry = loadRegistryEntries().find((d) => d.id === id);
  if (!entry || !deviceProfile(entry.id)) return null;
  selectedDeviceId = entry.id;
  return deviceSummary(entry);
}

/** The provisioning profile (catalog + bundles + executor) for a device. */
function profileFor(device: DeviceEntry | null): DeviceProfile | null {
  return device ? deviceProfile(device.id) : null;
}

/** Project the detected device for the renderer, or null if none matches. */
function getDevice(): DeviceSummary | null {
  try {
    const entry = loadDeviceEntry();
    return entry ? deviceSummary(entry) : null;
  } catch (error) {
    console.error("device:get failed", error);
    return null;
  }
}

/** The target device's module catalog, grouped for the setup screen. */
function getCatalog(): GroupSummary[] {
  const profile = profileFor(targetDevice());
  return profile ? groupCatalog(profile.catalog) : [];
}

/** The target device's recommended bundles (the "set it up for me" path). */
function getBundles(): Bundle[] {
  return profileFor(targetDevice())?.bundles ?? [];
}

// ── host SSH integration (the key-picker replaces paste-a-key) ───────────────

export interface HostSshKey {
  /** The .pub filename, used as a stable id in the picker. */
  id: string;
  /** Human label — the key's comment, or the filename. */
  label: string;
  /** Key type (ssh-ed25519, ssh-rsa, …). */
  type: string;
  /** The full public-key line — exactly what gets authorised on the device. */
  publicKey: string;
}

function sshDir(): string {
  return join(homedir(), ".ssh");
}

function readPubKey(dir: string, file: string): HostSshKey | null {
  try {
    const content = readFileSync(join(dir, file), "utf8").trim();
    const parts = content.split(/\s+/);
    if (parts.length < 2) return null; // not a key line
    const type = parts[0] ?? "";
    const comment = parts.slice(2).join(" ");
    return { id: file, label: comment || file, type, publicKey: content };
  } catch {
    return null;
  }
}

/** Enumerate the user's SSH public keys on THIS machine (~/.ssh/*.pub) — the
 *  picker source. Public keys only; private keys are never read. */
function getHostSshKeys(): HostSshKey[] {
  try {
    const dir = sshDir();
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f) => f.endsWith(".pub"))
      .map((f) => readPubKey(dir, f))
      .filter((k): k is HostSshKey => k !== null);
  } catch {
    return [];
  }
}

/** Install the streaming pair on THIS desktop (the host) so it can serve games
 *  to / view the handheld. Sunshine = server, Moonlight = client. winget,
 *  best-effort. Returns a short per-app status line. */
function installHostStreaming(): { ok: boolean; output: string } {
  const apps = [
    { id: "LizardByte.Sunshine", role: "Sunshine (server)" },
    { id: "MoonlightGameStreamingProject.Moonlight", role: "Moonlight (client)" },
  ];
  const lines: string[] = [];
  let ok = true;
  for (const app of apps) {
    try {
      execFileSync(
        "winget",
        [
          "install",
          "--id",
          app.id,
          "--accept-source-agreements",
          "--accept-package-agreements",
          "--silent",
        ],
        { encoding: "utf8", timeout: 300000 },
      );
      lines.push(`${app.role}: installed`);
    } catch (error) {
      const e = error as { status?: number };
      // winget exits non-zero when already installed; treat that as fine.
      if (e.status === 0x8a15002b || e.status === -1978335189) {
        lines.push(`${app.role}: already installed`);
      } else {
        lines.push(`${app.role}: see winget`);
        ok = false;
      }
    }
  }
  return { ok, output: lines.join("\n") };
}

/** Generate a passwordless ed25519 keypair for hands-free SSH, when the user has
 *  none. Returns its public key (added to the picker), or null if ssh-keygen
 *  isn't available. */
function generateHostSshKey(comment: string): HostSshKey | null {
  try {
    const dir = sshDir();
    mkdirSync(dir, { recursive: true });
    const path = join(dir, "id_ed25519_bootible");
    if (!existsSync(`${path}.pub`)) {
      execFileSync(
        "ssh-keygen",
        ["-t", "ed25519", "-f", path, "-N", "", "-C", comment || "bootible"],
        {
          stdio: "ignore",
        },
      );
    }
    return readPubKey(dir, "id_ed25519_bootible.pub");
  } catch {
    return null;
  }
}

/** The base catalog (page after device summary) — the experience the handheld
 *  boots into. Projects just what the renderer needs. */
function getBases(): Array<Pick<Base, "id" | "label" | "description" | "tag" | "recommended">> {
  return BASES.map((b) => ({
    id: b.id,
    label: b.label,
    description: b.description,
    tag: b.tag,
    recommended: b.recommended,
  }));
}

/** Provisioning methods for the target device — derived from its registry
 *  provisioning_models, so the method screen supports any device type. */
function getMethods(): ProvisioningMethod[] {
  const device = targetDevice();
  return device ? provisioningMethods(device) : [];
}

/** Probe current module state on the detected device (read-only). [] off-device. */
function getDeviceState(): ModuleStateReport[] {
  const device = loadDeviceEntry();
  const profile = profileFor(device);
  if (!device || !profile) return [];
  const readExec: Exec = (cmd) => {
    const [file, ...args] = cmd;
    try {
      return execFileSync(file ?? "", args, { encoding: "utf8" });
    } catch (error) {
      return String((error as { stdout?: Buffer }).stdout ?? "");
    }
  };
  const config = buildConfig({ device: device.id, settings: RECOMMENDED_SETTINGS });
  return checkModules(profile.catalog, { device, config }, readExec);
}

/**
 * Method B — serialize the chosen config and let the user save it (a save
 * dialog). Builds the SAME config the USB and run-on-device paths build (same
 * modules + settings) so every approach ends with the device set identically.
 * Returns the written path, or null if cancelled.
 */
async function exportConfig(
  win: BrowserWindow,
  req: BuildChoice,
): Promise<{ path: string } | null> {
  const modules = resolveModules(req);
  const config = buildConfig({
    device: targetDevice()?.id ?? "rog-ally",
    modules: modules.length ? modules : undefined,
    settings: buildSettings(req),
  });

  const result = await dialog.showSaveDialog(win, {
    title: "Export bootible config",
    defaultPath: "config.yml",
    filters: [{ name: "YAML", extensions: ["yml", "yaml"] }],
  });
  if (result.canceled || !result.filePath) return null;

  writeFileSync(result.filePath, serializeConfig(config), "utf8");
  return { path: result.filePath };
}

export interface UsbBuildRequest {
  /** Modifier module ids the user added on top of the base. */
  modules: string[];
  /** Chosen base id (raw / steam-bp / xbox / full-rog). Resolves to the base's
   *  shell + software floor, unioned with the universal floor and the modifiers. */
  baseId?: string;
  /** The user's chosen SSH public keys (plain data); enables the ssh-key module. */
  sshPublicKeys?: string[];
  /** Device hostname — sets the computer name, the .local name, and the SSH alias. */
  hostname?: string;
  /** Optional fixed IP so the device is always reachable at the same address. */
  staticIp?: StaticIp;
  /** Windows edition to install. Pro unlocks RDP host. Default home. */
  edition?: "home" | "pro";
  /** Enable Remote Desktop (only effective on Pro). */
  enableRdp?: boolean;
  account: { mode: "local" | "microsoft"; username?: string; password?: string };
  wifi?: { ssid: string; password: string };
  /** Catalog id of the ISO/display language — sets the download language AND the
   *  answer file's UI language from one choice so they can't disagree. */
  isoId?: string;
  /** Region/keyboard id from KEYBOARD_REGIONS. Omitted → default (New Zealand). */
  regionId?: string;
}

/** The build token baked into the most recent USB; matched against beacons so we
 *  know which discovered device is the one we just built. */
let lastBuildId = "";
/** Remembered from the last build so Verify can SSH in with no prompts: the local
 *  account name, the private key matching a chosen public key, and the hostname
 *  (for the `ssh <hostname>` alias). */
let lastBuildUsername = "";
let lastBuildIdentity = "";
let lastBuildHostname = "";

/** A valid Windows computer name from arbitrary input: alphanumeric + hyphen,
 *  <=15 chars. Empty if nothing usable. */
function sanitizeHostname(raw: string | undefined): string {
  return (raw ?? "")
    .trim()
    .replace(/[^A-Za-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 15);
}

/** Write/replace a delimited bootible-managed Host block in ~/.ssh/config so
 *  `ssh <hostname>` needs no username, password, IP, or key path. Idempotent;
 *  never touches the user's other entries. */
function writeSshAlias(hostname: string, ip: string): void {
  const dir = sshDir();
  mkdirSync(dir, { recursive: true });
  const configPath = join(dir, "config");
  const begin = `# >>> bootible managed: ${hostname} >>>`;
  const end = `# <<< bootible managed: ${hostname} <<<`;
  // HostName uses the discovered IP (Verify just proved it works); a static IP
  // (G6) makes it permanent. User + key are baked in for prompt-free login.
  const block = [
    begin,
    `Host ${hostname}`,
    `  HostName ${ip}`,
    `  User ${lastBuildUsername || "ally"}`,
    ...(lastBuildIdentity ? [`  IdentityFile ${lastBuildIdentity}`, "  IdentitiesOnly yes"] : []),
    "  StrictHostKeyChecking accept-new",
    end,
  ].join("\n");
  let existing = "";
  try {
    existing = readFileSync(configPath, "utf8");
  } catch {}
  // Drop any prior bootible block for this hostname, then append the fresh one.
  const stripped = existing
    .replace(new RegExp(`${begin}[\\s\\S]*?${end}\\n?`, "g"), "")
    .replace(/\n+$/, "");
  const next = stripped ? `${stripped}\n\n${block}\n` : `${block}\n`;
  writeFileSync(configPath, next, "utf8");
}

/** The private-key path on this machine matching one of the chosen public keys
 *  (so Verify can authenticate), or "" to let ssh use its default identities. */
function identityForKeys(keys: string[]): string {
  if (keys.length === 0) return "";
  const hostKeys = getHostSshKeys();
  for (const k of keys) {
    const match = hostKeys.find((h) => h.publicKey.trim() === k.trim());
    if (match?.id.endsWith(".pub")) {
      const priv = join(sshDir(), match.id.slice(0, -4));
      if (existsSync(priv)) return priv;
    }
  }
  return "";
}

/** Verify a discovered device over SSH (key auth, no prompts): read its status
 *  + receipt to confirm the configure ran. Returns the raw output, or the error
 *  if unreachable. */
function verifyDevice(ip: string): { reachable: boolean; output: string; alias?: string } {
  const target = `${lastBuildUsername || "ally"}@${ip}`;
  // cmd-friendly remote command — no nested quoting through ssh -> cmd.
  const remote =
    "type C:\\bootible\\status.txt 2>nul & echo. & type C:\\bootible\\receipt.txt 2>nul";
  const args = [
    "-o",
    "BatchMode=yes",
    "-o",
    "StrictHostKeyChecking=accept-new",
    "-o",
    "ConnectTimeout=8",
    ...(lastBuildIdentity ? ["-i", lastBuildIdentity, "-o", "IdentitiesOnly=yes"] : []),
    target,
    remote,
  ];
  try {
    const output = execFileSync("ssh", args, { encoding: "utf8", timeout: 20000 });
    // Reachable → write the `ssh <hostname>` alias so the user can reach it
    // prompt-free from now on.
    let alias: string | undefined;
    if (lastBuildHostname) {
      try {
        writeSshAlias(lastBuildHostname, ip);
        alias = lastBuildHostname;
      } catch {}
    }
    return { reachable: true, output: output.trim(), alias };
  } catch (error) {
    const e = error as { stdout?: Buffer | string; stderr?: Buffer | string; message?: string };
    return {
      reachable: false,
      output: String(e.stderr ?? e.stdout ?? e.message ?? "connection failed").trim(),
    };
  }
}

// ── device discovery (the beacon listener) ───────────────────────────────────

export interface DiscoveredDevice {
  buildId: string;
  mac: string;
  ip: string;
  hostname: string;
  status: string;
  /** True when this is the device built by the most recent USB. */
  mine: boolean;
}

let beaconSocket: Socket | null = null;

/** Listen for device beacons on the LAN and stream each to the renderer. The
 *  device broadcasts {bootible, buildId, mac, ip, hostname, status}; we match
 *  buildId against the last build to flag "mine". */
function startDiscovery(sender: WebContents): void {
  if (beaconSocket) return;
  try {
    const sock = createSocket({ type: "udp4", reuseAddr: true });
    sock.on("message", (buf) => {
      try {
        const msg = JSON.parse(buf.toString("utf8")) as Record<string, unknown>;
        if (msg.bootible !== 1) return;
        const device: DiscoveredDevice = {
          buildId: String(msg.buildId ?? ""),
          mac: String(msg.mac ?? ""),
          ip: String(msg.ip ?? ""),
          hostname: String(msg.hostname ?? ""),
          status: String(msg.status ?? ""),
          mine: lastBuildId !== "" && msg.buildId === lastBuildId,
        };
        if (!sender.isDestroyed()) sender.send("beacon:device", device);
      } catch {
        // ignore non-JSON / unrelated UDP traffic
      }
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

function stopDiscovery(): void {
  if (beaconSocket) {
    try {
      beaconSocket.close();
    } catch {}
    beaconSocket = null;
  }
}

export interface StaticIp {
  ip: string;
  prefix?: number;
  gateway?: string;
  dns?: string;
}

/** This desktop's subnet, to pre-fill a sensible static IP for the device:
 *  prefix + gateway guess + the subnet prefix to type a host into. */
function suggestNetwork(): { prefix: number; gateway: string; subnet: string } | null {
  for (const list of Object.values(networkInterfaces())) {
    for (const ni of list ?? []) {
      if (ni.family === "IPv4" && !ni.internal && !ni.address.startsWith("169.254.")) {
        const prefix = ni.netmask
          .split(".")
          .reduce((n, oct) => n + ((Number(oct) >>> 0).toString(2).match(/1/g)?.length ?? 0), 0);
        const [a, b, c] = ni.address.split(".");
        return { prefix, gateway: `${a}.${b}.${c}.1`, subnet: `${a}.${b}.${c}.` };
      }
    }
  }
  return null;
}

/** The base + modifier choices that resolve to a final module set. */
type BuildChoice = {
  modules: string[];
  baseId?: string;
  sshPublicKeys?: string[];
  staticIp?: StaticIp;
  edition?: "home" | "pro";
  enableRdp?: boolean;
};

/** The non-empty, trimmed SSH public keys from a build choice. */
function chosenKeys(req: BuildChoice): string[] {
  return (req.sshPublicKeys ?? []).map((k) => k.trim()).filter((k) => k.length > 0);
}

/** The final module-id set for a build: the base's resolved floor (shell +
 *  software + universal tuning) unioned with the user's modifier picks, plus the
 *  ssh-key module when at least one key is supplied. */
function resolveModules(req: BuildChoice): string[] {
  const base = baseById(req.baseId);
  const ids = new Set<string>(base ? baseModuleIds(base) : []);
  for (const id of req.modules) ids.add(id);
  if (chosenKeys(req).length > 0) ids.add("ssh-key");
  if (req.staticIp?.ip) ids.add("static-ip");
  // RDP host only works on Pro, so only include it when both are chosen.
  if (req.edition === "pro" && req.enableRdp) ids.add("remote-desktop");
  return [...ids];
}

/** The settings bag, with the SSH keys and static IP folded in when provided. */
function buildSettings(req: BuildChoice): Record<string, unknown> {
  const settings: Record<string, unknown> = { ...RECOMMENDED_SETTINGS };
  const keys = chosenKeys(req);
  if (keys.length > 0) settings.ssh_public_keys = keys;
  if (req.staticIp?.ip) settings.static_ip = req.staticIp;
  return settings;
}

/** Assemble the USB bundle (autounattend + bootstrap + config + wifi) into a
 *  staging folder. Returns the path, or null if there's no device profile. */
function stageUsbBundle(req: UsbBuildRequest): string | null {
  const device = targetDevice();
  const profile = profileFor(device);
  if (!device || !profile) return null;

  const modules = resolveModules(req);
  const config = buildConfig({
    device: device.id,
    modules: modules.length ? modules : undefined,
    settings: buildSettings(req),
  });
  const account: AccountMode =
    req.account.mode === "local"
      ? { mode: "local", username: req.account.username || "ally", password: req.account.password }
      : { mode: "microsoft" };
  // The answer file's UI language is taken from the SAME catalog entry as the
  // ISO download, so the image and the autounattend always agree (no Setup
  // language prompt). Region/keyboard is an independent choice (default NZ).
  const isoOption = ISO_CATALOG.find((o) => o.id === req.isoId);
  const region = keyboardRegionById(req.regionId) ?? defaultKeyboardRegion();
  // A fresh build token, baked into the beacon, so the desktop recognises the
  // exact device it built when it announces itself on the LAN.
  lastBuildId = randomBytes(6).toString("hex");
  // Remember how to SSH in for Verify (local account name + matching private key)
  // and the hostname for the `ssh <hostname>` alias.
  lastBuildUsername = account.mode === "local" ? account.username || "ally" : "";
  lastBuildIdentity = identityForKeys(chosenKeys(req));
  lastBuildHostname = sanitizeHostname(req.hostname);
  const spec: UsbBuildSpec = {
    device,
    config,
    account,
    wifi: req.wifi,
    uiLanguage: isoOption?.uiLanguage,
    locale: region.locale,
    buildId: lastBuildId,
    computerName: lastBuildHostname || undefined,
    edition: req.edition === "pro" ? "Windows 11 Pro" : "Windows 11 Home",
  };

  const stagingPath = join(app.getPath("temp"), "bootible-usb-bundle");
  rmSync(stagingPath, { recursive: true, force: true });
  for (const file of buildUsbBundle(spec, profile.executor)) {
    const dest = join(stagingPath, file.path);
    mkdirSync(dirname(dest), { recursive: true });
    // .ps1 files get a UTF-8 BOM so the Ally's Windows PowerShell 5.1 reads any
    // non-ASCII (em-dashes in copy) correctly instead of as ANSI mojibake.
    const content = dest.endsWith(".ps1") ? "\uFEFF" + file.content : file.content;
    writeFileSync(dest, content, "utf8");
  }
  return stagingPath;
}

/**
 * Method A (manual fallback) — stage the bundle + drop prepare-usb.ps1 beside it
 * so the user can run it themselves. The in-app writer below is the main path.
 */
function buildUsb(req: UsbBuildRequest): { stagingPath: string; command: string } | null {
  const stagingPath = stageUsbBundle(req);
  if (!stagingPath) return null;
  copyFileSync(prepareUsbScript, join(stagingPath, "prepare-usb.ps1"));
  return {
    stagingPath,
    command: "Right-click prepare-usb.ps1 in this folder → Run as administrator.",
  };
}

export interface UsbWriteRequest extends UsbBuildRequest {
  diskNumber: number;
  /** A local ISO path (browse) instead of downloading the catalog isoId via Fido. */
  isoPath?: string;
}

/** Tail the writer's NDJSON progress file and stream each line to the renderer. */
function tailUsbProgress(sender: WebContents, file: string): void {
  let offset = 0;
  const timer = setInterval(() => {
    let content: string;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      return;
    }
    if (content.length <= offset) return;
    const fresh = content.slice(offset);
    offset = content.length;
    for (const line of fresh.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const event = JSON.parse(trimmed) as { pct: number; message: string; status: string };
        if (!sender.isDestroyed()) sender.send("usb:progress", event);
        if (event.status === "done" || event.status === "error") clearInterval(timer);
      } catch {
        // partial / non-JSON line; ignore
      }
    }
  }, 500);
  setTimeout(() => clearInterval(timer), 30 * 60 * 1000); // safety stop
}

/**
 * The in-app USB write: stage the bundle, then launch prepare-usb.ps1 elevated
 * (one UAC) and hidden, feeding a progress file the app tails. The disk + ISO
 * are chosen in-app and passed as args, so the writer never prompts.
 */
/** Single-quote a value for embedding in a PowerShell script literal. */
function psQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function writeUsb(sender: WebContents, req: UsbWriteRequest): { started: boolean } {
  const stagingPath = stageUsbBundle(req);
  if (!stagingPath) {
    sender.send("usb:progress", { pct: 0, status: "error", message: "No device to build for." });
    return { started: false };
  }

  const progressFile = join(app.getPath("temp"), "bootible-usb-progress.ndjson");
  writeFileSync(progressFile, "");

  // Build the writer call with values BAKED IN (PowerShell-quoted). Passing args
  // through `Start-Process -Verb RunAs -ArgumentList @(...)` flattens the array
  // with spaces and drops quoting — so a path or value with a space (e.g.
  // "English International") silently breaks parameter binding. A generated
  // runner script sidesteps that entirely: the only arg to the elevated shell is
  // a -File path (no spaces), and a try/catch writes any failure to the progress
  // file so a write never hangs silently.
  const callParts = [
    psQuote(prepareUsbScript),
    `-BundleDir ${psQuote(stagingPath)}`,
    `-DiskNumber ${req.diskNumber}`,
    "-Force",
    // The UI already took an explicit erase confirmation; skip the script's
    // ShouldProcess prompt (ConfirmImpact=High) so the hidden process doesn't
    // hang waiting for a "yes" it can never receive.
    "-Confirm:$false",
    `-ProgressFile ${psQuote(progressFile)}`,
  ];
  if (req.isoPath) {
    callParts.push(`-IsoPath ${psQuote(req.isoPath)}`);
  } else if (req.isoId) {
    const option = ISO_CATALOG.find((c) => c.id === req.isoId);
    if (option) {
      callParts.push(
        `-IsoRel ${psQuote(option.rel)} -IsoEd ${psQuote(option.ed)} -IsoLang ${psQuote(option.lang)} -IsoArch ${psQuote(option.arch)}`,
      );
    }
  }

  const runner = [
    "$ErrorActionPreference = 'Stop'",
    "try {",
    `  & ${callParts.join(" ")}`,
    "} catch {",
    "  $msg = @{ pct = 0; message = $_.Exception.Message; status = 'error' } | ConvertTo-Json -Compress",
    `  [System.IO.File]::AppendAllText(${psQuote(progressFile)}, $msg + [Environment]::NewLine)`,
    "}",
  ].join("\r\n");
  const runnerPath = join(app.getPath("temp"), "bootible-usb-run.ps1");
  writeFileSync(runnerPath, `\uFEFF${runner}`, "utf8");

  // Launch the runner elevated (one UAC) + hidden. Only one arg crosses the
  // RunAs boundary — a -File path in %TEMP% (no spaces).
  const launcher = `Start-Process -FilePath 'powershell' -Verb RunAs -WindowStyle Hidden -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File "${runnerPath}"'`;
  spawn("powershell", ["-NoProfile", "-NonInteractive", "-Command", launcher], {
    windowsHide: true,
  });

  tailUsbProgress(sender, progressFile);
  return { started: true };
}

// ── in-app USB writer: disks + ISO source ───────────────────────────────────

export interface UsbDisk {
  number: number;
  name: string;
  sizeGb: number;
  letters: string;
  label: string;
}

export interface IsoOption {
  id: string;
  label: string;
}

/** Run a PowerShell snippet and return stdout (non-elevated, no window). */
function runPwsh(script: string): string {
  return execFileSync(
    "powershell",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
    { encoding: "utf8", windowsHide: true },
  );
}

/** Removable USB disks with their drive letters + volume label, so the picker
 *  matches what the user sees in Explorer (listing needs no admin). */
function listUsbDisks(): UsbDisk[] {
  try {
    const script = `Get-Disk | Where-Object BusType -eq 'USB' | ForEach-Object { $d = $_; $vols = Get-Partition -DiskNumber $d.Number -ErrorAction SilentlyContinue | Get-Volume -ErrorAction SilentlyContinue | Where-Object { $_.DriveLetter }; [pscustomobject]@{ Number = $d.Number; Model = $d.FriendlyName; Size = $d.Size; Letters = (($vols | ForEach-Object { "$($_.DriveLetter):" }) -join ' '); Label = (($vols | Where-Object { $_.FileSystemLabel } | Select-Object -First 1).FileSystemLabel) } } | ConvertTo-Json -Compress`;
    const out = runPwsh(script).trim();
    if (!out) return [];
    const parsed = JSON.parse(out);
    const rows: Array<{
      Number: number;
      Model?: string;
      Size: number;
      Letters?: string;
      Label?: string;
    }> = Array.isArray(parsed) ? parsed : [parsed];
    return rows.map((r) => ({
      number: r.Number,
      name: (r.Model ?? "USB disk").trim(),
      sizeGb: Math.round((r.Size / 1024 ** 3) * 10) / 10,
      letters: r.Letters ?? "",
      label: r.Label ?? "",
    }));
  } catch {
    return [];
  }
}

// The Rufus-style ISO dropdown, derived from the display-language catalog so the
// download language and the answer-file UI language are one and the same choice
// (no mismatch → no Windows Setup language prompt). Fido resolves the real
// Microsoft URL from rel/ed/lang/arch at download time; -Rel "Latest" is the
// only release it serves (older versions like 24H2 are rejected), so for a
// specific version the user browses to a local ISO instead.
const ISO_CATALOG = DISPLAY_LANGUAGES.map((l) => ({
  id: `win11-latest-${l.id}`,
  label: `Windows 11 (latest) — ${l.label} (x64)`,
  rel: "Latest",
  ed: "Home/Pro",
  lang: l.fidoLang,
  arch: "x64",
  uiLanguage: l.uiLanguage,
}));

function getIsoCatalog(): IsoOption[] {
  return ISO_CATALOG.map((o) => ({ id: o.id, label: o.label }));
}

/** Let the user pick a local Windows ISO. Returns the path, or null. */
async function browseIso(win: BrowserWindow): Promise<string | null> {
  const result = await dialog.showOpenDialog(win, {
    title: "Choose a Windows 11 ISO",
    properties: ["openFile"],
    filters: [{ name: "ISO", extensions: ["iso"] }],
  });
  return result.canceled || !result.filePaths[0] ? null : result.filePaths[0];
}

/**
 * Method C — apply the config live on THIS device. Hard-blocked unless the
 * machine matches a device whitelist, then confirmed, then run as an elevated
 * bootstrap (restore points + modules) in its own window. Never touches a
 * machine that isn't a recognised handheld.
 */
async function applyDevice(
  win: BrowserWindow,
  req: UsbBuildRequest,
): Promise<{ status: "blocked" | "cancelled" | "launched" }> {
  const device = loadDeviceEntry();
  const profile = profileFor(device);
  if (!device || !profile) return { status: "blocked" };

  const confirm = await dialog.showMessageBox(win, {
    type: "warning",
    buttons: ["Cancel", "Apply now"],
    defaultId: 0,
    cancelId: 0,
    title: "Apply bootible config",
    message: `Reconfigure this ${device.name}?`,
    detail:
      "bootible will take a 'Fresh Windows' restore point, then apply the selected modules (power, registry tweaks, services, app installs), then a 'configured' restore point. An elevated PowerShell window opens to run it.",
  });
  if (confirm.response !== 1) return { status: "cancelled" };

  // Same base+modifier resolution as the USB path, so every approach ends with
  // the device set identically.
  const modules = resolveModules(req);
  const config = buildConfig({
    device: device.id,
    modules: modules.length ? modules : undefined,
    settings: buildSettings(req),
  });
  const script = generateBootstrapScript({ device, config, executorFactory: profile.executor });
  const dir = join(app.getPath("temp"), "bootible-apply");
  mkdirSync(dir, { recursive: true });
  const scriptPath = join(dir, "bootstrap.ps1");
  writeFileSync(scriptPath, script, "utf8");

  // Launch elevated (UAC) in its own window so the user sees the live work.
  spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `Start-Process powershell -Verb RunAs -ArgumentList '-NoExit','-ExecutionPolicy','Bypass','-File','${scriptPath}'`,
    ],
    { detached: true, stdio: "ignore" },
  ).unref();

  return { status: "launched" };
}

// bootible's recommended Ally settings — what a default setup would apply.
const RECOMMENDED_SETTINGS = {
  sleep_mode: "hibernate",
  hibernate_after_minutes: 30,
  power_button_action: "sleep",
  disable_cpu_boost_on_battery: true,
};

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run a DRY provision: the executor computes real commands but a no-op runner
 * records them instead of touching the machine. Step events are streamed to
 * the renderer (paced for a live feel) so the log reflects the real module
 * sequence and honest per-module status. Nothing is written to the device.
 */
async function provision(sender: WebContents): Promise<{ applied: number; skipped: number }> {
  const device = loadDeviceEntry();
  const profile = profileFor(device);
  if (!device || !profile) {
    sender.send("provision:done", { applied: 0, skipped: 0 });
    return { applied: 0, skipped: 0 };
  }

  const config = { schema: 2 as const, device: device.id, settings: RECOMMENDED_SETTINGS };
  const dryRun: Exec = () => ""; // record nothing, execute nothing

  const queue: StepEvent[] = [];
  profile.executor(dryRun).apply({ device, config }, (event) => queue.push(event));

  let applied = 0;
  let skipped = 0;
  for (const event of queue) {
    if (sender.isDestroyed()) break;
    sender.send("provision:step", event);
    if (event.status === "running") {
      await delay(260);
    } else {
      if (event.status === "applied") applied += 1;
      if (event.status === "skipped") skipped += 1;
      await delay(110);
    }
  }

  if (!sender.isDestroyed()) sender.send("provision:done", { applied, skipped });
  return { applied, skipped };
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1040,
    height: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#0b0d12",
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      sandbox: false,
    },
  });

  win.on("ready-to-show", () => win.show());

  // BOOTIBLE_VIEW deep-links a starting screen (used for dev screenshots).
  const hash = process.env.BOOTIBLE_VIEW;
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) {
    win.loadURL(hash ? `${devUrl}#${hash}` : devUrl);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"), hash ? { hash } : undefined);
  }
}

app.whenReady().then(() => {
  ipcMain.handle("device:get", () => getDevice());
  ipcMain.handle("device:state", () => getDeviceState());
  ipcMain.handle("platforms:get", () => getPlatforms());
  ipcMain.handle("devices:list", (_event, platformId: string) => getDevices(platformId));
  ipcMain.handle("device:select", (_event, id: string) => selectDeviceById(id));
  ipcMain.handle("catalog:get", () => getCatalog());
  ipcMain.handle("bundles:get", () => getBundles());
  ipcMain.handle("bases:get", () => getBases());
  ipcMain.handle("ssh:host-keys", () => getHostSshKeys());
  ipcMain.handle("ssh:generate-key", (_event, comment: string) => generateHostSshKey(comment));
  ipcMain.handle("discovery:start", (event) => startDiscovery(event.sender));
  ipcMain.handle("discovery:stop", () => stopDiscovery());
  ipcMain.handle("device:verify", (_event, ip: string) => verifyDevice(ip));
  ipcMain.handle("network:suggest", () => suggestNetwork());
  ipcMain.handle("host:install-streaming", () => installHostStreaming());
  ipcMain.handle("methods:get", () => getMethods());
  ipcMain.handle("provision:run", (event) => provision(event.sender));
  ipcMain.handle("config:export", (event, req: BuildChoice) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win ? exportConfig(win, req ?? { modules: [] }) : null;
  });
  ipcMain.handle("usb:build", (_event, req: UsbBuildRequest) => buildUsb(req));
  ipcMain.handle("usb:write", (event, req: UsbWriteRequest) => writeUsb(event.sender, req));
  ipcMain.handle("usb:disks", () => listUsbDisks());
  ipcMain.handle("iso:catalog", () => getIsoCatalog());
  ipcMain.handle("languages:get", () =>
    DISPLAY_LANGUAGES.map((l) => ({ id: l.id, label: l.label, isoId: `win11-latest-${l.id}` })),
  );
  ipcMain.handle("regions:get", () => KEYBOARD_REGIONS.map((r) => ({ id: r.id, label: r.label })));
  ipcMain.handle("iso:browse", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win ? browseIso(win) : null;
  });
  ipcMain.handle("shell:open", (_event, path: string) => shell.openPath(path));
  ipcMain.handle("device:apply", (event, req: UsbBuildRequest) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win ? applyDevice(win, req) : { status: "blocked" };
  });
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
