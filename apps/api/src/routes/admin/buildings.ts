import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "../../db/client.js";
import { buildings, campuses } from "../../db/schema.js";
import { resolveSlug } from "../../lib/slug.js";
import {
  requireAdmin,
  type AdminVariables,
} from "../../middleware/require-admin.js";

const createSchema = z.object({
  campusId: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

const patchSchema = z.object({
  campusId: z.string().uuid().optional(),
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
});

export function adminBuildingsRoutes(getDb: () => Db) {
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

    const { campusId, name, sortOrder } = parsed.data;
    const slug = resolveSlug(name, parsed.data.slug);
    if (!slug) {
      return c.json({ error: "Invalid or missing slug" }, 400);
    }

    const [campus] = await getDb()
      .select({ id: campuses.id })
      .from(campuses)
      .where(eq(campuses.id, campusId))
      .limit(1);
    if (!campus) {
      return c.json({ error: "Campus not found" }, 404);
    }

    try {
      const [row] = await getDb()
        .insert(buildings)
        .values({
          campusId,
          name,
          slug,
          sortOrder: sortOrder ?? 0,
        })
        .returning();
      return c.json(row, 201);
    } catch (err) {
      if (isUniqueViolation(err)) {
        return c.json({ error: "Building slug already exists on this campus" }, 409);
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

    const updates: Partial<{
      campusId: string;
      name: string;
      slug: string;
      sortOrder: number;
    }> = {};
    if (parsed.data.campusId !== undefined) updates.campusId = parsed.data.campusId;
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.sortOrder !== undefined) updates.sortOrder = parsed.data.sortOrder;
    if (parsed.data.slug !== undefined) {
      if (!resolveSlug(parsed.data.slug, parsed.data.slug)) {
        return c.json({ error: "Invalid slug" }, 400);
      }
      updates.slug = parsed.data.slug.trim();
    }

    if (Object.keys(updates).length === 0) {
      return c.json({ error: "No fields to update" }, 400);
    }

    if (updates.campusId) {
      const [campus] = await getDb()
        .select({ id: campuses.id })
        .from(campuses)
        .where(eq(campuses.id, updates.campusId))
        .limit(1);
      if (!campus) {
        return c.json({ error: "Campus not found" }, 404);
      }
    }

    try {
      const [row] = await getDb()
        .update(buildings)
        .set(updates)
        .where(eq(buildings.id, id))
        .returning();
      if (!row) {
        return c.json({ error: "Building not found" }, 404);
      }
      return c.json(row);
    } catch (err) {
      if (isUniqueViolation(err)) {
        return c.json({ error: "Building slug already exists on this campus" }, 409);
      }
      throw err;
    }
  });

  app.delete("/:id", async (c) => {
    const id = c.req.param("id");
    const [row] = await getDb().delete(buildings).where(eq(buildings.id, id)).returning();
    if (!row) {
      return c.json({ error: "Building not found" }, 404);
    }
    return c.json({ ok: true, id: row.id });
  });

  return app;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "23505"
  );
}
