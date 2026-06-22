import { type AccountMode, generateAutounattend, generateWifiProfileXml } from "./autounattend";
import { generateBootstrapScript } from "./bootstrap";
import { type BootibleConfig, serializeConfig } from "./config";
import type { Executor } from "./orchestrator";
import type { DeviceEntry } from "./registry";
import type { Exec } from "./secrets";

// Where the payload lands on the installed system, and the matching USB
// staging paths. $OEM$/$1 -> the system drive root (C:\); $OEM$/$$ -> %WINDIR%
// (C:\Windows). Windows Setup copies these during install.
const BOOTSTRAP_ON_DEVICE = "C:\\bootible\\bootstrap.ps1";
const FIRST_LOGON_COMMAND = `powershell.exe -ExecutionPolicy Bypass -File ${BOOTSTRAP_ON_DEVICE}`;

export interface UsbBuildSpec {
  device: DeviceEntry;
  config: BootibleConfig;
  account: AccountMode;
  wifi?: { ssid: string; password: string };
  computerName?: string;
  /** Windows display language — MUST match the UI language of the ISO being
   *  installed (see languages.ts). Omitted → autounattend default (en-GB). */
  uiLanguage?: string;
  /** Region/keyboard BCP-47 locale. Omitted → autounattend default (en-NZ). */
  locale?: string;
}

/** A file to write onto the USB, by path relative to the USB root. */
export interface BundleFile {
  path: string;
  content: string;
}

function readme(spec: UsbBuildSpec): string {
  const accountLine =
    spec.account.mode === "local"
      ? "Account: local (full zero-touch — no sign-in prompts)."
      : "Account: Microsoft (OOBE pauses once for your sign-in, everything else is automatic).";
  return `bootible USB — ${spec.device.name}

What this does:
  Boot the device from this USB to wipe it, install Windows unattended, and
  configure it automatically. Nothing else to click.

  ${accountLine}
  ${spec.wifi ? `WiFi: pre-seeded for "${spec.wifi.ssid}".` : "WiFi: none pre-seeded."}

Before you boot:
  prepare-usb.ps1 must have fetched the Windows ISO and the MediaTek MT7922
  WiFi driver onto this stick (the driver is not in the stock ISO). Without
  the driver the device has no network during setup.

Roll back any time:
  Restore point "Fresh Windows (pre-bootible)" is taken before config, and
  "bootible configured" after. Your config.yml is saved to C:\\bootible.
`;
}

/**
 * Assemble every generated file that goes on the bootible USB, with each path
 * matching where Windows Setup will place it (so the autounattend's references
 * resolve on the installed system). The Windows ISO and the MT7922 driver are
 * fetched separately by prepare-usb.ps1 — they aren't generated content.
 */
export function buildUsbBundle(
  spec: UsbBuildSpec,
  executorFactory: (exec: Exec) => Executor,
): BundleFile[] {
  const autounattend = generateAutounattend({
    computerName: spec.computerName,
    account: spec.account,
    wifi: spec.wifi,
    uiLanguage: spec.uiLanguage,
    locale: spec.locale,
    firstLogonCommand: FIRST_LOGON_COMMAND,
  });
  const bootstrap = generateBootstrapScript({
    device: spec.device,
    config: spec.config,
    executorFactory,
  });

  const files: BundleFile[] = [
    { path: "autounattend.xml", content: autounattend },
    { path: "sources/$OEM$/$1/bootible/bootstrap.ps1", content: bootstrap },
    { path: "sources/$OEM$/$1/bootible/config.yml", content: serializeConfig(spec.config) },
    { path: "bootible-README.txt", content: readme(spec) },
  ];

  if (spec.wifi) {
    files.push({
      path: "sources/$OEM$/$$/Setup/Files/wifi.xml",
      content: generateWifiProfileXml(spec.wifi.ssid, spec.wifi.password),
    });
  }

  return files;
}
