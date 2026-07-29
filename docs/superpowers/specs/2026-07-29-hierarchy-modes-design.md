# Hierarchy modes — Design Spec

**Date:** 2026-07-29  
**Status:** Approved for implementation  
**Product:** Facility Safety Maps  

## Problem

The hierarchy is hard-wired as Campus → Building → Floor, and only floors have maps. Sites need:

- Full multi-building campuses
- Campus → Floor only (no buildings)
- A single full safety map for the whole site

Configurable **per campus** in admin.

## Modes

| Mode | Tree | Map surface | Public paths |
|------|------|-------------|--------------|
| `full` (default) | Campus → Building → Floor | Floor | `/{c}/{b}/{f}` |
| `no_buildings` | Campus → Floor | Floor | `/{c}/{f}` |
| `single_map` | Campus only | One floor (auto `slug: map`) | `/{c}` |

Maps are **leaf-only**: plans + features stay on floors. Higher levels do not have separate plans.

## Data model

Greenfield: replace init SQLite migration (no production data yet).

```
campuses
  + hierarchy_mode text NOT NULL DEFAULT 'full'
    -- full | no_buildings | single_map

floors
  + campus_id text NOT NULL REFERENCES campuses(id) ON DELETE cascade
  ~ building_id text NULL REFERENCES buildings(id) ON DELETE cascade
  -- full: building_id required
  -- no_buildings | single_map: building_id null

Uniqueness:
  - floors with building: unique (building_id, slug)
  - floors without building: unique (campus_id, slug) partial via app enforcement + indexes
```

`floor_plans` and `features` unchanged (still `floor_id`).

### single_map

On campus create with mode `single_map`, or when switching to it (only if empty of buildings/extra floors), ensure exactly one floor:

- `name`: "Site map" (or campus name)
- `slug`: `map`
- `building_id`: null
- `campus_id`: set

Admin does not manage floor list in this mode — only “Edit map”.

### Mode changes

v1: **block** invalid transitions with clear errors (no auto re-parenting).

- → `single_map`: only if zero buildings and at most one campus-level floor
- → `no_buildings`: only if zero buildings (or only campus-level floors)
- → `full`: always allowed (admin then adds buildings)

## API

- All campus payloads include `hierarchyMode`
- `GET /api/campuses/:slug`:
  - `full`: `{ buildings: [...] }`
  - `no_buildings`: `{ floors: [...] }` (no buildings list, or empty)
  - `single_map`: `{ floors: [one], mapFloorId }` or include floor payload
- New public route: `GET /api/campuses/:campusSlug/floors/:floorSlug` for no_buildings
- Keep existing nested floor route for full mode
- Admin create campus: optional `hierarchyMode`
- Admin patch campus: `hierarchyMode` with validation
- Admin create floor: `buildingId` **or** `campusId` (not both for parent; always set campus_id on row)
  - Prefer: always send `campusId`; `buildingId` required only in full mode

## Admin UI

- Campus create: name + hierarchy mode select
- Campus rename/mode: allow mode change when valid
- Structure tree adapts:
  - full: buildings → floors (current)
  - no_buildings: floors under campus
  - single_map: “Edit map” link to floor editor

## Public UI

- Home: single_map campuses link to `/{slug}` map; others to campus page
- `/:campusSlug`: if single_map, render map; if no_buildings, list floors; if full, list buildings
- `/:campusSlug/:floorSlug`: map when no_buildings (and not a building slug in full — use mode)
- `/:campusSlug/:buildingSlug/:floorSlug`: full mode only

Route resolution uses campus `hierarchyMode` from API.

## Out of scope

- Maps on non-leaf nodes in full mode
- Automatic hierarchy migration of populated trees
- Multiple maps in single_map mode

## Testing

- Schema / mode validation unit tests
- Public + admin API tests for three modes
- Web: types + any client helpers; structure page behaviors covered by API tests primarily
