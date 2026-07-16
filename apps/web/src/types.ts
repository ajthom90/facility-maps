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
