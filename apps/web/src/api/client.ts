import type {
  BuildingDetail,
  CampusDetail,
  CampusesResponse,
  FeatureGeometry,
  FeatureType,
  FloorDetail,
  FloorPlan,
  LayerPreset,
  MapFeature,
  PresetsResponse,
} from "../types";

export type AdminUser = {
  id: string;
  username: string;
};

export type ManagedAdminUser = {
  id: string;
  username: string;
  disabled: boolean;
  createdAt: string;
};

export type HierarchyMode = "full" | "no_buildings" | "single_map";

export type CampusRecord = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  hierarchyMode: HierarchyMode;
};

export type BuildingRecord = {
  id: string;
  campusId: string;
  name: string;
  slug: string;
  sortOrder: number;
};

export type FloorRecord = {
  id: string;
  campusId: string;
  buildingId: string | null;
  name: string;
  slug: string;
  level: number;
  sortOrder: number;
};

export type CreateFeatureInput = {
  floorId: string;
  type: FeatureType | string;
  geometry: FeatureGeometry;
  label?: string | null;
  notes?: string | null;
};

export type PatchFeatureInput = {
  type?: FeatureType | string;
  geometry?: FeatureGeometry;
  label?: string | null;
  notes?: string | null;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function errorMessage(body: unknown, status: number): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "string"
  ) {
    return (body as { error: string }).error;
  }
  return `Request failed: ${status}`;
}

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(errorMessage(body, res.status), res.status);
  }
  return body as T;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  if (!isFormData && init?.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(path, {
    credentials: "include",
    ...init,
    headers,
  });
  return parseJson<T>(res);
}

export const api = {
  getCampuses(): Promise<CampusesResponse> {
    return requestJson<CampusesResponse>("/api/campuses");
  },

  getCampus(slug: string): Promise<CampusDetail> {
    return requestJson<CampusDetail>(`/api/campuses/${encodeURIComponent(slug)}`);
  },

  getBuilding(campusSlug: string, buildingSlug: string): Promise<BuildingDetail> {
    return requestJson<BuildingDetail>(
      `/api/campuses/${encodeURIComponent(campusSlug)}/buildings/${encodeURIComponent(buildingSlug)}`,
    );
  },

  getFloor(
    campusSlug: string,
    buildingSlug: string,
    floorSlug: string,
  ): Promise<FloorDetail> {
    return requestJson<FloorDetail>(
      `/api/campuses/${encodeURIComponent(campusSlug)}/buildings/${encodeURIComponent(buildingSlug)}/floors/${encodeURIComponent(floorSlug)}`,
    );
  },

  /** Campus-level floor (no_buildings / single_map). */
  getCampusFloor(campusSlug: string, floorSlug: string): Promise<FloorDetail> {
    return requestJson<FloorDetail>(
      `/api/campuses/${encodeURIComponent(campusSlug)}/floors/${encodeURIComponent(floorSlug)}`,
    );
  },

  getFloorById(id: string): Promise<FloorDetail> {
    return requestJson<FloorDetail>(`/api/floors/${encodeURIComponent(id)}`);
  },

  getPresets(): Promise<PresetsResponse> {
    return requestJson<PresetsResponse>("/api/presets");
  },

  // --- Auth ---

  async login(username: string, password: string): Promise<AdminUser> {
    const data = await requestJson<{ user: AdminUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    return data.user;
  },

  async logout(): Promise<void> {
    await requestJson<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
  },

  /** Returns null when unauthenticated (401). */
  async me(): Promise<AdminUser | null> {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (res.status === 401) return null;
    const data = await parseJson<{ user: AdminUser }>(res);
    return data.user;
  },

  // --- Admin hierarchy ---

  createCampus(input: {
    name: string;
    slug?: string;
    sortOrder?: number;
    hierarchyMode?: HierarchyMode;
  }): Promise<CampusRecord> {
    return requestJson<CampusRecord>("/api/admin/campuses", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  updateCampus(
    id: string,
    input: {
      name?: string;
      slug?: string;
      sortOrder?: number;
      hierarchyMode?: HierarchyMode;
    },
  ): Promise<CampusRecord> {
    return requestJson<CampusRecord>(`/api/admin/campuses/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  deleteCampus(id: string): Promise<{ ok: boolean; id: string }> {
    return requestJson(`/api/admin/campuses/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  createBuilding(input: {
    campusId: string;
    name: string;
    slug?: string;
    sortOrder?: number;
  }): Promise<BuildingRecord> {
    return requestJson<BuildingRecord>("/api/admin/buildings", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  updateBuilding(
    id: string,
    input: { campusId?: string; name?: string; slug?: string; sortOrder?: number },
  ): Promise<BuildingRecord> {
    return requestJson<BuildingRecord>(`/api/admin/buildings/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  deleteBuilding(id: string): Promise<{ ok: boolean; id: string }> {
    return requestJson(`/api/admin/buildings/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  createFloor(input: {
    campusId?: string;
    buildingId?: string;
    name: string;
    slug?: string;
    level?: number;
    sortOrder?: number;
  }): Promise<FloorRecord> {
    return requestJson<FloorRecord>("/api/admin/floors", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  updateFloor(
    id: string,
    input: {
      campusId?: string;
      buildingId?: string | null;
      name?: string;
      slug?: string;
      level?: number;
      sortOrder?: number;
    },
  ): Promise<FloorRecord> {
    return requestJson<FloorRecord>(`/api/admin/floors/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  deleteFloor(id: string): Promise<{ ok: boolean; id: string }> {
    return requestJson(`/api/admin/floors/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async uploadFloorPlan(floorId: string, file: File): Promise<FloorPlan & { floorId: string }> {
    const form = new FormData();
    form.append("file", file);
    return requestJson(`/api/admin/floors/${encodeURIComponent(floorId)}/plan`, {
      method: "POST",
      body: form,
    });
  },

  // --- Admin features ---

  createFeature(input: CreateFeatureInput): Promise<MapFeature> {
    return requestJson<MapFeature>("/api/admin/features", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  updateFeature(id: string, input: PatchFeatureInput): Promise<MapFeature> {
    return requestJson<MapFeature>(`/api/admin/features/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  deleteFeature(id: string): Promise<{ ok: boolean; id: string }> {
    return requestJson(`/api/admin/features/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  // --- Admin users ---

  listAdminUsers(): Promise<{ users: ManagedAdminUser[] }> {
    return requestJson<{ users: ManagedAdminUser[] }>("/api/admin/users");
  },

  createAdminUser(input: {
    username: string;
    password: string;
  }): Promise<ManagedAdminUser> {
    return requestJson<ManagedAdminUser>("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  updateAdminUser(
    id: string,
    input: { disabled?: boolean; password?: string },
  ): Promise<ManagedAdminUser> {
    return requestJson<ManagedAdminUser>(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  // --- Admin presets ---

  updatePreset(
    id: string,
    input: { featureTypes: string[] },
  ): Promise<LayerPreset> {
    return requestJson<LayerPreset>(`/api/admin/presets/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
};
