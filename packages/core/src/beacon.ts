// The device beacon — how a freshly-built device announces itself on the LAN so
// the desktop can discover it without an IP hunt. The device broadcasts a small
// UDP datagram every few seconds; the desktop listens on the same port and
// matches the buildId it baked into this USB. See docs/v2/design-headless-provisioning.md.

import type { DiscoveredDevice } from "./app-ipc";

/** The fixed UDP port the device broadcasts on and the desktop listens on. */
export const BEACON_PORT = 50474;

export interface BeaconOptions {
  /** The build token baked into this USB; the desktop matches it to recognise
   *  the exact device it built (vs just any bootible device). */
  buildId: string;
  /** Override the broadcast port (defaults to BEACON_PORT). */
  port?: number;
}

/** The shape of the JSON the device broadcasts (and the desktop parses). */
export interface BeaconMessage {
  /** Marker so the listener can ignore unrelated UDP traffic. */
  bootible: 1;
  buildId: string;
  mac: string;
  ip: string;
  hostname: string;
  /** The device's account name, so the desktop can SSH in as the right user
   *  (Full ROG keeps the OOBE account — bootible doesn't otherwise know it). */
  username: string;
  /** "installing" | "configuring" | "done" — drives the desktop's live view. */
  status: string;
}

/**
 * Generate the device-side beacon: a self-contained PowerShell script that
 * UDP-broadcasts {buildId, mac, ip, hostname, status} on the LAN every few
 * seconds. `status` is read from C:\bootible\status.txt (the bootstrap writes
 * "configuring" then "done"); absent -> "installing". ASCII-only so Windows
 * PowerShell 5.1 parses it correctly even without a BOM.
 */
export function generateBeaconScript(opts: BeaconOptions): string {
  const port = opts.port ?? BEACON_PORT;
  const buildId = opts.buildId.replace(/'/g, "''");
  return `# bootible beacon -- broadcasts this device's identity on the LAN so the
# desktop can discover it (no IP hunting). Generated, self-contained.
$ErrorActionPreference = 'SilentlyContinue'
$buildId = '${buildId}'
$port = ${port}
$statusFile = "$env:SystemDrive\\bootible\\status.txt"
while ($true) {
  try {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1).IPAddress
    $mac = (Get-NetAdapter -Physical | Where-Object { $_.Status -eq 'Up' } | Select-Object -First 1).MacAddress
    $status = if (Test-Path $statusFile) { (Get-Content $statusFile -Raw).Trim() } else { 'installing' }
    $payload = @{ bootible = 1; buildId = $buildId; mac = $mac; ip = $ip; hostname = $env:COMPUTERNAME; username = $env:USERNAME; status = $status } | ConvertTo-Json -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
    $udp = New-Object System.Net.Sockets.UdpClient
    $udp.EnableBroadcast = $true
    $endpoint = New-Object System.Net.IPEndPoint ([System.Net.IPAddress]::Broadcast), $port
    [void]$udp.Send($bytes, $bytes.Length, $endpoint)
    $udp.Close()
  } catch {}
  Start-Sleep -Seconds 5
}
`;
}

/**
 * Parse a raw UDP datagram from the device beacon into a DiscoveredDevice, or
 * null when it isn't one (non-JSON, unrelated LAN traffic, or missing the
 * `bootible` marker). `myBuildId` is the desktop's own most recent build
 * token; `mine` is set when the beacon's buildId matches it.
 */
export function parseBeacon(buf: Buffer, myBuildId: string): DiscoveredDevice | null {
  let msg: Record<string, unknown>;
  try {
    msg = JSON.parse(buf.toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (msg.bootible !== 1) return null;
  return {
    buildId: String(msg.buildId ?? ""),
    mac: String(msg.mac ?? ""),
    ip: String(msg.ip ?? ""),
    hostname: String(msg.hostname ?? ""),
    username: String(msg.username ?? ""),
    status: String(msg.status ?? ""),
    mine: myBuildId !== "" && msg.buildId === myBuildId,
  };
}
