import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "../../db/client.js";
import { layerPresets } from "../../db/schema.js";
import { FEATURE_TYPES } from "../../lib/feature-types.js";
import {
  requireAdmin,
  type AdminVariables,
} from "../../middleware/require-admin.js";

const patchSchema = z.object({
  featureTypes: z.array(z.enum(FEATURE_TYPES)),
});

export function adminPresetsRoutes(getDb: () => Db) {
  const app = new Hono<{ Variables: AdminVariables }>();
  app.use("*", requireAdmin(getDb));

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

    const [row] = await getDb()
      .update(layerPresets)
      .set({ featureTypes: parsed.data.featureTypes })
      .where(eq(layerPresets.id, id))
      .returning({
        id: layerPresets.id,
        slug: layerPresets.slug,
        featureTypes: layerPresets.featureTypes,
        sortOrder: layerPresets.sortOrder,
      });

    if (!row) {
      return c.json({ error: "Preset not found" }, 404);
    }
    return c.json(row);
  });

  return app;
}
