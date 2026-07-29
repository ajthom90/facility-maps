/**
 * Admin hierarchy CRUD + floor plan upload integration tests.
 *
 * Uses a temp SQLite file (no external DB).
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
  adminUsers,
  buildings,
  campuses,
  floorPlans,
  floors,
} from "../src/db/schema.js";
import { hashPassword } from "../src/lib/passwords.js";
import { makeTestSqlitePath } from "./test-db.js";

const SQLITE_PATH = makeTestSqlitePath("admin-hierarchy");

const TEST_USERNAME = "hierarchy-test-admin";
const TEST_PASSWORD = "hierarchy-test-password-99";

/** Minimal valid 1×1 PNG */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

function cookieHeaderFromSetCookie(setCookie: string | null): string {
  if (!setCookie) throw new Error("expected Set-Cookie header");
  return setCookie.split(";")[0]!;
}

describe("admin hierarchy CRUD + plan upload", () => {
  let db: Db;
  let app: ReturnType<typeof createApp>;
  let uploadDir: string;
  let cookie: string;
  let campusId: string;
  let campusSlug: string;
  let createdBuildingIds: string[] = [];
  let createdFloorIds: string[] = [];
  let createdCampusIds: string[] = [];
  /** Floor that received a plan upload (for upsert test). */
  let plannedFloorId: string | null = null;

  beforeAll(async () => {
    runMigrations(SQLITE_PATH);
    db = createDb(SQLITE_PATH);
    await seed(db);

    uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), "fm-admin-uploads-"));

    const passwordHash = await hashPassword(TEST_PASSWORD);
    const existing = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, TEST_USERNAME))
      .limit(1);
    if (existing[0]) {
      await db
        .update(adminUsers)
        .set({ passwordHash, disabled: false })
        .where(eq(adminUsers.id, existing[0].id));
    } else {
      await db.insert(adminUsers).values({
        username: TEST_USERNAME,
        passwordHash,
        disabled: false,
      });
    }

    const [campus] = await db
      .insert(campuses)
      .values({ name: "Hierarchy Test Campus", slug: "hierarchy-test-campus", sortOrder: 0 })
      .returning();
    campusId = campus.id;
    campusSlug = campus.slug;
    createdCampusIds.push(campus.id);

    app = createApp({ db, uploadDir });

    const login = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: TEST_USERNAME, password: TEST_PASSWORD }),
    });
    expect(login.status).toBe(200);
    cookie = cookieHeaderFromSetCookie(login.headers.get("set-cookie"));
  });

  afterAll(async () => {
    for (const id of createdFloorIds) {
      await db.delete(floors).where(eq(floors.id, id));
    }
    for (const id of createdBuildingIds) {
      await db.delete(buildings).where(eq(buildings.id, id));
    }
    for (const id of createdCampusIds) {
      await db.delete(campuses).where(eq(campuses.id, id));
    }
    await db.delete(adminUsers).where(eq(adminUsers.username, TEST_USERNAME));
    if (uploadDir) {
      await fs.rm(uploadDir, { recursive: true, force: true });
    }
  });

  it("creates single_map campus with auto site-map floor", async () => {
    const res = await app.request("/api/admin/campuses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        name: "Single Site",
        hierarchyMode: "single_map",
      }),
    });
    expect(res.status).toBe(201);
    const campus = await res.json();
    expect(campus.hierarchyMode).toBe("single_map");
    createdCampusIds.push(campus.id);

    const publicRes = await app.request(`/api/campuses/${campus.slug}`);
    expect(publicRes.status).toBe(200);
    const body = await publicRes.json();
    expect(body.mapFloorId).toBeTruthy();
    expect(body.floors).toHaveLength(1);
    expect(body.floors[0].slug).toBe("map");
  });

  it("creates no_buildings campus and campus-level floor", async () => {
    const campusRes = await app.request("/api/admin/campuses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        name: "Flat Campus",
        hierarchyMode: "no_buildings",
      }),
    });
    expect(campusRes.status).toBe(201);
    const campus = await campusRes.json();
    expect(campus.hierarchyMode).toBe("no_buildings");
    createdCampusIds.push(campus.id);

    const floorRes = await app.request("/api/admin/floors", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        campusId: campus.id,
        name: "Level 1",
      }),
    });
    expect(floorRes.status).toBe(201);
    const floor = await floorRes.json();
    expect(floor.campusId).toBe(campus.id);
    expect(floor.buildingId).toBeNull();
    createdFloorIds.push(floor.id);

    const buildingRes = await app.request("/api/admin/buildings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({ campusId: campus.id, name: "Should Fail" }),
    });
    expect(buildingRes.status).toBe(400);
  });

  it("rejects unauthenticated building create with 401", async () => {
    const res = await app.request("/api/admin/buildings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campusId: campusId,
        name: "Unauthed Hall",
        slug: "unauthed-hall",
      }),
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("creates a building under the test campus with auth → 201", async () => {
    const res = await app.request("/api/admin/buildings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        campusId: campusId,
        name: "Science Hall",
        // slug omitted — generated from name
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      id: expect.any(String),
      campusId: campusId,
      name: "Science Hall",
      slug: "science-hall",
      sortOrder: 0,
    });
    createdBuildingIds.push(body.id);

    // Visible on public campus tree
    const campusRes = await app.request(`/api/campuses/${campusSlug}`);
    expect(campusRes.status).toBe(200);
    const campusBody = await campusRes.json();
    expect(campusBody.buildings.some((b: { slug: string }) => b.slug === "science-hall")).toBe(
      true
    );
  });

  it("creates floor, uploads tiny PNG, public floor shows plan URL", async () => {
    const buildingId = createdBuildingIds[0];
    expect(buildingId).toBeTruthy();

    const floorRes = await app.request("/api/admin/floors", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        buildingId,
        name: "Floor 1",
        slug: "floor-1",
        level: 1,
      }),
    });
    expect(floorRes.status).toBe(201);
    const floor = await floorRes.json();
    expect(floor).toMatchObject({
      id: expect.any(String),
      buildingId,
      name: "Floor 1",
      slug: "floor-1",
      level: 1,
    });
    createdFloorIds.push(floor.id);
    plannedFloorId = floor.id;

    const form = new FormData();
    form.append(
      "file",
      new File([TINY_PNG], "plan.png", { type: "image/png" })
    );

    const uploadRes = await app.request(`/api/admin/floors/${floor.id}/plan`, {
      method: "POST",
      headers: { Cookie: cookie },
      body: form,
    });
    expect(uploadRes.status).toBe(201);
    const plan = await uploadRes.json();
    expect(plan).toMatchObject({
      id: expect.any(String),
      floorId: floor.id,
      mimeType: "image/png",
      url: expect.stringMatching(new RegExp(`^/api/uploads/${floor.id}/[\\w-]+\\.png$`)),
    });
    expect(plan.filePath).toMatch(new RegExp(`^${floor.id}/[\\w-]+\\.png$`));

    // File exists on disk under uploadDir/{floorId}/
    const abs = path.join(uploadDir, plan.filePath);
    const data = await fs.readFile(abs);
    expect(data[0]).toBe(0x89);

    // Public floor GET includes plan URL
    const publicRes = await app.request(`/api/floors/${floor.id}`);
    expect(publicRes.status).toBe(200);
    const publicBody = await publicRes.json();
    expect(publicBody.plan).toMatchObject({
      id: plan.id,
      url: plan.url,
      mimeType: "image/png",
    });

    // Upload is fetchable
    const fileRes = await app.request(plan.url);
    expect(fileRes.status).toBe(200);
    expect(fileRes.headers.get("content-type")).toMatch(/image\/png/);
  });

  it("upserts plan on second upload", async () => {
    const floorId = plannedFloorId;
    expect(floorId).toBeTruthy();

    const [before] = await db
      .select()
      .from(floorPlans)
      .where(eq(floorPlans.floorId, floorId))
      .limit(1);
    expect(before).toBeTruthy();

    const form = new FormData();
    form.append(
      "file",
      new File([TINY_PNG], "plan2.png", { type: "image/png" })
    );

    const uploadRes = await app.request(`/api/admin/floors/${floorId}/plan`, {
      method: "POST",
      headers: { Cookie: cookie },
      body: form,
    });
    expect(uploadRes.status).toBe(201);
    const plan = await uploadRes.json();
    expect(plan.id).toBe(before!.id); // same row upserted
    expect(plan.filePath).not.toBe(before!.filePath);

    const rows = await db
      .select()
      .from(floorPlans)
      .where(eq(floorPlans.floorId, floorId));
    expect(rows).toHaveLength(1);
  });

  it("supports campus create/patch/delete and rejects unauth plan upload", async () => {
    const unauthPlan = await app.request(
      `/api/admin/floors/00000000-0000-0000-0000-000000000001/plan`,
      {
        method: "POST",
        body: (() => {
          const form = new FormData();
          form.append("file", new File([TINY_PNG], "x.png", { type: "image/png" }));
          return form;
        })(),
      }
    );
    expect(unauthPlan.status).toBe(401);

    const create = await app.request("/api/admin/campuses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ name: "Test Campus X", sortOrder: 99 }),
    });
    expect(create.status).toBe(201);
    const campus = await create.json();
    expect(campus.slug).toBe("test-campus-x");
    createdCampusIds.push(campus.id);

    const patch = await app.request(`/api/admin/campuses/${campus.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ name: "Test Campus Renamed" }),
    });
    expect(patch.status).toBe(200);
    expect((await patch.json()).name).toBe("Test Campus Renamed");

    const del = await app.request(`/api/admin/campuses/${campus.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(del.status).toBe(200);
    createdCampusIds = createdCampusIds.filter((id) => id !== campus.id);
  });
});
