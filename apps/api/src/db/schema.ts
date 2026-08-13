import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/** Application-level UUID (text). Generated in JS when omitted on insert. */
function idColumn() {
  return text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
}

function createdAtColumn() {
  return integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());
}

export const campuses = sqliteTable("campuses", {
  id: idColumn(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  /**
   * full | no_buildings | single_map
   * Controls public navigation and where floors attach.
   */
  hierarchyMode: text("hierarchy_mode").notNull().default("full"),
});

export const buildings = sqliteTable(
  "buildings",
  {
    id: idColumn(),
    campusId: text("campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [unique("buildings_campus_id_slug_unique").on(t.campusId, t.slug)],
);

export const floors = sqliteTable(
  "floors",
  {
    id: idColumn(),
    campusId: text("campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "cascade" }),
    /** Set in full mode; null for no_buildings / single_map. */
    buildingId: text("building_id").references(() => buildings.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    level: integer("level").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    uniqueIndex("floors_building_id_slug_unique")
      .on(t.buildingId, t.slug)
      .where(sql`${t.buildingId} is not null`),
    uniqueIndex("floors_campus_id_slug_unique")
      .on(t.campusId, t.slug)
      .where(sql`${t.buildingId} is null`),
  ],
);

export const floorPlans = sqliteTable("floor_plans", {
  id: idColumn(),
  floorId: text("floor_id")
    .notNull()
    .unique()
    .references(() => floors.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  mimeType: text("mime_type").notNull(),
  width: integer("width"),
  height: integer("height"),
  uploadedAt: integer("uploaded_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const features = sqliteTable("features", {
  id: idColumn(),
  floorId: text("floor_id")
    .notNull()
    .references(() => floors.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  /** Point or polygon geometry (JSON). */
  geometry: text("geometry", { mode: "json" }).notNull(),
  label: text("label"),
  notes: text("notes"),
  /** Higher paints on top of lower. */
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAtColumn(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

export const featureMedia = sqliteTable("feature_media", {
  id: idColumn(),
  featureId: text("feature_id")
    .notNull()
    .references(() => features.id, { onDelete: "cascade" }),
  /** Relative path with forward slashes, like floor_plans.file_path. */
  filePath: text("file_path").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: createdAtColumn(),
});

export const adminUsers = sqliteTable("admin_users", {
  id: idColumn(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  disabled: integer("disabled", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAtColumn(),
});

export const layerPresets = sqliteTable("layer_presets", {
  id: idColumn(),
  slug: text("slug").notNull().unique(),
  /** Stored as JSON array of feature type strings. */
  featureTypes: text("feature_types", { mode: "json" }).$type<string[]>().notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});
