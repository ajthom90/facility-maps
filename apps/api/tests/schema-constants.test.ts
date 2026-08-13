import { describe, it, expect } from "vitest";
import { FEATURE_TYPES, PRESET_SEEDS } from "../src/lib/feature-types.js";

describe("feature type catalog", () => {
  it("includes AWAIR-oriented safety types", () => {
    expect(FEATURE_TYPES).toEqual(
      expect.arrayContaining([
        "exit",
        "assembly_point",
        "safe_haven",
        "fire_extinguisher",
        "fire_alarm_pull",
        "aed",
        "first_aid",
        "eye_wash",
        "safety_shower",
        "spill_kit",
        "emergency_phone",
        "water_shutoff",
        "gas_shutoff",
        "electrical_panel",
        "loto_isolation",
        "roof_access",
        "hvac",
        "hazard",
        "chemical_storage",
        "flammable_storage",
        "high_pressure",
        "co_detector",
        "smoke_detector",
        "confined_space",
        "sds_station",
      ])
    );
    expect(FEATURE_TYPES).toHaveLength(25);
    // No duplicates
    expect(new Set(FEATURE_TYPES).size).toBe(FEATURE_TYPES.length);
  });

  it("defines required layer presets", () => {
    const slugs = PRESET_SEEDS.map((p) => p.slug);
    expect(slugs).toEqual([
      "all",
      "evacuation",
      "fire_response",
      "medical",
      "spill_chemical",
      "utilities",
      "hazards",
    ]);
  });

  it("uses only catalog feature types in non-all presets", () => {
    const catalog = new Set<string>(FEATURE_TYPES);
    for (const p of PRESET_SEEDS) {
      if (p.featureTypes === "*") continue;
      for (const t of p.featureTypes) {
        expect(catalog.has(t), `${p.slug} references unknown type ${t}`).toBe(true);
      }
    }
  });
});
