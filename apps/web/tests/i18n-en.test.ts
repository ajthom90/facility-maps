import { describe, expect, it } from "vitest";
import en from "../src/locales/en.json";

/** Mirrors apps/api/src/lib/feature-types.ts FEATURE_TYPES */
const FEATURE_TYPES = [
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
  "hazard",
  "chemical_storage",
  "flammable_storage",
  "high_pressure",
  "co_detector",
  "confined_space",
  "sds_station",
] as const;

/** Mirrors apps/api/src/lib/feature-types.ts PRESET_SEEDS slugs */
const PRESET_SLUGS = [
  "all",
  "evacuation",
  "fire_response",
  "medical",
  "spill_chemical",
  "utilities",
  "hazards",
] as const;

describe("en.json i18n catalog", () => {
  it("contains public empty-state keys", () => {
    for (const key of [
      "emptyCampuses",
      "emptyBuildings",
      "emptyFloors",
      "emptyPlan",
      "emptyFeatures",
    ] as const) {
      expect(en, `missing ${key}`).toHaveProperty(key);
      expect(typeof en[key]).toBe("string");
      expect(en[key].length).toBeGreaterThan(0);
    }
  });

  it("contains every FEATURE_TYPES key under featureTypes", () => {
    expect(en.featureTypes).toBeDefined();
    for (const type of FEATURE_TYPES) {
      expect(en.featureTypes, `missing featureTypes.${type}`).toHaveProperty(type);
      expect(typeof en.featureTypes[type as keyof typeof en.featureTypes]).toBe("string");
      expect(en.featureTypes[type as keyof typeof en.featureTypes].length).toBeGreaterThan(0);
    }
    expect(Object.keys(en.featureTypes).sort()).toEqual([...FEATURE_TYPES].sort());
  });

  it("contains every preset slug under presets", () => {
    expect(en.presets).toBeDefined();
    for (const slug of PRESET_SLUGS) {
      expect(en.presets, `missing presets.${slug}`).toHaveProperty(slug);
      expect(typeof en.presets[slug as keyof typeof en.presets]).toBe("string");
      expect(en.presets[slug as keyof typeof en.presets].length).toBeGreaterThan(0);
    }
    expect(Object.keys(en.presets).sort()).toEqual([...PRESET_SLUGS].sort());
  });
});
