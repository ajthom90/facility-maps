import { and, count, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "../../db/client.js";
import { buildings, campuses, floors } from "../../db/schema.js";
import { isUniqueViolation } from "../../lib/db-errors.js";
import {
  HIERARCHY_MODES,
  type HierarchyMode,
  parseHierarchyMode,
  SINGLE_MAP_FLOOR_SLUG,
} from "../../lib/hierarchy-mode.js";
import { resolveSlug } from "../../lib/slug.js";
import {
  requireAdmin,
  type AdminVariables,
} from "../../middleware/require-admin.js";

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  sortOrder: z.number().int().optional(),
  hierarchyMode: z.enum(HIERARCHY_MODES).optional(),
});

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  hierarchyMode: z.enum(HIERARCHY_MODES).optional(),
});

function serializeCampus(row: typeof campuses.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    sortOrder: row.sortOrder,
    hierarchyMode: parseHierarchyMode(row.hierarchyMode),
  };
}

/** Ensure single_map campuses have exactly one campus-level floor. */
export async function ensureSingleMapFloor(
  db: Db,
  campusId: string,
  _campusName?: string,
): Promise<void> {
  const existing = await db
    .select({ id: floors.id })
    .from(floors)
    .where(and(eq(floors.campusId, campusId), isNull(floors.buildingId)))
    .limit(2);

  if (existing.length > 1) {
    throw new Error("single_map campus has multiple campus-level floors");
  }
  if (existing.length === 1) return;

  await db.insert(floors).values({
    campusId,
    buildingId: null,
    name: "Site map",
    slug: SINGLE_MAP_FLOOR_SLUG,
    level: 0,
    sortOrder: 0,
  });
}

async function canSwitchMode(
  db: Db,
  campusId: string,
  from: HierarchyMode,
  to: HierarchyMode,
): Promise<string | null> {
  if (from === to) return null;

  const [buildingCount] = await db
    .select({ n: count() })
    .from(buildings)
    .where(eq(buildings.campusId, campusId));

  const campusFloors = await db
    .select({ id: floors.id, buildingId: floors.buildingId })
    .from(floors)
    .where(eq(floors.campusId, campusId));

  const buildingFloors = campusFloors.filter((f) => f.buildingId != null);
  const directFloors = campusFloors.filter((f) => f.buildingId == null);
  const nBuildings = buildingCount?.n ?? 0;

  if (to === "single_map") {
    if (nBuildings > 0) {
      return "Cannot switch to single map while buildings exist. Delete buildings first.";
    }
    if (directFloors.length > 1) {
      return "Cannot switch to single map while more than one campus-level floor exists.";
    }
    if (buildingFloors.length > 0) {
      return "Cannot switch to single map while floors under buildings exist.";
    }
  }

  if (to === "no_buildings") {
    if (nBuildings > 0) {
      return "Cannot switch to campus→floor mode while buildings exist. Delete buildings first.";
    }
  }

  if (to === "full") {
    if (directFloors.length > 0) {
      return "Cannot switch to full hierarchy while campus-level floors exist. Delete those floors first.";
    }
  }

  return null;
}

export function adminCampusesRoutes(getDb: () => Db) {
  const app = new Hono<{ Variables: AdminVariables }>();
  app.use("*", requireAdmin(getDb));

  app.post("/", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
    }

    const { name, sortOrder } = parsed.data;
    const hierarchyMode = parsed.data.hierarchyMode ?? "full";
    const slug = resolveSlug(name, parsed.data.slug);
    if (!slug) {
      return c.json({ error: "Invalid or missing slug" }, 400);
    }

    const db = getDb();
    try {
      const [row] = await db
        .insert(campuses)
        .values({
          name,
          slug,
          sortOrder: sortOrder ?? 0,
          hierarchyMode,
        })
        .returning();

      if (hierarchyMode === "single_map") {
        await ensureSingleMapFloor(db, row.id, name);
      }

      return c.json(serializeCampus(row), 201);
    } catch (err) {
      if (isUniqueViolation(err)) {
        return c.json({ error: "Campus slug already exists" }, 409);
      }
      throw err;
    }
  });

  app.patch("/:id", async (c) => {
    const id = c.req.param("id");
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
    }

    const db = getDb();
    const [existing] = await db.select().from(campuses).where(eq(campuses.id, id)).limit(1);
    if (!existing) {
      return c.json({ error: "Campus not found" }, 404);
    }

    const updates: Partial<{
      name: string;
      slug: string;
      sortOrder: number;
      hierarchyMode: HierarchyMode;
    }> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.sortOrder !== undefined) updates.sortOrder = parsed.data.sortOrder;
    if (parsed.data.slug !== undefined) {
      if (!resolveSlug(parsed.data.slug, parsed.data.slug)) {
        return c.json({ error: "Invalid slug" }, 400);
      }
      updates.slug = parsed.data.slug.trim();
    }

    if (parsed.data.hierarchyMode !== undefined) {
      const from = parseHierarchyMode(existing.hierarchyMode);
      const to = parsed.data.hierarchyMode;
      const block = await canSwitchMode(db, id, from, to);
      if (block) {
        return c.json({ error: block }, 400);
      }
      updates.hierarchyMode = to;
    }

    if (Object.keys(updates).length === 0) {
      return c.json({ error: "No fields to update" }, 400);
    }

    try {
      const [row] = await db
        .update(campuses)
        .set(updates)
        .where(eq(campuses.id, id))
        .returning();
      if (!row) {
        return c.json({ error: "Campus not found" }, 404);
      }

      if (parseHierarchyMode(row.hierarchyMode) === "single_map") {
        await ensureSingleMapFloor(db, row.id, row.name);
      }

      return c.json(serializeCampus(row));
    } catch (err) {
      if (isUniqueViolation(err)) {
        return c.json({ error: "Campus slug already exists" }, 409);
      }
      throw err;
    }
  });

  app.delete("/:id", async (c) => {
    const id = c.req.param("id");
    const [row] = await getDb().delete(campuses).where(eq(campuses.id, id)).returning();
    if (!row) {
      return c.json({ error: "Campus not found" }, 404);
    }
    return c.json({ ok: true, id: row.id });
  });

  return app;
}
