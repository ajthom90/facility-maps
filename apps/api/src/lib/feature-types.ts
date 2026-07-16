export const FEATURE_TYPES = [
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

export type FeatureType = (typeof FEATURE_TYPES)[number];

export const PRESET_SEEDS: {
  slug: string;
  sortOrder: number;
  featureTypes: FeatureType[] | "*";
}[] = [
  { slug: "all", sortOrder: 0, featureTypes: "*" },
  { slug: "evacuation", sortOrder: 1, featureTypes: ["exit", "safe_haven", "first_aid"] },
  {
    slug: "fire_response",
    sortOrder: 2,
    featureTypes: [
      "exit",
      "fire_extinguisher",
      "electrical_panel",
      "gas_shutoff",
      "flammable_storage",
      "hazard",
    ],
  },
  {
    slug: "utilities",
    sortOrder: 3,
    featureTypes: ["water_shutoff", "gas_shutoff", "electrical_panel", "roof_access"],
  },
  {
    slug: "hazards",
    sortOrder: 4,
    featureTypes: [
      "hazard",
      "chemical_storage",
      "flammable_storage",
      "high_pressure",
      "co_detector",
    ],
  },
];
