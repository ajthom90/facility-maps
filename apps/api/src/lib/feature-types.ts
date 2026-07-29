/**
 * Canonical safety feature type catalog for Minnesota AWAIR-oriented facility maps.
 * Keep in sync with apps/web/src/types.ts FEATURE_TYPES and en.json featureTypes keys.
 */
export const FEATURE_TYPES = [
  // Life safety & emergency response
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
  // Utilities & isolation
  "water_shutoff",
  "gas_shutoff",
  "electrical_panel",
  "loto_isolation",
  "roof_access",
  // Hazards & process / right-to-know
  "hazard",
  "chemical_storage",
  "flammable_storage",
  "high_pressure",
  "co_detector",
  "confined_space",
  "sds_station",
] as const;

export type FeatureType = (typeof FEATURE_TYPES)[number];

export const PRESET_SEEDS: {
  slug: string;
  sortOrder: number;
  featureTypes: FeatureType[] | "*";
}[] = [
  { slug: "all", sortOrder: 0, featureTypes: "*" },
  {
    slug: "evacuation",
    sortOrder: 1,
    featureTypes: [
      "exit",
      "assembly_point",
      "safe_haven",
      "emergency_phone",
      "first_aid",
      "aed",
    ],
  },
  {
    slug: "fire_response",
    sortOrder: 2,
    featureTypes: [
      "exit",
      "fire_extinguisher",
      "fire_alarm_pull",
      "electrical_panel",
      "gas_shutoff",
      "flammable_storage",
      "hazard",
    ],
  },
  {
    slug: "medical",
    sortOrder: 3,
    featureTypes: [
      "aed",
      "first_aid",
      "eye_wash",
      "safety_shower",
      "emergency_phone",
    ],
  },
  {
    slug: "spill_chemical",
    sortOrder: 4,
    featureTypes: [
      "spill_kit",
      "eye_wash",
      "safety_shower",
      "chemical_storage",
      "sds_station",
      "water_shutoff",
      "flammable_storage",
    ],
  },
  {
    slug: "utilities",
    sortOrder: 5,
    featureTypes: [
      "water_shutoff",
      "gas_shutoff",
      "electrical_panel",
      "loto_isolation",
      "roof_access",
    ],
  },
  {
    slug: "hazards",
    sortOrder: 6,
    featureTypes: [
      "hazard",
      "chemical_storage",
      "flammable_storage",
      "high_pressure",
      "co_detector",
      "confined_space",
    ],
  },
];
