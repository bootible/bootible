const SCHEMA_HEADER = /^#\s*yaml-language-server:\s*\$schema=(\S+)/m;

/**
 * Extract the schema URL from a YAML document's
 * `# yaml-language-server: $schema=<url>` header, or null if absent.
 */
export function findSchemaUrl(yaml: string): string | null {
  return yaml.match(SCHEMA_HEADER)?.[1] ?? null;
}
