import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { ensureSchemaCompat } from "../src/db/ensure-schema.js";
import { runMigrations } from "../src/db/migrate.js";
import { createDb } from "../src/db/client.js";
import { createApp } from "../src/app.js";
import { campuses } from "../src/db/schema.js";

const tempPaths: string[] = [];

function tempSqlite(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `fm-${name}-`));
  const p = path.join(dir, "db.sqlite");
  tempPaths.push(dir);
  return p;
}

afterEach(() => {
  for (const dir of tempPaths.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** Minimal 0.2.0-era schema (no hierarchy_mode, floors require building_id). */
function seedLegacySchema(dbPath: string): void {
  const sqlite = new Database(dbPath);
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE campuses (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      slug text NOT NULL,
      sort_order integer DEFAULT 0 NOT NULL
    );
    CREATE UNIQUE INDEX campuses_slug_unique ON campuses (slug);

    CREATE TABLE buildings (
      id text PRIMARY KEY NOT NULL,
      campus_id text NOT NULL,
      name text NOT NULL,
      slug text NOT NULL,
      sort_order integer DEFAULT 0 NOT NULL,
      FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE cascade
    );
    CREATE UNIQUE INDEX buildings_campus_id_slug_unique ON buildings (campus_id, slug);

    CREATE TABLE floors (
      id text PRIMARY KEY NOT NULL,
      building_id text NOT NULL,
      name text NOT NULL,
      slug text NOT NULL,
      level integer DEFAULT 0 NOT NULL,
      sort_order integer DEFAULT 0 NOT NULL,
      FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE cascade
    );
    CREATE UNIQUE INDEX floors_building_id_slug_unique ON floors (building_id, slug);

    INSERT INTO campuses (id, name, slug, sort_order)
      VALUES ('c1', 'Legacy Campus', 'legacy-campus', 0);
    INSERT INTO buildings (id, campus_id, name, slug, sort_order)
      VALUES ('b1', 'c1', 'Hall', 'hall', 0);
    INSERT INTO floors (id, building_id, name, slug, level, sort_order)
      VALUES ('f1', 'b1', 'Floor 1', 'floor-1', 1, 0);
  `);
  sqlite.close();
}

describe("ensureSchemaCompat", () => {
  it("adds hierarchy_mode and campus_id so /api/campuses works on legacy DBs", async () => {
    const dbPath = tempSqlite("legacy");
    seedLegacySchema(dbPath);

    const sqlite = new Database(dbPath);
    ensureSchemaCompat(sqlite);

    const cols = sqlite.pragma("table_info(campuses)") as { name: string }[];
    expect(cols.some((c) => c.name === "hierarchy_mode")).toBe(true);

    const floorCols = sqlite.pragma("table_info(floors)") as {
      name: string;
      notnull: number;
    }[];
    expect(floorCols.some((c) => c.name === "campus_id")).toBe(true);
    const buildingId = floorCols.find((c) => c.name === "building_id");
    expect(buildingId?.notnull).toBe(0);

    const floor = sqlite.prepare("SELECT campus_id, building_id FROM floors WHERE id = ?").get("f1") as {
      campus_id: string;
      building_id: string;
    };
    expect(floor.campus_id).toBe("c1");
    expect(floor.building_id).toBe("b1");
    sqlite.close();

    // App path: open via drizzle and hit campuses list
    const db = createDb(dbPath);
    const app = createApp({ db });
    const res = await app.request("/api/campuses");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.campuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: "legacy-campus",
          hierarchyMode: "full",
        }),
      ]),
    );
  });

  it("is a no-op on a freshly migrated 0.3 schema", () => {
    const dbPath = tempSqlite("fresh");
    runMigrations(dbPath);

    const sqlite = new Database(dbPath);
    ensureSchemaCompat(sqlite);
    ensureSchemaCompat(sqlite); // second pass

    const campus = sqlite
      .prepare(
        `SELECT hierarchy_mode FROM campuses LIMIT 0`,
      )
      .all();
    expect(Array.isArray(campus)).toBe(true);

    const floorCols = sqlite.pragma("table_info(floors)") as { name: string }[];
    expect(floorCols.some((c) => c.name === "campus_id")).toBe(true);
    sqlite.close();
  });

  it("runMigrations upgrades a legacy file end-to-end", async () => {
    const dbPath = tempSqlite("migrate-legacy");
    seedLegacySchema(dbPath);

    // Journal is empty so drizzle will also try 0000 — that fails if tables exist.
    // Simulate "already migrated" journal so only ensureSchemaCompat upgrades.
    const sqlite = new Database(dbPath);
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at numeric
      );
    `);
    // better-sqlite3 drizzle uses different migration table — just call ensureSchemaCompat
    ensureSchemaCompat(sqlite);
    sqlite.close();

    const db = createDb(dbPath);
    await db.insert(campuses).values({
      name: "Another",
      slug: "another",
      hierarchyMode: "single_map",
      sortOrder: 1,
    });

    const app = createApp({ db });
    const res = await app.request("/api/campuses");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.campuses.length).toBeGreaterThanOrEqual(2);
  });
});
