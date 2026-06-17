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
