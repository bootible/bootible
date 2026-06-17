import { describe, expect, it } from "vitest";
import { validateYamlAgainstSchema } from "./validate-schema";

const schema = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "string" } },
  additionalProperties: true,
};

describe("validateYamlAgainstSchema", () => {
  it("accepts YAML that satisfies the schema", () => {
    const result = validateYamlAgainstSchema("id: trimui-brick\nname: TrimUI\n", schema);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects YAML missing a required field and reports an error", () => {
    const result = validateYamlAgainstSchema("name: TrimUI\n", schema);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
