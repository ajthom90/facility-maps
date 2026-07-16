export type CampusSummary = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
};

export type BuildingSummary = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
};

export type FloorSummary = {
  id: string;
  name: string;
  slug: string;
  level: number;
  sortOrder: number;
};

export type CampusDetail = CampusSummary & {
  buildings: BuildingSummary[];
};

export type BuildingDetail = BuildingSummary & {
  floors: FloorSummary[];
};

export type CampusesResponse = {
  campuses: CampusSummary[];
};

/** Mirrors apps/api/src/lib/feature-types.ts FEATURE_TYPES */
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

export type PointGeometry = {
  type: "point";
  x: number;
  y: number;
};

export type PolygonGeometry = {
  type: "polygon";
  points: [number, number][];
};

export type FeatureGeometry = PointGeometry | PolygonGeometry;

export type MapFeature = {
  id: string;
  type: string;
  geometry: FeatureGeometry | unknown;
  label: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FloorPlan = {
  id: string;
  url: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  uploadedAt: string;
};

export type FloorDetail = FloorSummary & {
  plan: FloorPlan | null;
  features: MapFeature[];
};

export type LayerPreset = {
  id: string;
  slug: string;
  featureTypes: string[];
  sortOrder: number;
};

export type PresetsResponse = {
  presets: LayerPreset[];
};
