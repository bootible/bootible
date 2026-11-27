import { execFileSync } from "node:child_process";
import { networkInterfaces } from "node:os";
import type { SystemInfo } from "@bootible/core";

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
export function getSystemInfo(): SystemInfo {
  return {
    platform: process.platform,
    manufacturer: regBios("SystemManufacturer"),
    model: regBios("SystemProductName"),
  };
}

/** This desktop's subnet, to pre-fill a sensible static IP for the device:
 *  prefix + gateway guess + the subnet prefix to type a host into. Picks the real
 *  LAN adapter — NOT Tailscale/CGNAT (100.64.0.0/10, a /32 that produced the
 *  nonsense "prefix 32, gateway 100.x.x.1" pre-fill) or other virtual adapters. */
export function suggestNetwork(): { prefix: number; gateway: string; subnet: string } | null {
  const maskToPrefix = (m: string): number =>
    m
      .split(".")
      .reduce((n, oct) => n + ((Number(oct) >>> 0).toString(2).match(/1/g)?.length ?? 0), 0);
  const isCgnat = (ip: string): boolean => {
    const [a, b] = ip.split(".").map(Number);
    const bb = b ?? 0;
    return a === 100 && bb >= 64 && bb <= 127; // 100.64.0.0/10 — Tailscale / carrier-grade NAT
  };
  const isPrivateLan = (ip: string): boolean => {
    const [a, b] = ip.split(".").map(Number);
    const bb = b ?? 0;
    return a === 192 && bb === 168 ? true : a === 10 ? true : a === 172 && bb >= 16 && bb <= 31;
  };
  const isVirtualName = (name: string): boolean =>
    /tailscale|vethernet|vmware|virtualbox|hyper-v|zerotier|wsl|wg-|wireguard|loopback|docker/i.test(
      name,
    );

  const candidates: { ip: string; prefix: number; priv: boolean }[] = [];
  for (const [name, list] of Object.entries(networkInterfaces())) {
    if (isVirtualName(name)) continue;
    for (const ni of list ?? []) {
      if (ni.family !== "IPv4" || ni.internal) continue;
      if (ni.address.startsWith("169.254.") || isCgnat(ni.address)) continue;
      const prefix = maskToPrefix(ni.netmask);
      if (prefix < 8 || prefix > 30) continue; // /31,/32 aren't a usable LAN subnet
      candidates.push({ ip: ni.address, prefix, priv: isPrivateLan(ni.address) });
    }
  }
  // Prefer a genuine private-LAN adapter; fall back to any remaining candidate.
  const pick = candidates.find((c) => c.priv) ?? candidates[0];
  if (!pick) return null;
  const [a, b, c] = pick.ip.split(".");
  return { prefix: pick.prefix, gateway: `${a}.${b}.${c}.1`, subnet: `${a}.${b}.${c}.` };
}
