import { describe, expect, it } from "vitest";
import { deepMerge } from "./config";

describe("deepMerge", () => {
  it("merges nested objects, with override scalars winning", () => {
    const base = { a: { x: 1, y: 2 }, b: 5 };
    const result = deepMerge(base, { a: { y: 3 } } as Partial<typeof base>);
    expect(result).toEqual({ a: { x: 1, y: 3 }, b: 5 });
  });

  it("does not mutate either input", () => {
    const base = { a: { x: 1 } };
    const override = { a: { x: 2 } };
    deepMerge(base, override);
    expect(base).toEqual({ a: { x: 1 } });
    expect(override).toEqual({ a: { x: 2 } });
  });
});
