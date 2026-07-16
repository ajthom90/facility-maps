import type {
  BuildingDetail,
  CampusDetail,
  CampusesResponse,
  FloorDetail,
  PresetsResponse,
} from "../types";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : `Request failed: ${res.status}`;
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getCampuses(): Promise<CampusesResponse> {
    return getJson<CampusesResponse>("/api/campuses");
  },

  getCampus(slug: string): Promise<CampusDetail> {
    return getJson<CampusDetail>(`/api/campuses/${encodeURIComponent(slug)}`);
  },

  getBuilding(campusSlug: string, buildingSlug: string): Promise<BuildingDetail> {
    return getJson<BuildingDetail>(
      `/api/campuses/${encodeURIComponent(campusSlug)}/buildings/${encodeURIComponent(buildingSlug)}`,
    );
  },

  getFloor(
    campusSlug: string,
    buildingSlug: string,
    floorSlug: string,
  ): Promise<FloorDetail> {
    return getJson<FloorDetail>(
      `/api/campuses/${encodeURIComponent(campusSlug)}/buildings/${encodeURIComponent(buildingSlug)}/floors/${encodeURIComponent(floorSlug)}`,
    );
  },

  getFloorById(id: string): Promise<FloorDetail> {
    return getJson<FloorDetail>(`/api/floors/${encodeURIComponent(id)}`);
  },

  getPresets(): Promise<PresetsResponse> {
    return getJson<PresetsResponse>("/api/presets");
  },
};
