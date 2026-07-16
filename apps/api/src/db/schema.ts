import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const campuses = pgTable("campuses", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const buildings = pgTable(
  "buildings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campusId: uuid("campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [unique("buildings_campus_id_slug_unique").on(t.campusId, t.slug)]
);

export const floors = pgTable(
  "floors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    buildingId: uuid("building_id")
      .notNull()
      .references(() => buildings.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    level: integer("level").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [unique("floors_building_id_slug_unique").on(t.buildingId, t.slug)]
);

export const floorPlans = pgTable("floor_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  floorId: uuid("floor_id")
    .notNull()
    .unique()
    .references(() => floors.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  mimeType: text("mime_type").notNull(),
  width: integer("width"),
  height: integer("height"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const features = pgTable("features", {
  id: uuid("id").defaultRandom().primaryKey(),
  floorId: uuid("floor_id")
    .notNull()
    .references(() => floors.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  geometry: jsonb("geometry").notNull(),
  label: text("label"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  disabled: boolean("disabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const layerPresets = pgTable("layer_presets", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  /** Stored as string[]; seed stores full FEATURE_TYPES for "all" (no null/"*" special case in DB). */
  featureTypes: jsonb("feature_types").$type<string[]>().notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});
