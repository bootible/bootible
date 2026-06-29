/**
 * The one static-IP shape + validator shared by every platform (Steam Deck via
 * nmcli, ROG/Windows via New-NetIPAddress) and every layer (config, provision,
 * modules, the app's IPC). Generators consume the normalized result, so the
 * IPv4/prefix rules — and the "drop an invalid entry rather than emit a broken or
 * injectable command" guarantee — live in exactly one place.
 */
export interface StaticIp {
  /** Which link to pin — the built-in Wi-Fi or a (docked) Ethernet link. */
  iface: "wifi" | "ethernet";
  /** IPv4 address, e.g. 192.168.1.50. */
  ip: string;
  /** CIDR prefix length (1–32); 24 for a typical /24 network. */
  prefix: number;
  gateway?: string;
  /** Comma-separated DNS servers, e.g. "1.1.1.1,8.8.8.8". */
  dns?: string;
}

export const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Validate + complete a (possibly partial) static-IP entry. Returns undefined if
 * the address is missing or not IPv4, so a bad entry simply skips the network step
 * rather than producing a broken command. iface defaults to wifi, prefix to 24;
 * gateway/dns are kept only when they're valid IPv4.
 */
export function normalizeStaticIp(s: Partial<StaticIp> | undefined): StaticIp | undefined {
  if (!s || !IPV4.test((s.ip ?? "").trim())) return undefined;
  const prefix = Math.min(32, Math.max(1, Math.round(s.prefix || 24)));
  const gateway = s.gateway?.trim();
  const dns = (s.dns ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter((d) => IPV4.test(d))
    .join(",");
  return {
    iface: s.iface === "ethernet" ? "ethernet" : "wifi",
    ip: s.ip?.trim() ?? "",
    prefix,
    gateway: gateway && IPV4.test(gateway) ? gateway : undefined,
    dns: dns || undefined,
  };
}
