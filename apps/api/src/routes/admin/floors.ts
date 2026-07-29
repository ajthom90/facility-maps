import { and, count, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "../../db/client.js";
import { buildings, campuses, floors } from "../../db/schema.js";
import { isUniqueViolation } from "../../lib/db-errors.js";
import { parseHierarchyMode } from "../../lib/hierarchy-mode.js";
import { resolveSlug } from "../../lib/slug.js";
import {
  requireAdmin,
  type AdminVariables,
} from "../../middleware/require-admin.js";

const createSchema = z
  .object({
    campusId: z.string().uuid().optional(),
    buildingId: z.string().uuid().optional(),
    name: z.string().min(1),
    slug: z.string().optional(),
    level: z.number().int().optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine((d) => d.buildingId || d.campusId, {
    message: "buildingId or campusId is required",
  });

const patchSchema = z.object({
  buildingId: z.string().uuid().nullable().optional(),
  campusId: z.string().uuid().optional(),
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  level: z.number().int().optional(),
  sortOrder: z.number().int().optional(),
});

function serializeFloor(row: typeof floors.$inferSelect) {
  return {
    id: row.id,
    campusId: row.campusId,
    buildingId: row.buildingId,
    name: row.name,
    slug: row.slug,
    level: row.level,
    sortOrder: row.sortOrder,
  };
}

export function adminFloorsRoutes(getDb: () => Db) {
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

    const { name, level, sortOrder } = parsed.data;
    const slug = resolveSlug(name, parsed.data.slug);
    if (!slug) {
      return c.json({ error: "Invalid or missing slug" }, 400);
    }

    const db = getDb();
    let campusId = parsed.data.campusId;
    let buildingId: string | null = parsed.data.buildingId ?? null;

    if (buildingId) {
      const [building] = await db
        .select({ id: buildings.id, campusId: buildings.campusId })
        .from(buildings)
        .where(eq(buildings.id, buildingId))
        .limit(1);
      if (!building) {
        return c.json({ error: "Building not found" }, 404);
      }
      if (campusId && campusId !== building.campusId) {
        return c.json({ error: "campusId does not match building" }, 400);
      }
      campusId = building.campusId;
    }

    if (!campusId) {
      return c.json({ error: "campusId is required when buildingId is omitted" }, 400);
    }

    const [campus] = await db
      .select()
      .from(campuses)
      .where(eq(campuses.id, campusId))
      .limit(1);
    if (!campus) {
      return c.json({ error: "Campus not found" }, 404);
    }

    const mode = parseHierarchyMode(campus.hierarchyMode);

    if (mode === "full") {
      if (!buildingId) {
        return c.json(
          { error: "buildingId is required for campuses with full hierarchy" },
          400,
        );
      }
    } else {
      if (buildingId) {
        return c.json(
          {
            error:
              "buildingId is not allowed for campuses without buildings hierarchy",
          },
          400,
        );
      }
      buildingId = null;
    }

    if (mode === "single_map") {
      const [existing] = await db
        .select({ n: count() })
        .from(floors)
        .where(and(eq(floors.campusId, campusId), isNull(floors.buildingId)));
      if ((existing?.n ?? 0) >= 1) {
        return c.json(
          { error: "single_map campuses can only have one map floor" },
          400,
        );
      }
    }

    try {
      const [row] = await db
        .insert(floors)
        .values({
          campusId,
          buildingId,
          name,
          slug,
          level: level ?? 0,
          sortOrder: sortOrder ?? 0,
        })
        .returning();
      return c.json(serializeFloor(row), 201);
    } catch (err) {
      if (isUniqueViolation(err)) {
        return c.json(
          {
            error: buildingId
              ? "Floor slug already exists on this building"
              : "Floor slug already exists on this campus",
          },
          409,
        );
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
    const [existing] = await db.select().from(floors).where(eq(floors.id, id)).limit(1);
    if (!existing) {
      return c.json({ error: "Floor not found" }, 404);
    }

    const [campus] = await db
      .select()
      .from(campuses)
      .where(eq(campuses.id, existing.campusId))
      .limit(1);
    if (!campus) {
      return c.json({ error: "Campus not found" }, 404);
    }

    const mode = parseHierarchyMode(campus.hierarchyMode);
    if (mode === "single_map") {
      // Allow rename of the single map floor only (name/slug/level/sort)
      if (parsed.data.buildingId !== undefined || parsed.data.campusId !== undefined) {
        return c.json(
          { error: "Cannot re-parent floors on a single_map campus" },
          400,
        );
      }
    }

    const updates: Partial<{
      buildingId: string | null;
      campusId: string;
      name: string;
      slug: string;
      level: number;
      sortOrder: number;
    }> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.level !== undefined) updates.level = parsed.data.level;
    if (parsed.data.sortOrder !== undefined) updates.sortOrder = parsed.data.sortOrder;
    if (parsed.data.slug !== undefined) {
      if (!resolveSlug(parsed.data.slug, parsed.data.slug)) {
        return c.json({ error: "Invalid slug" }, 400);
      }
      updates.slug = parsed.data.slug.trim();
    }

    if (parsed.data.campusId !== undefined) {
      updates.campusId = parsed.data.campusId;
    }
    if (parsed.data.buildingId !== undefined) {
      updates.buildingId = parsed.data.buildingId;
    }

    if (Object.keys(updates).length === 0) {
      return c.json({ error: "No fields to update" }, 400);
    }

    if (updates.buildingId) {
      const [building] = await db
        .select({ id: buildings.id, campusId: buildings.campusId })
        .from(buildings)
        .where(eq(buildings.id, updates.buildingId))
        .limit(1);
      if (!building) {
        return c.json({ error: "Building not found" }, 404);
      }
      updates.campusId = building.campusId;
    }

    try {
      const [row] = await db
        .update(floors)
        .set(updates)
        .where(eq(floors.id, id))
        .returning();
      if (!row) {
        return c.json({ error: "Floor not found" }, 404);
      }
      return c.json(serializeFloor(row));
    } catch (err) {
      if (isUniqueViolation(err)) {
        return c.json({ error: "Floor slug already exists" }, 409);
      }
      throw err;
    }
  });

  app.delete("/:id", async (c) => {
    const id = c.req.param("id");
    const db = getDb();
    const [existing] = await db.select().from(floors).where(eq(floors.id, id)).limit(1);
    if (!existing) {
      return c.json({ error: "Floor not found" }, 404);
    }

    const [campus] = await db
      .select()
      .from(campuses)
      .where(eq(campuses.id, existing.campusId))
      .limit(1);
    if (campus && parseHierarchyMode(campus.hierarchyMode) === "single_map") {
      return c.json(
        { error: "Cannot delete the map floor on a single_map campus" },
        400,
      );
    }

    const [row] = await db.delete(floors).where(eq(floors.id, id)).returning();
    if (!row) {
      return c.json({ error: "Floor not found" }, 404);
    }
    return c.json({ ok: true, id: row.id });
  });

  return app;
}
