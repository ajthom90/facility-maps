# Changelog

All notable changes to **Facility Safety Maps** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Version numbers live in the root `package.json` (source of truth). Workspace
packages (`apps/api`, `apps/web`) must match — run `npm run version:sync`.

Container images: `ghcr.io/ajthom90/facility-maps:<version>` (see README).

## [Unreleased]

### Added
- `docker-compose.truenas.yml` — TrueNAS SCALE sample with all settings inlined (no `.env`)
- **Per-campus hierarchy modes:** `full` (Campus→Building→Floor), `no_buildings` (Campus→Floor), `single_map` (one site map). Configurable in admin Structure.

## [0.2.0] — 2026-07-29

### Changed
- **BREAKING:** Replace PostgreSQL with **SQLite** (`better-sqlite3`). Existing Postgres volumes are not auto-migrated.
- Docker Compose is a **single `app` service** with two named volumes:
  - `facility-maps-data` → `/data` (DB + uploads)
  - `facility-maps-config` → `/config` (`app.env` secrets/settings)
- CI no longer starts a Postgres service; tests use temp SQLite files.
- Base image uses `node:22-bookworm-slim` for native module prebuilds.

### Added
- `scripts/backup.sh` / `scripts/restore.sh` for portable host migration archives
- Auto-write `/config/app.env` on first boot; load config file on startup (fills empty env)

### Removed
- `postgres` npm dependency and Compose `db` service
- `DATABASE_URL` environment variable (use `SQLITE_PATH`)

## [0.1.0] — 2026-07-29

### Added
- Initial public versioned release baseline
- AWAIR-oriented feature type catalog and scenario presets (evacuation, fire, medical, spill/chemical, utilities, hazards)
- Docker Compose stack (app + Postgres), multi-stage production image
- Public floor maps, admin editor, layer presets, English i18n
- GitHub Actions CI (tests + build) and GHCR container publish workflow
- `APP_VERSION` baked into the image; exposed on `GET /api/health`
- Version sync script (`npm run version:sync` / `version:check`)
- Startup always re-runs system preset seed after migrations (image updates pick up new feature types)

### Fixed
- `npm ci` / Docker build esbuild binary mismatch (`tsx` vs `vite`); pin `tsx@4.19.4` and override `esbuild@0.25.12`
