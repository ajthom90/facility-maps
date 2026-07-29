# Changelog

All notable changes to **Facility Safety Maps** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Version numbers live in the root `package.json` (source of truth). Workspace
packages (`apps/api`, `apps/web`) must match — run `npm run version:sync`.

Container images: `ghcr.io/ajthom90/facility-maps:<version>` (see README).

## [Unreleased]

### Added
- GitHub Actions CI (tests + build) and GHCR container publish workflow
- `APP_VERSION` baked into the image; exposed on `GET /api/health`
- Version sync script (`npm run version:sync` / `version:check`)
- Startup always re-runs system preset seed after migrations (image updates pick up new feature types)

## [0.1.0] — 2026-07-29

### Added
- Initial public versioned release baseline
- AWAIR-oriented feature type catalog and scenario presets (evacuation, fire, medical, spill/chemical, utilities, hazards)
- Docker Compose stack (app + Postgres), multi-stage production image
- Public floor maps, admin editor, layer presets, English i18n
