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

const OCTET = "(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)"; // 0–255, no leading-zero triples
export const IPV4 = new RegExp(`^${OCTET}(\\.${OCTET}){3}$`);

/**
 * Validate + complete a (possibly partial) static-IP entry. Returns undefined if
 * the address is missing or not IPv4, so a bad entry simply skips the network step
 * rather than producing a broken command. iface defaults to wifi, prefix to 24;
 * gateway/dns are kept only when they're valid IPv4.
 */
export interface StaticIpErrors {
  ip?: string;
  prefix?: string;
  gateway?: string;
  dns?: string;
}

export type StaticIpValidation =
  | { ok: true; value: StaticIp }
  | { ok: false; errors: StaticIpErrors };

/**
 * Validate a static-IP entry and report per-field errors — for UI (e.g. the
 * NetworkSettings component) where a user mistake must be shown, not silently
 * dropped. (normalizeStaticIp is the drop-invalid variant for script generators.)
 */
export function validateStaticIp(input: Partial<StaticIp> | undefined): StaticIpValidation {
  const i = input ?? {};
  const errors: StaticIpErrors = {};

  const ip = (i.ip ?? "").trim();
  if (!ip) errors.ip = "Enter an IPv4 address.";
  else if (!IPV4.test(ip)) errors.ip = `"${ip}" isn't a valid IPv4 address.`;

  const prefix = i.prefix ?? 24;
  if (!Number.isInteger(prefix) || prefix < 1 || prefix > 32)
    errors.prefix = "Prefix must be between 1 and 32.";

  const gateway = i.gateway?.trim();
  if (gateway && !IPV4.test(gateway)) errors.gateway = `"${gateway}" isn't a valid IPv4 address.`;

  const dnsParts = (i.dns ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
  const badDns = dnsParts.filter((d) => !IPV4.test(d));
  if (badDns.length) errors.dns = `Not a valid IPv4 address: ${badDns.join(", ")}.`;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      iface: i.iface === "ethernet" ? "ethernet" : "wifi",
      ip,
      prefix,
      gateway: gateway || undefined,
      dns: dnsParts.length ? dnsParts.join(",") : undefined,
    },
  };
}

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
