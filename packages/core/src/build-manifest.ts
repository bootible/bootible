import { parse as parseYaml } from "yaml";
import { type BootibleConfig, withoutSecrets } from "./config";
import { type DeckConfig, normalizeDeckConfig } from "./deck-config";

/**
 * The build manifest: what a device saves about how it was provisioned, so the
 * desktop app can later verify the device against it (deck-verify.ts /
 * windows-verify.ts). It holds no secrets — passwords are dropped before it is
 * written — so it is safe to leave on the device and read back over SSH.
 *
 *   Deck:    ~/.bootible/build.json
 *   Windows: C:\bootible\build.json
 */

/** Printed on its own line before the manifest in a probe's output. */
export const MANIFEST_MARKER = "BOOTIBLE-MANIFEST";

/** Remote command (the device's login shell: bash on a Deck, cmd on Windows)
 *  that prints the manifest. Devices provisioned before manifests existed fall
 *  back to the config they were built from, tagged so it can be told apart:
 *  the Deck's config.json if its BOOTIBLE stick is still mounted, or the
 *  config.yml the Windows USB left in C:\bootible. */
export function manifestProbe(os: "windows" | "linux"): string {
  return os === "linux"
    ? `if [ -f ~/.bootible/build.json ]; then cat ~/.bootible/build.json; else for f in /run/media/*/BOOTIBLE/bootible/config.json; do [ -f "$f" ] && { printf 'DECKCFG '; cat "$f"; break; }; done; fi`
    : windowsCommand(WIN_MANIFEST_PS);
}

const WIN_MANIFEST_PS =
  "if (Test-Path C:\\bootible\\build.json) { Get-Content -Raw C:\\bootible\\build.json } elseif (Test-Path C:\\bootible\\config.yml) { 'CONFIGYML'; Get-Content -Raw C:\\bootible\\config.yml }";

/** Wrap PowerShell code as a command line that runs the same whichever login
 *  shell Windows OpenSSH gives us: cmd (the default) or PowerShell (bootible v1
 *  and many setups set DefaultShell to it). Both pass a double-quoted argument
 *  through untouched as long as it holds no `"` and no `$` (PowerShell would
 *  expand it), so the code must avoid both. */
export function windowsCommand(psCode: string): string {
  if (/["$`]/.test(psCode)) throw new Error('windowsCommand: code must not contain " $ or `');
  return `powershell -NoProfile -NonInteractive -Command "${psCode}"`;
}

/** The Windows Verify probe: `receiptPs` first, then the marker and the manifest. */
export function windowsProbeCommand(receiptPs: string): string {
  return windowsCommand(`${receiptPs}; '${MANIFEST_MARKER}'; ${WIN_MANIFEST_PS}`);
}

/** Read what manifestProbe printed: a manifest, or a legacy config turned into one. */
export function readProbedManifest(text: string): BuildManifest | null {
  const t = text.replace(/^\uFEFF/, "").trim();
  if (t.startsWith("DECKCFG ")) {
    try {
      return JSON.parse(deckManifestJson(JSON.parse(t.slice(8)) as Partial<DeckConfig>));
    } catch {
      return null;
    }
  }
  if (t.startsWith("CONFIGYML")) {
    try {
      const config = parseYaml(t.slice(9)) as BootibleConfig;
      if (!config || typeof config !== "object") return null;
      return JSON.parse(windowsManifestJson({ schema: 1, os: "windows", path: "usb", config }));
    } catch {
      return null;
    }
  }
  return parseBuildManifest(t);
}

/** What a Windows device saves as C:\bootible\build.json. */
export interface WindowsBuildManifest {
  schema: 1;
  os: "windows";
  /** How it was provisioned: clean-install USB, the Full ROG strip kit, or
   *  "Run on this device". */
  path: "usb" | "strip" | "apply";
  buildId?: string;
  /** Only the USB path sets the computer name. */
  hostname?: string;
  account?: { mode: "local" | "microsoft"; username?: string };
  edition?: "home" | "pro";
  locale?: string;
  uiLanguage?: string;
  timeZone?: string;
  /** The resolved config the scripts were generated from (secrets removed). */
  config: BootibleConfig;
}

/** What a Steam Deck saves as ~/.bootible/build.json. */
export interface DeckBuildManifest {
  schema: 1;
  os: "linux";
  /** The normalized Deck config (Sunshine password removed). */
  deck: DeckConfig;
}

export type BuildManifest = WindowsBuildManifest | DeckBuildManifest;

export function windowsManifestJson(m: WindowsBuildManifest): string {
  return JSON.stringify({
    ...m,
    config: { ...m.config, settings: withoutSecrets(m.config).settings ?? {} },
  });
}

export function deckManifestJson(input: Partial<DeckConfig>): string {
  const deck = normalizeDeckConfig(input);
  const { pass: _dropped, ...sunshine } = deck.sunshine;
  const manifest: DeckBuildManifest = { schema: 1, os: "linux", deck: { ...deck, sunshine } };
  return JSON.stringify(manifest);
}

/** Map the edition string the app assembles ("Windows 11 Pro") to the manifest's. */
export function manifestEdition(edition?: string): "home" | "pro" | undefined {
  if (!edition) return undefined;
  return /pro|enterprise|education/i.test(edition) ? "pro" : "home";
}

/** Parse a manifest read back from a device; null when it isn't one. */
export function parseBuildManifest(text: string): BuildManifest | null {
  let v: unknown;
  try {
    v = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
  if (!v || typeof v !== "object") return null;
  const m = v as Record<string, unknown>;
  if (m.schema !== 1) return null;
  if (m.os === "linux" && m.deck && typeof m.deck === "object")
    return m as unknown as DeckBuildManifest;
  if (m.os === "windows" && m.config && typeof m.config === "object")
    return m as unknown as WindowsBuildManifest;
  return null;
}

/** Quote a value as a PowerShell string literal that is always pure ASCII.
 *  Windows PowerShell reads a BOM-less script as the ANSI code page, and it
 *  treats curly quotes as real quote characters, so a raw non-ASCII value
 *  could end the literal early. ASCII values get a plain '...' literal;
 *  anything else is spelled out char by char inside "...". */
export function psq(value: string): string {
  if (/^[\x20-\x7e]*$/.test(value)) return `'${value.replace(/'/g, "''")}'`;
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) as number;
    if (code >= 0x20 && code <= 0x7e) out += /[`$"]/.test(ch) ? `\`${ch}` : ch;
    else if (code > 0xffff) out += `$([char]::ConvertFromUtf32(0x${code.toString(16)}))`;
    else out += `$([char]0x${code.toString(16)})`;
  }
  return `"${out}"`;
}

/** A PowerShell statement that saves the manifest under `rootExpr` (e.g. "$Root"). */
export function writeWindowsManifestPs(m: WindowsBuildManifest, rootExpr: string): string {
  return `[IO.File]::WriteAllText("${rootExpr}\\build.json", ${psq(windowsManifestJson(m))})`;
}
