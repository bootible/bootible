import Ajv from "ajv";
import { parse as parseYaml } from "yaml";

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Parse a YAML document and validate it against a JSON Schema.
 * Returns the validity and a list of human-readable error messages.
 */
export function validateYamlAgainstSchema(
  yamlText: string,
  schema: object,
): SchemaValidationResult {
  const data = parseYaml(yamlText);
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schema);
  const valid = validate(data) === true;
  const errors = valid
    ? []
    : (validate.errors ?? []).map((e) =>
        `${e.instancePath || "/"} ${e.message ?? "is invalid"}`.trim(),
      );
  return { valid, errors };
}

/**
 * Validate a YAML document against a schema and return it parsed and typed.
 * Throws with the validation errors (prefixed by `label`) if invalid.
 */
export function parseValidatedYaml<T>(yamlText: string, schema: object, label = "document"): T {
  const { valid, errors } = validateYamlAgainstSchema(yamlText, schema);
  if (!valid) {
    throw new Error(`invalid ${label}:\n  ${errors.join("\n  ")}`);
  }
  return parseYaml(yamlText) as T;
}
