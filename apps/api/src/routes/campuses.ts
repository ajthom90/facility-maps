import { and, asc, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import type { Db } from "../db/client.js";
import { buildings, campuses, floors } from "../db/schema.js";
import { buildFloorPayload } from "../lib/floor-payload.js";
import { parseHierarchyMode } from "../lib/hierarchy-mode.js";

function floorSummarySelect() {
  return {
    id: floors.id,
    name: floors.name,
    slug: floors.slug,
    level: floors.level,
    sortOrder: floors.sortOrder,
  };
}

export function campusesRoutes(getDb: () => Db) {
  const app = new Hono();

  app.get("/", async (c) => {
    const rows = await getDb()
      .select({
        id: campuses.id,
        name: campuses.name,
        slug: campuses.slug,
        sortOrder: campuses.sortOrder,
        hierarchyMode: campuses.hierarchyMode,
      })
      .from(campuses)
      .orderBy(asc(campuses.sortOrder), asc(campuses.name));

    return c.json({
      campuses: rows.map((r) => ({
        ...r,
        hierarchyMode: parseHierarchyMode(r.hierarchyMode),
      })),
    });
  });

  app.get("/:slug", async (c) => {
    const slug = c.req.param("slug");
    const db = getDb();
    const [campus] = await db
      .select()
      .from(campuses)
      .where(eq(campuses.slug, slug))
      .limit(1);

    if (!campus) {
      return c.json({ error: "Campus not found" }, 404);
    }

    const mode = parseHierarchyMode(campus.hierarchyMode);
    const base = {
      id: campus.id,
      name: campus.name,
      slug: campus.slug,
      sortOrder: campus.sortOrder,
      hierarchyMode: mode,
    };

    if (mode === "full") {
      const buildingRows = await db
        .select({
          id: buildings.id,
          name: buildings.name,
          slug: buildings.slug,
          sortOrder: buildings.sortOrder,
        })
        .from(buildings)
        .where(eq(buildings.campusId, campus.id))
        .orderBy(asc(buildings.sortOrder), asc(buildings.name));

      return c.json({ ...base, buildings: buildingRows, floors: [] as never[] });
    }

    // no_buildings | single_map — floors hang on campus
    const floorRows = await db
      .select(floorSummarySelect())
      .from(floors)
      .where(and(eq(floors.campusId, campus.id), isNull(floors.buildingId)))
      .orderBy(asc(floors.sortOrder), asc(floors.level));

    return c.json({
      ...base,
      buildings: [] as never[],
      floors: floorRows,
      mapFloorId: mode === "single_map" ? (floorRows[0]?.id ?? null) : null,
    });
  });

  app.get("/:campusSlug/buildings/:buildingSlug", async (c) => {
    const campusSlug = c.req.param("campusSlug");
    const buildingSlug = c.req.param("buildingSlug");
    const db = getDb();

    const [campus] = await db
      .select({ id: campuses.id, hierarchyMode: campuses.hierarchyMode })
      .from(campuses)
      .where(eq(campuses.slug, campusSlug))
      .limit(1);

    if (!campus) {
      return c.json({ error: "Campus not found" }, 404);
    }
    if (parseHierarchyMode(campus.hierarchyMode) !== "full") {
      return c.json({ error: "Campus does not use buildings" }, 404);
    }

    const [building] = await db
      .select()
      .from(buildings)
      .where(and(eq(buildings.campusId, campus.id), eq(buildings.slug, buildingSlug)))
      .limit(1);

    if (!building) {
      return c.json({ error: "Building not found" }, 404);
    }

    const floorRows = await db
      .select(floorSummarySelect())
      .from(floors)
      .where(eq(floors.buildingId, building.id))
      .orderBy(asc(floors.sortOrder), asc(floors.level));

    return c.json({
      id: building.id,
      name: building.name,
      slug: building.slug,
      sortOrder: building.sortOrder,
      floors: floorRows,
    });
  });

  /** Campus-level floor (no_buildings / single_map). */
  app.get("/:campusSlug/floors/:floorSlug", async (c) => {
    const campusSlug = c.req.param("campusSlug");
    const floorSlug = c.req.param("floorSlug");
    const db = getDb();

    const [campus] = await db
      .select({ id: campuses.id, hierarchyMode: campuses.hierarchyMode })
      .from(campuses)
      .where(eq(campuses.slug, campusSlug))
      .limit(1);

    if (!campus) {
      return c.json({ error: "Campus not found" }, 404);
    }

    const mode = parseHierarchyMode(campus.hierarchyMode);
    if (mode === "full") {
      return c.json({ error: "Use building floor path for full hierarchy campuses" }, 404);
    }

    const [floor] = await db
      .select({ id: floors.id })
      .from(floors)
      .where(
        and(
          eq(floors.campusId, campus.id),
          isNull(floors.buildingId),
          eq(floors.slug, floorSlug),
        ),
      )
      .limit(1);

    if (!floor) {
      return c.json({ error: "Floor not found" }, 404);
    }

    const payload = await buildFloorPayload(db, floor.id);
    if (!payload) {
      return c.json({ error: "Floor not found" }, 404);
    }
    return c.json(payload);
  });

  app.get("/:campusSlug/buildings/:buildingSlug/floors/:floorSlug", async (c) => {
    const campusSlug = c.req.param("campusSlug");
    const buildingSlug = c.req.param("buildingSlug");
    const floorSlug = c.req.param("floorSlug");
    const db = getDb();

    const [campus] = await db
      .select({ id: campuses.id, hierarchyMode: campuses.hierarchyMode })
      .from(campuses)
      .where(eq(campuses.slug, campusSlug))
      .limit(1);

    if (!campus) {
      return c.json({ error: "Campus not found" }, 404);
    }
    if (parseHierarchyMode(campus.hierarchyMode) !== "full") {
      return c.json({ error: "Campus does not use buildings" }, 404);
    }

    const [building] = await db
      .select({ id: buildings.id })
      .from(buildings)
      .where(and(eq(buildings.campusId, campus.id), eq(buildings.slug, buildingSlug)))
      .limit(1);

    if (!building) {
      return c.json({ error: "Building not found" }, 404);
    }

    const [floor] = await db
      .select({ id: floors.id })
      .from(floors)
      .where(and(eq(floors.buildingId, building.id), eq(floors.slug, floorSlug)))
      .limit(1);

    if (!floor) {
      return c.json({ error: "Floor not found" }, 404);
    }

    const payload = await buildFloorPayload(db, floor.id);
    if (!payload) {
      return c.json({ error: "Floor not found" }, 404);
    }
    return c.json(payload);
  });

  return app;
}
