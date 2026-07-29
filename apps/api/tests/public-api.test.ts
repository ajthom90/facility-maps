/**
 * Public read API integration tests.
 *
 * Uses a temp SQLite file (no external DB).
 *   SQLITE_PATH=/tmp/facility-maps-test.sqlite
 *
 * Migrations + seed run in beforeAll when missing data.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { createApp } from "../src/app.js";
import { createDb, type Db } from "../src/db/client.js";
import { runMigrations } from "../src/db/migrate.js";
import { seed } from "../src/db/seed.js";
import {
  buildings,
  campuses,
  features,
  floorPlans,
  floors,
} from "../src/db/schema.js";
import { makeTestSqlitePath } from "./test-db.js";

const SQLITE_PATH = makeTestSqlitePath("public-api");

describe("public APIs", () => {
  let db: Db;
  let app: ReturnType<typeof createApp>;
  let uploadDir: string;
  let campusSlug: string;
  let buildingSlug: string;
  let floorSlug: string;
  let floorId: string;
  let planRelativePath: string;

  beforeAll(async () => {
    runMigrations(SQLITE_PATH);
    db = createDb(SQLITE_PATH);
    await seed(db);

    uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), "fm-uploads-"));
    planRelativePath = "plans/test-plan.png";
    const planAbs = path.join(uploadDir, planRelativePath);
    await fs.mkdir(path.dirname(planAbs), { recursive: true });
    await fs.writeFile(planAbs, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

    // Create a disposable campus hierarchy for public-read tests
    const [campus] = await db
      .insert(campuses)
      .values({ name: "Test Campus Alpha", slug: "test-campus-alpha", sortOrder: 0 })
      .returning();
    campusSlug = campus.slug;

    const [building] = await db
      .insert(buildings)
      .values({ campusId: campus.id, name: "Main Hall", slug: "main-hall", sortOrder: 0 })
      .returning();
    buildingSlug = building.slug;

    const [floor] = await db
      .insert(floors)
      .values({
        buildingId: building.id,
        name: "Floor 1",
        slug: "floor-1",
        level: 1,
        sortOrder: 0,
      })
      .returning();
    floorSlug = floor.slug;
    floorId = floor.id;

    await db.insert(floorPlans).values({
      floorId: floor.id,
      filePath: planRelativePath,
      mimeType: "image/png",
      width: 100,
      height: 80,
    });

    await db.insert(features).values({
      floorId: floor.id,
      type: "exit",
      geometry: { type: "point", x: 0.5, y: 0.5 },
      label: "Main exit",
      notes: null,
    });

    app = createApp({ db, uploadDir });
  });

  afterAll(async () => {
    if (uploadDir) {
      await fs.rm(uploadDir, { recursive: true, force: true });
    }
  });

  it("lists campuses including the test campus", async () => {
    const res = await app.request("/api/campuses");
    expect(res.status).toBe(200);
    const body = await res.json();
    const slugs = body.campuses.map((c: { slug: string }) => c.slug);
    expect(slugs).toContain(campusSlug);
    expect(body.campuses[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      slug: expect.any(String),
      sortOrder: expect.any(Number),
    });
  });

  it("returns 404 for unknown campus", async () => {
    const res = await app.request("/api/campuses/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: expect.any(String) });
  });

  it("returns campus with buildings", async () => {
    const res = await app.request(`/api/campuses/${campusSlug}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBe(campusSlug);
    expect(body.sortOrder).toEqual(expect.any(Number));
    expect(Array.isArray(body.buildings)).toBe(true);
    expect(body.buildings.some((b: { slug: string }) => b.slug === buildingSlug)).toBe(true);
  });

  it("returns building with floors", async () => {
    const res = await app.request(
      `/api/campuses/${campusSlug}/buildings/${buildingSlug}`
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBe(buildingSlug);
    expect(Array.isArray(body.floors)).toBe(true);
    expect(body.floors.some((f: { slug: string }) => f.slug === floorSlug)).toBe(true);
  });

  it("returns 404 for unknown building", async () => {
    const res = await app.request(`/api/campuses/${campusSlug}/buildings/nope`);
    expect(res.status).toBe(404);
  });

  it("returns floor with plan and features by nested path", async () => {
    const res = await app.request(
      `/api/campuses/${campusSlug}/buildings/${buildingSlug}/floors/${floorSlug}`
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      id: floorId,
      slug: floorSlug,
      level: expect.any(Number),
      sortOrder: expect.any(Number),
    });
    expect(body.plan).toMatchObject({
      id: expect.any(String),
      url: `/api/uploads/${planRelativePath}`,
      mimeType: "image/png",
      width: 100,
      height: 80,
    });
    expect(body.features.length).toBeGreaterThanOrEqual(1);
    expect(body.features[0]).toMatchObject({
      id: expect.any(String),
      type: expect.any(String),
      geometry: expect.any(Object),
    });
  });

  it("returns same floor payload by id", async () => {
    const res = await app.request(`/api/floors/${floorId}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(floorId);
    expect(body.plan?.url).toBe(`/api/uploads/${planRelativePath}`);
  });

  it("returns 404 for unknown floor id", async () => {
    const res = await app.request(
      "/api/floors/00000000-0000-0000-0000-000000000000"
    );
    expect(res.status).toBe(404);
  });

  it("lists layer presets including evacuation and medical types", async () => {
    const res = await app.request("/api/presets");
    expect(res.status).toBe(200);
    const body = await res.json();
    const slugs = body.presets.map((p: { slug: string }) => p.slug);
    expect(slugs).toEqual(
      expect.arrayContaining([
        "all",
        "evacuation",
        "fire_response",
        "medical",
        "spill_chemical",
        "utilities",
        "hazards",
      ])
    );

    const evac = body.presets.find((p: { slug: string }) => p.slug === "evacuation");
    expect(evac).toBeTruthy();
    expect(evac.featureTypes).toEqual(
      expect.arrayContaining([
        "exit",
        "assembly_point",
        "safe_haven",
        "emergency_phone",
        "first_aid",
        "aed",
      ])
    );
    expect(evac).toMatchObject({
      id: expect.any(String),
      slug: "evacuation",
      sortOrder: expect.any(Number),
    });

    const medical = body.presets.find((p: { slug: string }) => p.slug === "medical");
    expect(medical).toBeTruthy();
    expect(medical.featureTypes).toEqual(
      expect.arrayContaining(["aed", "first_aid", "eye_wash", "safety_shower"])
    );
  });

  it("serves upload files with content type", async () => {
    const res = await app.request(`/api/uploads/${planRelativePath}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/image\/png/);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf[0]).toBe(0x89);
  });

  it("returns 404 for missing upload", async () => {
    const res = await app.request("/api/uploads/missing/file.png");
    expect(res.status).toBe(404);
  });

  it("rejects path traversal on uploads", async () => {
    const res = await app.request("/api/uploads/../../etc/passwd");
    expect(res.status).toBe(404);
  });
});
