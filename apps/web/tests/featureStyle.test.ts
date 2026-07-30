import { describe, expect, it } from "vitest";
import { FEATURE_TYPES } from "../src/types";
import { FEATURE_TYPE_COLORS, colorForType } from "../src/lib/featureStyle";

describe("featureStyle", () => {
  it("defines a color for every FEATURE_TYPES entry", () => {
    for (const type of FEATURE_TYPES) {
      expect(FEATURE_TYPE_COLORS, `missing color for ${type}`).toHaveProperty(type);
      expect(typeof FEATURE_TYPE_COLORS[type]).toBe("string");
      expect(FEATURE_TYPE_COLORS[type].length).toBeGreaterThan(0);
    }
  });

  it("falls back to slate for unknown types", () => {
    expect(colorForType("not_a_real_type")).toBe("#64748b");
  });
});
