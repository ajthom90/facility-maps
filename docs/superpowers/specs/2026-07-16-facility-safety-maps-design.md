# Facility Safety Maps — Design Spec

**Date:** 2026-07-16  
**Status:** Approved for implementation planning  
**Product name:** Facility Safety Maps  
**License (intended):** MIT  

## 1. Problem and goals

Internal web application for multi-campus facility floor maps with safety-related features for emergency awareness and response. Staff browse without logging in. Admins create campuses and upload floor plans and place safety points and areas.

### Success criteria

1. Staff open the site on a phone, reach a floor map in a few taps, and filter to presets such as “Evacuation” or “Fire response.”
2. An admin uploads an SVG, places pins and a safe-haven polygon with notes, saves, and the public view updates immediately.
3. A clean Linux host can run the stack with `docker compose up`, env vars, and a bootstrap admin account.

## 2. Users and access

| Role | Access |
|------|--------|
| **Anyone on the internal network** | View all campuses, buildings, floors, plans, and features. No login. |
| **Admin** | Log in to manage hierarchy, upload plans, place/edit features, manage admin users and layer presets. |

Authentication is only for admin editing. There is no end-user login for viewing.

## 3. Scope

### In v1

- Hierarchy: **Campus → Building → Floor**
- Floor plans: **SVG preferred**, PNG/JPG fallback
- Features: **points (pins)** and **polygons (regions)** with type, optional label, optional notes
- Layer **type toggles** and **seeded presets** (All, Evacuation, Fire response, Medical, Spill/chemical, Utilities, Hazards)
- Public viewer (mobile-first) + admin editor
- Admin auth: username/password, session cookies, **bootstrap admin from environment** when no users exist
- **i18n/l10n**: English complete by default; structure ready for additional locale files
- Deploy: **Docker Compose** on internal Linux
- Open-source GitHub project (README, license, `.env.example`)

### Out of v1

- SSO / Active Directory / Entra ID
- Marker photos; formal inspection/work-order asset management
- Floor-plan version history
- Offline-first PWA package
- Indoor turn-by-turn routing
- Multi-language **user-generated** content (campus/building names and notes remain single-string as entered)
- Multi-tenant SaaS packaging (the data model still allows more than two campuses)

## 4. Architecture

One Docker Compose stack:

```
[Browser: phone / desktop]
          │
          ▼
┌─────────────────────────────┐
│  App container              │
│  • Public map viewer        │
│  • Admin editor (auth)      │
│  • REST API                 │
└───────────┬─────────────────┘
            │
     ┌──────┴──────┐
     ▼             ▼
 Postgres      File volume
 (metadata)    (floor plans)
```

### Technology choices

| Layer | Choice | Rationale |
|-------|--------|-----------|
| UI | React (Vite) + TypeScript | Mobile-friendly SPA, strong ecosystem |
| Map surface | Pan/zoom over SVG or image (custom or Leaflet image overlay) | Floor plans are not geographic maps |
| API | Node (Fastify or Hono) + TypeScript | Same language as UI; simple Docker image |
| DB | SQLite (file on data volume) | Single-container deploy; easy host migration via volumes |
| Auth | HTTP-only session cookie; bcrypt (or argon2) password hashes | Matches internal simple-admin needs |
| i18n | Client (and admin) message catalogs, e.g. `en.json` | Default English; add locales by file |
| Deploy | Docker Compose: `app` + `db` + volumes | Internal Linux hosting |

Coordinates for all features are **normalized 0–1** relative to the floor plan (origin top-left) so zoom and plan replacement (same aspect) keep markers aligned.

### Repository layout (indicative)

```
/
  apps/web/          # React viewer + admin UI
  apps/api/          # REST API (or monorepo packages/)
  docker-compose.yml
  .env.example
  README.md
  LICENSE
  docs/superpowers/specs/
```

A single combined app process serving static UI + API is acceptable for v1 if it simplifies ops.

## 5. Data model

```
Campus
  └── Building
        └── Floor
              ├── FloorPlan (file + metadata)
              └── Feature[] (pins & polygons)
```

### Entities

#### Campus

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| name | string | Display name |
| slug | string | URL segment, unique |
| sort_order | int | Navigation order |

Campuses are **not** pre-seeded; admins create them via the admin UI.

#### Building

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| campus_id | UUID | FK |
| name | string | |
| slug | string | Unique within campus |
| sort_order | int | |

#### Floor

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| building_id | UUID | FK |
| name | string | e.g. "Floor 2" |
| slug | string | Unique within building; used in deep links |
| level | int | Optional numeric level for sorting |
| sort_order | int | |

#### FloorPlan

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| floor_id | UUID | FK; one **active** plan per floor in v1 |
| file_path | string | Path on uploads volume |
| mime_type | string | `image/svg+xml`, `image/png`, `image/jpeg` |
| width | int | Optional intrinsic/display width |
| height | int | Optional intrinsic/display height |
| uploaded_at | timestamp | |

Replacing a plan overwrites the active file reference. Features are retained in normalized coordinates. If aspect ratio changes substantially, admin UI should warn that markers may need adjustment.

#### Feature

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| floor_id | UUID | FK |
| type | enum string | See feature types below |
| geometry | JSON | Point or polygon |
| label | string, optional | Short display label |
| notes | string, optional | Free text |
| created_at | timestamp | |
| updated_at | timestamp | |

**Geometry formats:**

```json
{ "type": "point", "x": 0.42, "y": 0.61 }

{ "type": "polygon", "points": [[0.1, 0.2], [0.3, 0.2], [0.3, 0.4], [0.1, 0.4]] }
```

- Equipment-style types default to **point**.
- Area-style types (`safe_haven`, `high_pressure`, and optionally storage/hazard) support **polygon**; admin may still use a pin when appropriate.

#### Feature types (AWAIR-oriented catalog)

| Key | Typical geometry | Category |
|-----|------------------|----------|
| `exit` | point | Life safety |
| `assembly_point` | point | Life safety |
| `safe_haven` | polygon (or point) | Life safety |
| `fire_extinguisher` | point | Fire |
| `fire_alarm_pull` | point | Fire |
| `aed` | point | Medical |
| `first_aid` | point | Medical |
| `eye_wash` | point | Medical / chemical |
| `safety_shower` | point | Medical / chemical |
| `spill_kit` | point | Chemical |
| `emergency_phone` | point | Life safety |
| `water_shutoff` | point | Utilities |
| `gas_shutoff` | point | Utilities |
| `electrical_panel` | point | Utilities |
| `loto_isolation` | point | Utilities |
| `roof_access` | point | Utilities |
| `hazard` | point or polygon | Hazards |
| `chemical_storage` | point or polygon | Hazards / right-to-know |
| `flammable_storage` | point or polygon | Hazards |
| `high_pressure` | polygon (or point) | Hazards |
| `co_detector` | point | Hazards |
| `confined_space` | point or polygon | Hazards |
| `sds_station` | point | Right-to-know |

Display names come from i18n catalogs, not from hard-coded English only in UI code.

#### AdminUser

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| username | string | Unique |
| password_hash | string | |
| disabled | boolean | Soft-disable without delete |
| created_at | timestamp | |

#### LayerPreset

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| slug | string | Stable key: `all`, `evacuation`, etc. UI label from i18n `presets.<slug>` |
| feature_types | string[] | Types included when preset is selected; empty or special-case means all types for `all` |
| sort_order | int | |

**Seeded presets:**

| slug | Feature types |
|------|----------------|
| `all` | All feature types |
| `evacuation` | `exit`, `assembly_point`, `safe_haven`, `emergency_phone`, `first_aid`, `aed` |
| `fire_response` | `exit`, `fire_extinguisher`, `fire_alarm_pull`, `electrical_panel`, `gas_shutoff`, `flammable_storage`, `hazard` |
| `medical` | `aed`, `first_aid`, `eye_wash`, `safety_shower`, `emergency_phone` |
| `spill_chemical` | `spill_kit`, `eye_wash`, `safety_shower`, `chemical_storage`, `sds_station`, `water_shutoff`, `flammable_storage` |
| `utilities` | `water_shutoff`, `gas_shutoff`, `electrical_panel`, `loto_isolation`, `roof_access` |
| `hazards` | `hazard`, `chemical_storage`, `flammable_storage`, `high_pressure`, `co_detector`, `confined_space` |

Users can start from a preset and further toggle individual types on or off in the session UI (client state; no need to persist viewer preferences in v1).

## 6. Public viewer UX

### Navigation

1. **Home** — campus cards (as published by admins)
2. **Campus** — buildings
3. **Building** — floors
4. **Floor map** — interactive plan

**Deep links:** `/{campusSlug}/{buildingSlug}/{floorSlug}` (e.g. `/north-campus/science-hall/floor-2`).

### Floor map UI

| Element | Behavior |
|---------|----------|
| Plan canvas | Pan (drag), pinch/scroll zoom; SVG remains sharp |
| Points | Type icons |
| Polygons | Translucent fill + outline, type-colored |
| Tap feature | Sheet/popup: type name (localized), label, notes |
| Layers | Preset chips + per-type toggles |
| Legend | Icons/colors for visible types |
| Header | Breadcrumb Campus › Building › Floor |

Mobile-first: large targets; layer controls as a bottom sheet on small screens; map dominates viewport.

Optional footer **Admin** link to `/admin` (no forced login chrome on public pages).

### Empty states

- No buildings: “No buildings published” (i18n)
- No plan: “Map not available yet”
- Plan without features: plan still shown; soft empty legend message

## 7. Admin editor UX

### Routes

- `/admin/login`
- `/admin` — dashboard / structure
- Structure CRUD for campuses, buildings, floors
- Floor plan upload/replace
- Map editor for features
- Admin user management
- Layer preset edit (which types each preset includes)

### Map editor workflow

1. Select campus → building → floor  
2. View plan or upload if missing  
3. Tools: **Select** | **Add pin** | **Draw polygon**  
4. Select feature type  
5. Place pin (click) or draw polygon (vertices; complete action to finish)  
6. Edit label, notes, type; drag pin / edit vertices; delete  
7. **Autosave** on each successful change with a subtle “Saved” indicator  

### Upload rules

- Allowed: `.svg`, `.png`, `.jpg` / `.jpeg`
- Max size: default **20MB**, configurable via env
- On replace: keep features; warn if aspect ratio changes significantly
- Reject unreadable/corrupt files; keep previous plan if replace fails after validation

## 8. Internationalization

| Concern | v1 approach |
|---------|-------------|
| Default locale | `en` |
| UI strings | Locale JSON files (buttons, navigation, empty states, feature type labels, preset names, admin UI) |
| Detection | Browser locale + manual switcher; preference in `localStorage` |
| User content | Single string fields (not per-locale content in v1) |
| Adding a language | Add locale file; register locale code; translate keys |

Stable **keys** in DB for feature types and preset slugs; **labels** always resolved through i18n in the UI.

## 9. API

JSON REST under `/api`.

### Public (no auth)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/campuses` | List campuses |
| GET | `/api/campuses/:slug` | Campus detail + buildings |
| GET | `/api/campuses/:campusSlug/buildings/:buildingSlug` | Building + floors |
| GET | `/api/campuses/:campusSlug/buildings/:buildingSlug/floors/:floorSlug` | Floor, plan metadata/URL, features |
| GET | `/api/floors/:id` | Same payload by id (admin/editor convenience) |
| GET | `/api/presets` | Layer presets |
| GET | `/api/uploads/*` | Serve floor-plan files (read-only) |

Exact nesting may be adjusted during implementation as long as deep-link data is available efficiently.

### Auth

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/login` | Establish session |
| POST | `/api/auth/logout` | Clear session |
| GET | `/api/auth/me` | Current admin user or 401 |

### Admin (session required)

| Method | Path | Purpose |
|--------|------|---------|
| CRUD | `/api/admin/campuses` | Manage campuses |
| CRUD | `/api/admin/buildings` | Manage buildings |
| CRUD | `/api/admin/floors` | Manage floors |
| POST | `/api/admin/floors/:id/plan` | Upload/replace plan (multipart) |
| CRUD | `/api/admin/features` | Create/update/delete features |
| CRUD | `/api/admin/users` | List/create/disable admins; password change |
| PATCH | `/api/admin/presets/:id` | Update preset feature type lists |

### Auth details

- HTTP-only session cookie; `SESSION_SECRET` required
- Password hashing: bcrypt or argon2
- Bootstrap: if `ADMIN_BOOTSTRAP_USERNAME` and `ADMIN_BOOTSTRAP_PASSWORD` are set **and** zero admin users exist, create that admin on startup
- Failed login rate limiting (simple middleware)
- Generic login error messages (no user enumeration)
- Mutating admin routes reject unauthenticated requests with 401

### Errors

- API: consistent JSON `{ "error": "..." }` with appropriate HTTP status
- UI: toasts or inline messages; no stack traces to public users
- Health: process or `/api/health` for Compose healthchecks

## 10. Deployment

### Docker Compose services

- `app` — API + static web assets  
- `db` — PostgreSQL  
- Volumes: `pgdata`, `uploads`

### Environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection |
| `SESSION_SECRET` | Session signing |
| `ADMIN_BOOTSTRAP_USERNAME` | First admin (optional after seed) |
| `ADMIN_BOOTSTRAP_PASSWORD` | First admin password |
| `PORT` | Listen port |
| `MAX_UPLOAD_BYTES` | Optional upload limit |

Provide `.env.example` with placeholders only.

### Operations notes (README)

- Backup: `pg_dump` + copy `uploads` volume  
- Internal network hosting; TLS termination left to reverse proxy if used  
- Open-source: MIT license, contribution/README quick start  

## 11. Testing strategy

| Level | Coverage |
|-------|----------|
| Unit | Geometry validation; password hash/verify; preset type filtering; English catalog has required keys |
| API integration | Public reads; admin CRUD with and without session; bootstrap admin creation |
| Smoke | Navigate to floor; apply preset; admin place pin + polygon + notes |

Commands must be runnable in CI (`npm test` or monorepo equivalent). Optional Playwright smoke later; not blocking v1 if API + unit coverage is solid.

## 12. Security considerations

- Public read of safety maps is intentional for internal staff visibility
- Admin mutations only with valid session
- Secure cookie flags appropriate to deployment (document HTTPS recommendation behind proxy)
- Upload type sniffing/extension allowlist; store outside web root pattern via controlled `/api/uploads` path
- No secrets in git

## 13. Implementation phases (high level)

1. Scaffold monorepo, Docker Compose, Postgres schema, health check  
2. Public hierarchy APIs + viewer navigation + i18n shell (en)  
3. Floor plan serve + pan/zoom viewer  
4. Features read + markers/polygons + layers/presets  
5. Admin auth + bootstrap  
6. Admin structure CRUD + plan upload  
7. Admin map editor (pin, polygon, notes, autosave)  
8. Admin users + preset edit  
9. Polish empty states, mobile sheet, README, license  

Detailed task breakdown belongs in the implementation plan after this spec is accepted.

## 14. Open decisions deferred to implementation

These do not change product intent; implementers may choose and document:

- Fastify vs Hono vs other thin Node framework  
- Custom pan/zoom vs Leaflet image overlay vs similar library  
- ORM (e.g. Drizzle/Prisma) vs query builder  
- Whether `all` preset stores an explicit full type list or is treated as a special-case in code

---

**End of design spec.**  
Next step after user review: write an implementation plan (`writing-plans`), then implement.
