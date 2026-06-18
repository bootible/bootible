import { describe, expect, it } from "vitest";
import { parseDeviceEntry } from "./registry";

const schema = {
  type: "object",
  required: ["id", "name", "provisioning_models"],
  additionalProperties: true,
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    provisioning_models: { type: "array", items: { type: "string" } },
  },
};

describe("parseDeviceEntry", () => {
  it("parses a valid device entry into a typed object", () => {
    const yaml = "id: rog-ally\nname: ROG Ally\nprovisioning_models: [on-device]\n";
    const entry = parseDeviceEntry(yaml, schema);
    expect(entry.id).toBe("rog-ally");
    expect(entry.provisioning_models).toContain("on-device");
  });

  it("throws on an entry missing a required field", () => {
    expect(() => parseDeviceEntry("name: No Id\n", schema)).toThrow();
  });
});
