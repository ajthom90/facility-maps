# Facility Safety Maps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-hosted open-source web app for interactive campus facility safety maps (Mankato & Waseca) with public pan/zoom viewing, layer presets, and an admin editor for SVG/image floor plans plus pins and polygons.

**Architecture:** npm workspaces monorepo: `apps/api` (Hono + Drizzle + Postgres) serves JSON REST and uploads; `apps/web` (React + Vite + i18next) is the public viewer and admin UI. Docker Compose runs `app` + `db`. Feature coordinates are normalized 0–1. Public reads are unauthenticated; mutations require admin session cookies.

**Tech Stack:** TypeScript, Hono, Drizzle ORM, PostgreSQL, bcryptjs, React 18, Vite, React Router 6, i18next, Vitest, Docker Compose

**Spec:** `docs/superpowers/specs/2026-07-16-facility-safety-maps-design.md`

## Global Constraints

- Hierarchy: Campus → Building → Floor only
- Floor plans: SVG preferred; PNG/JPG allowed; max upload default 20MB
- Features: point or polygon geometry; type + optional label + optional notes
- Feature type keys: `exit`, `fire_extinguisher`, `co_detector`, `hazard`, `chemical_storage`, `first_aid`, `water_shutoff`, `gas_shutoff`, `electrical_panel`, `roof_access`, `safe_haven`, `high_pressure`, `flammable_storage`
- Public view: no login; admin-only mutations
- Auth: username/password, HTTP-only session cookie, bootstrap admin from env when zero users
- i18n: default `en`; UI strings from locale files; user content single-locale strings
- Deep links: `/{campusSlug}/{buildingSlug}/{floorSlug}`
- Coordinates: normalized 0–1, origin top-left
- Deploy: Docker Compose on Linux
- License: MIT
- TDD: write failing test → implement → pass → commit per task
- YAGNI: no SSO, no marker photos, no plan version history, no offline PWA

## File Structure (target)

```
/
  package.json                 # workspaces root
  docker-compose.yml
  Dockerfile
  .env.example
  .gitignore
  LICENSE
  README.md
  apps/api/
    package.json
    tsconfig.json
    vitest.config.ts
    drizzle.config.ts
    src/
      index.ts                 # server entry, mount routes
      app.ts                   # Hono app export (for tests)
      db/
        client.ts
        schema.ts
        migrate.ts
        seed.ts
      lib/
        geometry.ts
        passwords.ts
        session.ts
        bootstrap.ts
        feature-types.ts
        env.ts
      middleware/
        require-admin.ts
        rate-limit-login.ts
      routes/
        health.ts
        campuses.ts
        floors.ts
        presets.ts
        uploads.ts
        auth.ts
        admin/
          campuses.ts
          buildings.ts
          floors.ts
          features.ts
          users.ts
          presets.ts
          plans.ts
    tests/
      geometry.test.ts
      passwords.test.ts
      health.test.ts
      public-api.test.ts
      auth.test.ts
      admin-features.test.ts
      bootstrap.test.ts
  apps/web/
    package.json
    tsconfig.json
    vite.config.ts
    index.html
    vitest.config.ts
    src/
      main.tsx
      App.tsx
      i18n.ts
      locales/en.json
      api/client.ts
      types.ts
      hooks/useLayers.ts
      components/
        LanguageSwitcher.tsx
        Layout.tsx
        LayerPanel.tsx
        FeaturePopup.tsx
        MapCanvas.tsx
        Legend.tsx
        Breadcrumb.tsx
      pages/
        HomePage.tsx
        CampusPage.tsx
        BuildingPage.tsx
        FloorMapPage.tsx
        admin/
          LoginPage.tsx
          AdminLayout.tsx
          StructurePage.tsx
          FloorEditorPage.tsx
          UsersPage.tsx
          PresetsPage.tsx
    tests/
      i18n-en.test.ts
      useLayers.test.ts
      geometry-display.test.ts
```

---

### Task 1: Monorepo scaffold, Docker, health endpoint

**Files:**
- Create: `package.json`, `.gitignore`, `.env.example`, `docker-compose.yml`, `Dockerfile`
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`
- Create: `apps/api/src/app.ts`, `apps/api/src/index.ts`, `apps/api/src/routes/health.ts`, `apps/api/src/lib/env.ts`
- Create: `apps/api/tests/health.test.ts`
- Create: `apps/web/package.json`, `apps/web/vite.config.ts`, `apps/web/tsconfig.json`, `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`

**Interfaces:**
- Produces: `createApp(): Hono` exported from `apps/api/src/app.ts`
- Produces: `GET /api/health` → `{ "status": "ok" }`
- Produces: Docker Compose services `app` and `db`

- [ ] **Step 1: Write the failing health test**

Create `apps/api/tests/health.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createApp } from "../src/app";

describe("GET /api/health", () => {
  it("returns status ok", async () => {
    const app = createApp();
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run tests/health.test.ts`  
Expected: FAIL (module or app not found)

- [ ] **Step 3: Create root workspace and API package**

Root `package.json`:

```json
{
  "name": "facility-maps",
  "private": true,
  "workspaces": ["apps/*"],
  "scripts": {
    "dev": "npm run dev -w @facility-maps/api & npm run dev -w @facility-maps/web",
    "test": "npm run test -w @facility-maps/api && npm run test -w @facility-maps/web",
    "build": "npm run build -w @facility-maps/api && npm run build -w @facility-maps/web"
  }
}
```

`apps/api/package.json` dependencies: `hono`, `@hono/node-server`, `drizzle-orm`, `postgres`, `bcryptjs`, `zod`  
devDependencies: `typescript`, `vitest`, `tsx`, `drizzle-kit`, `@types/bcryptjs`, `@types/node`

Implement:

```ts
// apps/api/src/app.ts
import { Hono } from "hono";
import { healthRoutes } from "./routes/health";

export function createApp() {
  const app = new Hono();
  app.route("/api/health", healthRoutes);
  return app;
}
```

```ts
// apps/api/src/routes/health.ts
import { Hono } from "hono";

export const healthRoutes = new Hono();
healthRoutes.get("/", (c) => c.json({ status: "ok" }));
```

```ts
// apps/api/src/index.ts
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { env } from "./lib/env";

const app = createApp();
serve({ fetch: app.fetch, port: env.PORT }, () => {
  console.log(`API listening on ${env.PORT}`);
});
```

```ts
// apps/api/src/lib/env.ts
export const env = {
  PORT: Number(process.env.PORT ?? 3000),
  DATABASE_URL: process.env.DATABASE_URL ?? "postgres://facility:facility@localhost:5432/facility_maps",
  SESSION_SECRET: process.env.SESSION_SECRET ?? "dev-only-change-me",
  ADMIN_BOOTSTRAP_USERNAME: process.env.ADMIN_BOOTSTRAP_USERNAME ?? "",
  ADMIN_BOOTSTRAP_PASSWORD: process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "",
  MAX_UPLOAD_BYTES: Number(process.env.MAX_UPLOAD_BYTES ?? 20 * 1024 * 1024),
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? "./data/uploads",
};
```

- [ ] **Step 4: Add Docker Compose, Dockerfile, .env.example, .gitignore**

`docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: facility
      POSTGRES_PASSWORD: facility
      POSTGRES_DB: facility_maps
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U facility -d facility_maps"]
      interval: 5s
      timeout: 5s
      retries: 10

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      PORT: 3000
      DATABASE_URL: postgres://facility:facility@db:5432/facility_maps
      SESSION_SECRET: ${SESSION_SECRET:-change-me-in-production}
      ADMIN_BOOTSTRAP_USERNAME: ${ADMIN_BOOTSTRAP_USERNAME:-admin}
      ADMIN_BOOTSTRAP_PASSWORD: ${ADMIN_BOOTSTRAP_PASSWORD:-changeme}
      UPLOAD_DIR: /data/uploads
    volumes:
      - uploads:/data/uploads
    depends_on:
      db:
        condition: service_healthy

volumes:
  pgdata:
  uploads:
```

`Dockerfile`: multi-stage — install workspaces, build API + web, run API which serves static web from `apps/web/dist` (static serving added in a later task if not yet; for this task API-only is fine, add a comment placeholder route).

`.env.example`:

```
SESSION_SECRET=generate-a-long-random-string
ADMIN_BOOTSTRAP_USERNAME=admin
ADMIN_BOOTSTRAP_PASSWORD=changeme
DATABASE_URL=postgres://facility:facility@localhost:5432/facility_maps
PORT=3000
MAX_UPLOAD_BYTES=20971520
```

`.gitignore`: `node_modules`, `dist`, `.env`, `data/`, coverage, OS junk.

Minimal web scaffold: Vite React TS app rendering `<h1>Facility Safety Maps</h1>`.

- [ ] **Step 5: Install deps and run health test**

Run:

```bash
npm install
cd apps/api && npx vitest run tests/health.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add package.json .gitignore .env.example docker-compose.yml Dockerfile apps/
git commit -m "chore: scaffold monorepo, Docker, and health endpoint"
```

---

### Task 2: Database schema, migrations, and seed

**Files:**
- Create: `apps/api/src/db/schema.ts`, `apps/api/src/db/client.ts`, `apps/api/src/db/migrate.ts`, `apps/api/src/db/seed.ts`
- Create: `apps/api/drizzle.config.ts`
- Create: `apps/api/src/lib/feature-types.ts`
- Modify: `apps/api/src/index.ts` (run migrate + seed/bootstrap on startup)
- Create: `apps/api/tests/schema-constants.test.ts`

**Interfaces:**
- Produces: Drizzle tables `campuses`, `buildings`, `floors`, `floor_plans`, `features`, `admin_users`, `layer_presets`
- Produces: `FEATURE_TYPES` const array and TypeScript union
- Produces: `db` client from `getDb()`
- Produces: seed campuses Mankato/Waseca + five layer presets

- [ ] **Step 1: Write failing test for feature types and preset slugs**

```ts
// apps/api/tests/schema-constants.test.ts
import { describe, it, expect } from "vitest";
import { FEATURE_TYPES, PRESET_SEEDS } from "../src/lib/feature-types";

describe("feature type catalog", () => {
  it("includes all v1 safety types", () => {
    expect(FEATURE_TYPES).toEqual(
      expect.arrayContaining([
        "exit",
        "fire_extinguisher",
        "co_detector",
        "hazard",
        "chemical_storage",
        "first_aid",
        "water_shutoff",
        "gas_shutoff",
        "electrical_panel",
        "roof_access",
        "safe_haven",
        "high_pressure",
        "flammable_storage",
      ])
    );
    expect(FEATURE_TYPES).toHaveLength(13);
  });

  it("defines required layer presets", () => {
    const slugs = PRESET_SEEDS.map((p) => p.slug);
    expect(slugs).toEqual(["all", "evacuation", "fire_response", "utilities", "hazards"]);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd apps/api && npx vitest run tests/schema-constants.test.ts`

- [ ] **Step 3: Implement feature-types and Drizzle schema**

```ts
// apps/api/src/lib/feature-types.ts
export const FEATURE_TYPES = [
  "exit",
  "fire_extinguisher",
  "co_detector",
  "hazard",
  "chemical_storage",
  "first_aid",
  "water_shutoff",
  "gas_shutoff",
  "electrical_panel",
  "roof_access",
  "safe_haven",
  "high_pressure",
  "flammable_storage",
] as const;

export type FeatureType = (typeof FEATURE_TYPES)[number];

export const PRESET_SEEDS: { slug: string; sortOrder: number; featureTypes: FeatureType[] | "*" }[] = [
  { slug: "all", sortOrder: 0, featureTypes: "*" },
  { slug: "evacuation", sortOrder: 1, featureTypes: ["exit", "safe_haven", "first_aid"] },
  {
    slug: "fire_response",
    sortOrder: 2,
    featureTypes: [
      "exit",
      "fire_extinguisher",
      "electrical_panel",
      "gas_shutoff",
      "flammable_storage",
      "hazard",
    ],
  },
  {
    slug: "utilities",
    sortOrder: 3,
    featureTypes: ["water_shutoff", "gas_shutoff", "electrical_panel", "roof_access"],
  },
  {
    slug: "hazards",
    sortOrder: 4,
    featureTypes: [
      "hazard",
      "chemical_storage",
      "flammable_storage",
      "high_pressure",
      "co_detector",
    ],
  },
];
```

Schema tables (Drizzle `pgTable`):

- `campuses`: id uuid PK defaultRandom, name text not null, slug text not null unique, sort_order int not null default 0
- `buildings`: id, campus_id FK, name, slug, sort_order; unique(campus_id, slug)
- `floors`: id, building_id FK, name, slug, level int, sort_order; unique(building_id, slug)
- `floor_plans`: id, floor_id FK unique (one active plan), file_path, mime_type, width int nullable, height int nullable, uploaded_at timestamp
- `features`: id, floor_id FK, type text, geometry jsonb, label text nullable, notes text nullable, created_at, updated_at
- `admin_users`: id, username unique, password_hash, disabled boolean default false, created_at
- `layer_presets`: id, slug unique, feature_types jsonb (string[] or store `"*"` as null meaning all), sort_order

```ts
// apps/api/src/db/client.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../lib/env";
import * as schema from "./schema";

export function createDb(url = env.DATABASE_URL) {
  const client = postgres(url);
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
```

Use `drizzle-kit generate` + `migrate` OR push SQL in `migrate.ts` with `drizzle-orm/postgres-js/migrator`. Prefer drizzle-kit migrations committed under `apps/api/drizzle/`.

Seed logic (`seed.ts`): if no campuses, insert Mankato (`mankato`) and Waseca (`waseca`). If no presets, insert `PRESET_SEEDS` (for `all`, store full `FEATURE_TYPES` array explicitly to avoid special-case ambiguity in DB).

- [ ] **Step 4: Run constants test**

Expected: PASS

- [ ] **Step 5: Apply migrations against local Postgres**

Run:

```bash
docker compose up -d db
# wait for healthy
cd apps/api && npm run db:migrate && npm run db:seed
```

Expected: tables exist; two campuses; five presets.

- [ ] **Step 6: Commit**

```bash
git add apps/api/
git commit -m "feat(api): add Postgres schema, migrations, and seed data"
```

---

### Task 3: Geometry validation library

**Files:**
- Create: `apps/api/src/lib/geometry.ts`
- Create: `apps/api/tests/geometry.test.ts`

**Interfaces:**
- Produces:

```ts
export type PointGeometry = { type: "point"; x: number; y: number };
export type PolygonGeometry = { type: "polygon"; points: [number, number][] };
export type FeatureGeometry = PointGeometry | PolygonGeometry;

export function parseGeometry(input: unknown): FeatureGeometry; // throws Zod/Error
export function isValidNormalized(n: number): boolean; // 0 <= n <= 1
```

- [ ] **Step 1: Write failing geometry tests**

```ts
import { describe, it, expect } from "vitest";
import { parseGeometry } from "../src/lib/geometry";

describe("parseGeometry", () => {
  it("accepts a normalized point", () => {
    expect(parseGeometry({ type: "point", x: 0.5, y: 0.25 })).toEqual({
      type: "point",
      x: 0.5,
      y: 0.25,
    });
  });

  it("rejects out-of-range point", () => {
    expect(() => parseGeometry({ type: "point", x: 1.2, y: 0.5 })).toThrow();
  });

  it("accepts a polygon with >= 3 points", () => {
    const g = parseGeometry({
      type: "polygon",
      points: [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
    });
    expect(g.type).toBe("polygon");
  });

  it("rejects polygon with fewer than 3 points", () => {
    expect(() =>
      parseGeometry({
        type: "polygon",
        points: [
          [0, 0],
          [1, 0],
        ],
      })
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement with Zod**

```ts
import { z } from "zod";

const unit = z.number().min(0).max(1);

export const pointGeometrySchema = z.object({
  type: z.literal("point"),
  x: unit,
  y: unit,
});

export const polygonGeometrySchema = z.object({
  type: z.literal("polygon"),
  points: z.array(z.tuple([unit, unit])).min(3),
});

export const featureGeometrySchema = z.discriminatedUnion("type", [
  pointGeometrySchema,
  polygonGeometrySchema,
]);

export type FeatureGeometry = z.infer<typeof featureGeometrySchema>;

export function parseGeometry(input: unknown): FeatureGeometry {
  return featureGeometrySchema.parse(input);
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(api): validate normalized point and polygon geometry"
```

---

### Task 4: Public read APIs (campuses, buildings, floors, presets, uploads path)

**Files:**
- Create: `apps/api/src/routes/campuses.ts`, `apps/api/src/routes/floors.ts`, `apps/api/src/routes/presets.ts`, `apps/api/src/routes/uploads.ts`
- Modify: `apps/api/src/app.ts` to accept `db` dependency / use singleton
- Create: `apps/api/tests/public-api.test.ts` (use test DB or transactional cleanup)

**Interfaces:**
- Produces:
  - `GET /api/campuses` → `{ campuses: [{ id, name, slug, sortOrder }] }`
  - `GET /api/campuses/:slug` → campus + `buildings[]`
  - `GET /api/campuses/:campusSlug/buildings/:buildingSlug` → building + `floors[]`
  - `GET /api/campuses/:campusSlug/buildings/:buildingSlug/floors/:floorSlug` → floor + `plan` + `features[]`
  - `GET /api/floors/:id` → same as floor by id
  - `GET /api/presets` → `{ presets: [{ id, slug, featureTypes, sortOrder }] }`
  - `GET /api/uploads/*` → file stream (404 if missing)

**Test setup:** Prefer Vitest global setup that runs against Docker Postgres with a dedicated test database, or use the same DB with cleanup in `beforeEach`. Document `DATABASE_URL` for tests in README later.

- [ ] **Step 1: Write failing public API tests** (seed campuses in beforeAll)

```ts
it("lists seeded campuses", async () => {
  const res = await app.request("/api/campuses");
  expect(res.status).toBe(200);
  const body = await res.json();
  const slugs = body.campuses.map((c: { slug: string }) => c.slug).sort();
  expect(slugs).toEqual(["mankato", "waseca"]);
});

it("returns 404 for unknown campus", async () => {
  const res = await app.request("/api/campuses/nope");
  expect(res.status).toBe(404);
});

it("lists layer presets including evacuation types", async () => {
  const res = await app.request("/api/presets");
  const body = await res.json();
  const evac = body.presets.find((p: { slug: string }) => p.slug === "evacuation");
  expect(evac.featureTypes).toEqual(
    expect.arrayContaining(["exit", "safe_haven", "first_aid"])
  );
});
```

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement routes with Drizzle queries**

JSON field naming: use **camelCase** in API responses (`sortOrder`, `featureTypes`, `mimeType`). Map from snake_case columns.

Floor payload shape:

```ts
{
  id, name, slug, level, sortOrder,
  plan: null | { id, url: `/api/uploads/${filePath}`, mimeType, width, height, uploadedAt },
  features: [{ id, type, geometry, label, notes, createdAt, updatedAt }]
}
```

Uploads: resolve path under `env.UPLOAD_DIR` only (reject `..` path traversal). Serve with correct Content-Type.

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(api): public campuses, floors, presets, and upload serving"
```

---

### Task 5: Password hashing, sessions, login, bootstrap admin

**Files:**
- Create: `apps/api/src/lib/passwords.ts`, `apps/api/src/lib/session.ts`, `apps/api/src/lib/bootstrap.ts`
- Create: `apps/api/src/middleware/require-admin.ts`, `apps/api/src/middleware/rate-limit-login.ts`
- Create: `apps/api/src/routes/auth.ts`
- Create: `apps/api/tests/passwords.test.ts`, `apps/api/tests/auth.test.ts`, `apps/api/tests/bootstrap.test.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/index.ts`

**Interfaces:**
- Produces:

```ts
hashPassword(plain: string): Promise<string>
verifyPassword(plain: string, hash: string): Promise<boolean>

// Cookie name: facility_maps_session
// Payload: { userId: string, username: string }
createSessionCookie(user): string  // Set-Cookie value or set via Hono helper
readSession(c): Session | null
requireAdmin middleware → 401 if missing/disabled

bootstrapAdmin(db): Promise<void>
// if user count === 0 && both bootstrap env vars non-empty → insert admin

POST /api/auth/login { username, password } → 200 { user } + Set-Cookie | 401
POST /api/auth/logout → clear cookie
GET /api/auth/me → 200 { user } | 401
```

- [ ] **Step 1: Password unit tests**

```ts
it("hashes and verifies", async () => {
  const hash = await hashPassword("secret");
  expect(hash).not.toBe("secret");
  expect(await verifyPassword("secret", hash)).toBe(true);
  expect(await verifyPassword("nope", hash)).toBe(false);
});
```

- [ ] **Step 2: Implement passwords with bcryptjs (cost 10)**

- [ ] **Step 3: Auth integration tests**

```ts
it("rejects bad login with generic error", async () => {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "x", password: "y" }),
  });
  expect(res.status).toBe(401);
  expect(await res.json()).toEqual({ error: "Invalid username or password" });
});

it("logs in bootstrap admin and returns me", async () => {
  // ensure admin exists via bootstrap or insert
  const login = await app.request("/api/auth/login", { /* admin creds */ });
  expect(login.status).toBe(200);
  const cookie = login.headers.get("set-cookie");
  const me = await app.request("/api/auth/me", { headers: { Cookie: cookie! } });
  expect(me.status).toBe(200);
});
```

Bootstrap test: empty users + env set → one user created; second call no-op.

Session implementation: signed cookie using HMAC with `SESSION_SECRET` (e.g. store `userId|expiry|signature` or use a small library). Cookie flags: `HttpOnly`, `Path=/`, `SameSite=Lax`; `Secure` when `NODE_ENV=production`.

Rate limit: in-memory map IP → timestamps; max 20 attempts / 15 minutes; return 429.

- [ ] **Step 4: Run all auth-related tests — PASS**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(api): admin session auth and bootstrap user"
```

---

### Task 6: Admin hierarchy CRUD + floor plan upload

**Files:**
- Create: `apps/api/src/routes/admin/campuses.ts`, `buildings.ts`, `floors.ts`, `plans.ts`
- Create: `apps/api/tests/admin-hierarchy.test.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Produces (all require admin session):
  - `POST/PATCH/DELETE /api/admin/campuses`
  - `POST/PATCH/DELETE /api/admin/buildings` (body includes `campusId`)
  - `POST/PATCH/DELETE /api/admin/floors` (body includes `buildingId`, `slug`, `name`, `level?`)
  - `POST /api/admin/floors/:id/plan` multipart field `file`

Slug rules: lowercase, `[a-z0-9]+(?:-[a-z0-9]+)*`, generate from name if omitted.

Upload: allow `image/svg+xml`, `image/png`, `image/jpeg`; enforce `MAX_UPLOAD_BYTES`; write to `UPLOAD_DIR/{floorId}/{uuid}.ext`; upsert `floor_plans` row for floor.

- [ ] **Step 1: Write failing tests** — create building under mankato without auth → 401; with auth → 201; upload tiny PNG → plan URL works on public floor GET

- [ ] **Step 2: Implement routes**

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(api): admin hierarchy CRUD and floor plan upload"
```

---

### Task 7: Admin features CRUD + users + presets

**Files:**
- Create: `apps/api/src/routes/admin/features.ts`, `users.ts`, `presets.ts`
- Create: `apps/api/tests/admin-features.test.ts`

**Interfaces:**
- `POST /api/admin/features` body: `{ floorId, type, geometry, label?, notes? }`
- `PATCH /api/admin/features/:id`
- `DELETE /api/admin/features/:id`
- Validate `type` ∈ FEATURE_TYPES; `geometry` via `parseGeometry`
- `GET/POST /api/admin/users`, `PATCH /api/admin/users/:id` (disable, password)
- `PATCH /api/admin/presets/:id` body: `{ featureTypes: string[] }`

- [ ] **Step 1: Failing tests** — create point feature; create polygon; reject bad geometry; list users; patch preset

- [ ] **Step 2: Implement**

- [ ] **Step 3: PASS + commit**

```bash
git commit -am "feat(api): admin features, users, and preset updates"
```

---

### Task 8: Web i18n shell, API client, public navigation pages

**Files:**
- Create: `apps/web/src/i18n.ts`, `apps/web/src/locales/en.json`, `apps/web/src/api/client.ts`, `apps/web/src/types.ts`
- Create: `apps/web/src/components/Layout.tsx`, `LanguageSwitcher.tsx`, `Breadcrumb.tsx`
- Create: `apps/web/src/pages/HomePage.tsx`, `CampusPage.tsx`, `BuildingPage.tsx`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/main.tsx`, `apps/web/vite.config.ts` (proxy `/api` → API)
- Create: `apps/web/tests/i18n-en.test.ts`

**Interfaces:**
- Produces: react-i18next init with `en`; `localStorage` key `facility_maps_locale`
- Produces: `api.getCampuses()`, `getCampus(slug)`, `getBuilding(campus, building)`, typed
- Routes: `/`, `/:campusSlug`, `/:campusSlug/:buildingSlug`

**en.json keys (minimum):**

```json
{
  "appTitle": "Facility Safety Maps",
  "campuses": "Campuses",
  "buildings": "Buildings",
  "floors": "Floors",
  "emptyBuildings": "No buildings published",
  "emptyFloors": "No floors published",
  "emptyPlan": "Map not available yet",
  "emptyFeatures": "No safety features on this floor yet",
  "admin": "Admin",
  "layers": "Layers",
  "presets": {
    "all": "All",
    "evacuation": "Evacuation",
    "fire_response": "Fire response",
    "utilities": "Utilities",
    "hazards": "Hazards"
  },
  "featureTypes": {
    "exit": "Exit",
    "fire_extinguisher": "Fire extinguisher",
    "co_detector": "CO detector",
    "hazard": "Hazard",
    "chemical_storage": "Chemical storage",
    "first_aid": "First aid",
    "water_shutoff": "Water shutoff",
    "gas_shutoff": "Gas shutoff",
    "electrical_panel": "Electrical panel",
    "roof_access": "Roof access",
    "safe_haven": "Safe haven",
    "high_pressure": "High pressure area",
    "flammable_storage": "Flammable storage"
  },
  "login": "Log in",
  "logout": "Log out",
  "username": "Username",
  "password": "Password",
  "saved": "Saved",
  "label": "Label",
  "notes": "Notes"
}
```

- [ ] **Step 1: Test that en.json contains every FEATURE_TYPES key under `featureTypes` and every preset slug under `presets`**

- [ ] **Step 2: Implement i18n + pages + vite proxy**

`vite.config.ts` server proxy: `"/api" → "http://localhost:3000"`.

HomePage: fetch campuses, show cards linking to `/${slug}`.

- [ ] **Step 3: Manual smoke — `npm run dev` both apps, open home, see Mankato & Waseca**

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(web): i18n shell and campus navigation"
```

---

### Task 9: Map canvas pan/zoom + floor map page + feature rendering + layers

**Files:**
- Create: `apps/web/src/components/MapCanvas.tsx`, `LayerPanel.tsx`, `FeaturePopup.tsx`, `Legend.tsx`
- Create: `apps/web/src/hooks/useLayers.ts`
- Create: `apps/web/src/pages/FloorMapPage.tsx`
- Create: `apps/web/tests/useLayers.test.ts`
- Modify: `App.tsx` route `/:campusSlug/:buildingSlug/:floorSlug`

**Interfaces:**
- `useLayers(presets, allTypes)` → `{ activeTypes: Set<string>, applyPreset(slug), toggleType(type), activePresetSlug }`
- `MapCanvas` props: `{ planUrl, mimeType, features, visibleTypes, onSelectFeature }`
- Rendering: image or inline/object SVG as base layer; overlay SVG absolute same aspect box; points as icons at `left: x*100%`, `top: y*100%`; polygons as SVG `<polygon points=...>` in viewBox `0 0 1 1`
- Pan/zoom: CSS transform on container; wheel zoom; pointer drag; pinch via touch events (or use `@panzoom/panzoom` dependency — allowed)

- [ ] **Step 1: Unit test useLayers**

```ts
it("applies evacuation preset types", () => {
  const { result } = renderHook(() => useLayers(presets, FEATURE_TYPES));
  act(() => result.current.applyPreset("evacuation"));
  expect([...result.current.activeTypes].sort()).toEqual(
    ["exit", "first_aid", "safe_haven"].sort()
  );
});
```

- [ ] **Step 2: Implement hook, MapCanvas, FloorMapPage, LayerPanel (bottom sheet on narrow screens)**

- [ ] **Step 3: Manual test with a sample SVG uploaded via API/curl and a few features**

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(web): floor map pan/zoom, markers, and layer presets"
```

---

### Task 10: Admin UI — login, structure, plan upload, map editor

**Files:**
- Create: `apps/web/src/pages/admin/LoginPage.tsx`, `AdminLayout.tsx`, `StructurePage.tsx`, `FloorEditorPage.tsx`
- Modify: `apps/web/src/api/client.ts` (credentials: `include` for cookie auth)
- Modify: `App.tsx` routes under `/admin/*`

**Interfaces:**
- Login form → `POST /api/auth/login` with credentials include
- StructurePage: nested lists CRUD for campus/building/floor
- FloorEditorPage:
  - file input upload plan
  - tools: select | pin | polygon
  - type select
  - click map → create pin at normalized coords
  - polygon: click vertices, double-click or "Complete" to finish
  - edit panel: label, notes, type, delete
  - autosave: PATCH/POST on each change; show `t('saved')`

Coordinate conversion: from click offset within plan element → `x = offsetX / width`, `y = offsetY / height`, clamp 0–1.

- [ ] **Step 1: Implement login + route guard (redirect to login if `/api/auth/me` 401)**

- [ ] **Step 2: Structure CRUD wired to admin API**

- [ ] **Step 3: Floor editor tools + autosave**

- [ ] **Step 4: Manual end-to-end: login → create building/floor → upload SVG → place pin + polygon → open public floor URL → see features → filter Fire response**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(web): admin login, structure management, and map editor"
```

---

### Task 11: Admin users page, presets page, serve static UI from API in Docker

**Files:**
- Create: `apps/web/src/pages/admin/UsersPage.tsx`, `PresetsPage.tsx`
- Modify: `apps/api/src/app.ts` — serve `apps/web/dist` in production with SPA fallback
- Modify: `Dockerfile` — build web + api, copy dist
- Modify: `README.md`, `LICENSE`

**Interfaces:**
- Users: list, create username/password, disable toggle
- Presets: edit multiselect of feature types; save PATCH
- Production: `GET /` serves web; `GET /api/*` API

- [ ] **Step 1: Implement users and presets admin pages**

- [ ] **Step 2: Static file serving in Hono when `WEB_DIST` env set**

```ts
import { serveStatic } from "@hono/node-server/serve-static";
// mount after API routes; SPA fallback to index.html
```

- [ ] **Step 3: `docker compose up --build` smoke — health, login, public home**

- [ ] **Step 4: Write README** — features, quick start, env vars, adding a language (`apps/web/src/locales/xx.json`), backup (`pg_dump` + uploads volume), license MIT

- [ ] **Step 5: Add MIT LICENSE**

- [ ] **Step 6: Commit**

```bash
git commit -am "feat: admin users/presets, production Docker image, README"
```

---

### Task 12: Hardening, empty states, and final verification

**Files:**
- Modify: empty-state copy on public pages (already keyed)
- Modify: rate limit + upload validation edge cases if gaps found
- Create: `apps/api/tests/upload-security.test.ts` (path traversal rejected)

- [ ] **Step 1: Test path traversal on uploads returns 404/400**

```ts
const res = await app.request("/api/uploads/../../etc/passwd");
expect([400, 403, 404]).toContain(res.status);
```

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected: all PASS

- [ ] **Step 3: Manual checklist against success criteria in spec §1**

1. Phone-width browser: home → campus → building → floor; apply Evacuation preset  
2. Admin: SVG upload, pin, safe_haven polygon with notes, public view updates  
3. `docker compose up` on clean state with bootstrap env works  

- [ ] **Step 4: Final commit**

```bash
git commit -am "chore: security checks, empty states, and verification polish"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task(s) |
|------------------|---------|
| Campus → Building → Floor | 2, 4, 6, 8, 10 |
| Mankato & Waseca seed | 2 |
| SVG + PNG/JPG plans | 6, 9, 10 |
| Points + polygons, label, notes | 3, 7, 9, 10 |
| All 13 feature types | 2, 8 |
| Layer toggles + presets | 2, 4, 9, 11 |
| Open public view | 4, 8, 9 |
| Admin auth + bootstrap | 5, 10 |
| i18n English default | 8 |
| Docker Compose | 1, 11, 12 |
| Deep links | 8, 9 |
| Normalized coordinates | 3, 7, 9, 10 |
| Admin users + preset edit | 7, 11 |
| MIT + README | 11 |
| No SSO/photos/versioning | Out of scope — not planned |

**Deferred implementation choices (locked here):** Hono, Drizzle, bcryptjs, Vite React, i18next, Vitest, signed session cookie.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-16-facility-safety-maps.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration  
2. **Inline Execution** — execute tasks in this session with executing-plans and checkpoints  

Which approach?
