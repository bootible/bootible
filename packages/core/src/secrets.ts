export interface SecretProvider {
  resolve(key: string): string;
}

/** Run a command and return its stdout. Injected so providers are testable. */
export type Exec = (command: string[]) => string;

const PREFIX = "secret://";

export function isSecretRef(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function parseSecretRef(value: string): string {
  return value.slice(PREFIX.length);
}

export function onePasswordProvider(exec: Exec): SecretProvider {
  return { resolve: (key) => exec(["op", "read", key]).trim() };
}

export function bitwardenProvider(exec: Exec): SecretProvider {
  return { resolve: (key) => exec(["bw", "get", "password", key]).trim() };
}

/**
 * Recursively replace every `secret://` string in `value` with the provider's
 * resolved secret. Non-secret values pass through; the input is not mutated.
 */
export function resolveSecrets<T>(value: T, provider: SecretProvider): T {
  if (isSecretRef(value)) {
    return provider.resolve(parseSecretRef(value)) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolveSecrets(v, provider)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = resolveSecrets(v, provider);
    }
    return out as T;
  }
  return value;
}
