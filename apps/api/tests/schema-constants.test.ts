import { describe, it, expect } from "vitest";
import { FEATURE_TYPES, PRESET_SEEDS } from "../src/lib/feature-types.js";

describe("feature type catalog", () => {
  it("includes all v1 safety types", () => {
    expect(FEATURE_TYPES).toEqual(
      expect.arrayContaining([
        "exit",
        "fire_extinguisher",
        "co_detector",
        "hazard",
        "chemical_storage",
        "first_aid",
        "water_shutoff",
        "gas_shutoff",
        "electrical_panel",
        "roof_access",
        "safe_haven",
        "high_pressure",
        "flammable_storage",
      ])
    );
    expect(FEATURE_TYPES).toHaveLength(13);
  });

  it("defines required layer presets", () => {
    const slugs = PRESET_SEEDS.map((p) => p.slug);
    expect(slugs).toEqual(["all", "evacuation", "fire_response", "utilities", "hazards"]);
  });
});
