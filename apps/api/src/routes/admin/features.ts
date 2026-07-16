import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { ZodError, z } from "zod";
import type { Db } from "../../db/client.js";
import { features, floors } from "../../db/schema.js";
import { FEATURE_TYPES } from "../../lib/feature-types.js";
import { parseGeometry, type FeatureGeometry } from "../../lib/geometry.js";
import {
  requireAdmin,
  type AdminVariables,
} from "../../middleware/require-admin.js";

const featureTypeSchema = z.enum(FEATURE_TYPES);

const createSchema = z.object({
  floorId: z.string().uuid(),
  type: featureTypeSchema,
  geometry: z.unknown(),
  label: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const patchSchema = z.object({
  floorId: z.string().uuid().optional(),
  type: featureTypeSchema.optional(),
  geometry: z.unknown().optional(),
  label: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

function parseGeometryOrError(input: unknown): FeatureGeometry | { error: string } {
  try {
    return parseGeometry(input);
  } catch (err) {
    if (err instanceof ZodError) {
      return { error: "Invalid geometry" };
    }
    throw err;
  }
}

export function adminFeaturesRoutes(getDb: () => Db) {
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

    const geometry = parseGeometryOrError(parsed.data.geometry);
    if ("error" in geometry) {
      return c.json({ error: geometry.error }, 400);
    }

    const { floorId, type, label, notes } = parsed.data;

    const [floor] = await getDb()
      .select({ id: floors.id })
      .from(floors)
      .where(eq(floors.id, floorId))
      .limit(1);
    if (!floor) {
      return c.json({ error: "Floor not found" }, 404);
    }

    const [row] = await getDb()
      .insert(features)
      .values({
        floorId,
        type,
        geometry,
        label: label ?? null,
        notes: notes ?? null,
      })
      .returning();

    return c.json(row, 201);
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

    const updates: Partial<{
      floorId: string;
      type: string;
      geometry: FeatureGeometry;
      label: string | null;
      notes: string | null;
      updatedAt: Date;
    }> = {};

    if (parsed.data.floorId !== undefined) updates.floorId = parsed.data.floorId;
    if (parsed.data.type !== undefined) updates.type = parsed.data.type;
    if (parsed.data.label !== undefined) updates.label = parsed.data.label;
    if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
    if (parsed.data.geometry !== undefined) {
      const geometry = parseGeometryOrError(parsed.data.geometry);
      if ("error" in geometry) {
        return c.json({ error: geometry.error }, 400);
      }
      updates.geometry = geometry;
    }

    if (Object.keys(updates).length === 0) {
      return c.json({ error: "No fields to update" }, 400);
    }

    if (updates.floorId) {
      const [floor] = await getDb()
        .select({ id: floors.id })
        .from(floors)
        .where(eq(floors.id, updates.floorId))
        .limit(1);
      if (!floor) {
        return c.json({ error: "Floor not found" }, 404);
      }
    }

    updates.updatedAt = new Date();

    const [row] = await getDb()
      .update(features)
      .set(updates)
      .where(eq(features.id, id))
      .returning();

    if (!row) {
      return c.json({ error: "Feature not found" }, 404);
    }
    return c.json(row);
  });

  app.delete("/:id", async (c) => {
    const id = c.req.param("id");
    const [row] = await getDb().delete(features).where(eq(features.id, id)).returning();
    if (!row) {
      return c.json({ error: "Feature not found" }, 404);
    }
    return c.json({ ok: true, id: row.id });
  });

  return app;
}
