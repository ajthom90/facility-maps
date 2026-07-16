import { asc, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { features, floorPlans, floors } from "../db/schema.js";

/** Encode each path segment for `/api/uploads/...` URLs. */
export function planFileUrl(filePath: string): string {
  const encoded = filePath
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `/api/uploads/${encoded}`;
}

export type FloorPayload = {
  id: string;
  name: string;
  slug: string;
  level: number;
  sortOrder: number;
  plan: null | {
    id: string;
    url: string;
    mimeType: string;
    width: number | null;
    height: number | null;
    uploadedAt: Date;
  };
  features: Array<{
    id: string;
    type: string;
    geometry: unknown;
    label: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
};

export async function buildFloorPayload(
  db: Db,
  floorId: string
): Promise<FloorPayload | null> {
  const [floor] = await db.select().from(floors).where(eq(floors.id, floorId)).limit(1);
  if (!floor) return null;

  const [plan] = await db
    .select()
    .from(floorPlans)
    .where(eq(floorPlans.floorId, floor.id))
    .limit(1);

  const featureRows = await db
    .select({
      id: features.id,
      type: features.type,
      geometry: features.geometry,
      label: features.label,
      notes: features.notes,
      createdAt: features.createdAt,
      updatedAt: features.updatedAt,
    })
    .from(features)
    .where(eq(features.floorId, floor.id))
    .orderBy(asc(features.createdAt));

  return {
    id: floor.id,
    name: floor.name,
    slug: floor.slug,
    level: floor.level,
    sortOrder: floor.sortOrder,
    plan: plan
      ? {
          id: plan.id,
          url: planFileUrl(plan.filePath),
          mimeType: plan.mimeType,
          width: plan.width,
          height: plan.height,
          uploadedAt: plan.uploadedAt,
        }
      : null,
    features: featureRows,
  };
}
