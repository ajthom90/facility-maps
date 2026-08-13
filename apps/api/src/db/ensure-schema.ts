import type { SqliteDatabase } from "./client.js";

type ColumnInfo = {
  name: string;
  notnull: number;
};

function tableColumns(sqlite: SqliteDatabase, table: string): ColumnInfo[] {
  return sqlite.pragma(`table_info(${table})`) as ColumnInfo[];
}

function hasColumn(sqlite: SqliteDatabase, table: string, column: string): boolean {
  return tableColumns(sqlite, table).some((c) => c.name === column);
}

function columnNotNull(sqlite: SqliteDatabase, table: string, column: string): boolean {
  const col = tableColumns(sqlite, table).find((c) => c.name === column);
  return col ? col.notnull === 1 : false;
}

function tableExists(sqlite: SqliteDatabase, table: string): boolean {
  const row = sqlite
    .prepare(
      `SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`,
    )
    .get(table) as { ok: number } | undefined;
  return Boolean(row);
}

/**
 * Bring a DB that already applied an older 0000_init up to the current shape.
 *
 * Why: we reshaped 0000_init_sqlite.sql for hierarchy modes. DBs that already
 * had the old 0000 journaled never re-run it, so SELECT hierarchy_mode 500s.
 * This step is idempotent and safe on fresh 0.3+ installs (no-ops).
 */
export function ensureSchemaCompat(sqlite: SqliteDatabase): void {
  if (!tableExists(sqlite, "campuses")) {
    // Migrations not applied yet / empty file — leave to migrator.
    return;
  }

  if (!hasColumn(sqlite, "campuses", "hierarchy_mode")) {
    sqlite.exec(
      `ALTER TABLE campuses ADD COLUMN hierarchy_mode text NOT NULL DEFAULT 'full'`,
    );
  }

  // Photo/video attachments on map features (post-0.3 deploy upgrade).
  ensureFeatureMediaTable(sqlite);
  ensureFeatureSortOrder(sqlite);

  if (!tableExists(sqlite, "floors")) {
    return;
  }

  const needsCampusId = !hasColumn(sqlite, "floors", "campus_id");
  const buildingIdNotNull = columnNotNull(sqlite, "floors", "building_id");

  if (!needsCampusId && !buildingIdNotNull) {
    // Already on flexible floors shape; ensure indexes for campus-level floors.
    ensureFloorIndexes(sqlite);
    return;
  }

  // Rebuild floors: add campus_id, allow NULL building_id, backfill campus from buildings.
  sqlite.exec(`PRAGMA foreign_keys = OFF`);
  sqlite.exec(`BEGIN`);
  try {
    sqlite.exec(`
      CREATE TABLE floors_new (
        id text PRIMARY KEY NOT NULL,
        campus_id text NOT NULL,
        building_id text,
        name text NOT NULL,
        slug text NOT NULL,
        level integer DEFAULT 0 NOT NULL,
        sort_order integer DEFAULT 0 NOT NULL,
        FOREIGN KEY (campus_id) REFERENCES campuses(id) ON UPDATE no action ON DELETE cascade,
        FOREIGN KEY (building_id) REFERENCES buildings(id) ON UPDATE no action ON DELETE cascade
      );
    `);

    if (needsCampusId) {
      // Old shape: building_id NOT NULL, no campus_id
      sqlite.exec(`
        INSERT INTO floors_new (id, campus_id, building_id, name, slug, level, sort_order)
        SELECT
          f.id,
          b.campus_id,
          f.building_id,
          f.name,
          f.slug,
          f.level,
          f.sort_order
        FROM floors f
        INNER JOIN buildings b ON b.id = f.building_id;
      `);
    } else {
      // Has campus_id but building_id still NOT NULL — copy as-is
      sqlite.exec(`
        INSERT INTO floors_new (id, campus_id, building_id, name, slug, level, sort_order)
        SELECT id, campus_id, building_id, name, slug, level, sort_order FROM floors;
      `);
    }

    sqlite.exec(`DROP TABLE floors`);
    sqlite.exec(`ALTER TABLE floors_new RENAME TO floors`);
    ensureFloorIndexes(sqlite);
    sqlite.exec(`COMMIT`);
  } catch (err) {
    sqlite.exec(`ROLLBACK`);
    throw err;
  } finally {
    sqlite.exec(`PRAGMA foreign_keys = ON`);
  }
}

function ensureFloorIndexes(sqlite: SqliteDatabase): void {
  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS floors_building_id_slug_unique
      ON floors (building_id, slug) WHERE building_id IS NOT NULL;
  `);
  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS floors_campus_id_slug_unique
      ON floors (campus_id, slug) WHERE building_id IS NULL;
  `);
}

/**
 * Create feature_media when features exists but the media table does not.
 * Existing DBs never re-run 0000_init — this is how they get the table.
 */
function ensureFeatureSortOrder(sqlite: SqliteDatabase): void {
  if (!tableExists(sqlite, "features")) return;
  if (hasColumn(sqlite, "features", "sort_order")) return;
  sqlite.exec(
    `ALTER TABLE features ADD COLUMN sort_order integer NOT NULL DEFAULT 0`,
  );
}

function ensureFeatureMediaTable(sqlite: SqliteDatabase): void {
  if (!tableExists(sqlite, "features")) {
    return;
  }
  if (tableExists(sqlite, "feature_media")) {
    return;
  }
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS feature_media (
      id text PRIMARY KEY NOT NULL,
      feature_id text NOT NULL,
      file_path text NOT NULL,
      mime_type text NOT NULL,
      size_bytes integer NOT NULL,
      created_at integer NOT NULL,
      FOREIGN KEY (feature_id) REFERENCES features(id) ON UPDATE no action ON DELETE cascade
    );
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS feature_media_feature_id_idx
      ON feature_media (feature_id);
  `);
}
