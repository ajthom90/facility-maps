export type HierarchyMode = "full" | "no_buildings" | "single_map";

export type CampusSummary = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  hierarchyMode: HierarchyMode;
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
  floors: FloorSummary[];
  mapFloorId?: string | null;
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
  "smoke_detector",
  "confined_space",
  "sds_station",
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
