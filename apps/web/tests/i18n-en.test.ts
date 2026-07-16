import { describe, expect, it } from "vitest";
import en from "../src/locales/en.json";

/** Mirrors apps/api/src/lib/feature-types.ts FEATURE_TYPES */
const FEATURE_TYPES = [
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
] as const;

/** Mirrors apps/api/src/lib/feature-types.ts PRESET_SEEDS slugs */
const PRESET_SLUGS = [
  "all",
  "evacuation",
  "fire_response",
  "utilities",
  "hazards",
] as const;

describe("en.json i18n catalog", () => {
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
