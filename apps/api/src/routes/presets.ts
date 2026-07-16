import { asc } from "drizzle-orm";
import { Hono } from "hono";
import type { Db } from "../db/client.js";
import { layerPresets } from "../db/schema.js";

export function presetsRoutes(getDb: () => Db) {
  const app = new Hono();

  app.get("/", async (c) => {
    const rows = await getDb()
      .select({
        id: layerPresets.id,
        slug: layerPresets.slug,
        featureTypes: layerPresets.featureTypes,
        sortOrder: layerPresets.sortOrder,
      })
      .from(layerPresets)
      .orderBy(asc(layerPresets.sortOrder), asc(layerPresets.slug));

    return c.json({ presets: rows });
  });

  return app;
}
