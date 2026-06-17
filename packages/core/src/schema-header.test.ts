import { describe, expect, it } from "vitest";
import { findSchemaUrl } from "./schema-header";

describe("findSchemaUrl", () => {
  it("extracts the schema URL from a yaml-language-server header", () => {
    const yaml =
      "# yaml-language-server: $schema=https://example.com/registry.schema.json\nid: trimui\n";
    expect(findSchemaUrl(yaml)).toBe("https://example.com/registry.schema.json");
  });

  it("returns null when there is no schema header", () => {
    expect(findSchemaUrl("id: trimui\nname: TrimUI\n")).toBeNull();
  });
});
