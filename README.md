# Facility Safety Maps

Self-hosted open-source web app for interactive campus facility safety maps. Public users pan/zoom floor plans, filter safety layers by preset, and inspect pins and polygons. Admins manage campus structure, upload floor plans, edit features, manage users, and tune layer presets.

**Current version:** see root [`package.json`](./package.json) and [CHANGELOG.md](./CHANGELOG.md).

## Features

- **Public maps** — campus → building → floor navigation with pan/zoom floor plans
- **Safety features** — AWAIR-oriented catalog: exits, assembly points, extinguishers, AEDs, eye wash, spill kits, shutoffs, LOTO, confined spaces, SDS stations, and more
- **Layer presets** — Evacuation, Fire response, Medical, Spill/chemical, Utilities, Hazards, All (admin-editable)
- **i18n** — English catalog included; easy to add languages
- **Admin** — cookie-session login, structure CRUD, plan upload, map editor (pin/polygon), users, presets
- **Docker** — single app container serves API + built SPA; Postgres + uploads volumes
- **Auto migrate + seed** — every container start applies DB migrations and refreshes system layer presets

## Quick start (Docker Compose)

Copy env defaults and set a strong session secret (required — Compose will not start without it):

```bash
cp .env.example .env
# Edit .env: set SESSION_SECRET to a long random string (not a placeholder)
docker compose up --build
```

Open:

- Public UI: http://localhost:3000/
- Admin: http://localhost:3000/admin/login
- Health: http://localhost:3000/api/health → `{ "status": "ok", "version": "…" }`

Default bootstrap admin (first empty DB only):

| Variable | Default |
|----------|---------|
| `ADMIN_BOOTSTRAP_USERNAME` | `admin` |
| `ADMIN_BOOTSTRAP_PASSWORD` | `changeme` |

**Before any real deployment:** set a unique `SESSION_SECRET` (16+ characters; not a known placeholder) and change bootstrap credentials. Production (`NODE_ENV=production`) refuses to start with a missing, short, or default secret.

**Cookies and HTTPS:** Compose defaults to `COOKIE_SECURE=false` so admin login works over plain HTTP on internal networks. When you terminate TLS / serve over HTTPS, set `COOKIE_SECURE=true` so session cookies are only sent on secure connections.

## Published container (GHCR)

Images are built by GitHub Actions and published to the GitHub Container Registry:

| Tag | Meaning |
|-----|---------|
| `ghcr.io/ajthom90/facility-maps:X.Y.Z` | Release matching git tag `vX.Y.Z` |
| `ghcr.io/ajthom90/facility-maps:latest` | Latest release tag |
| `ghcr.io/ajthom90/facility-maps:edge` | Latest successful build from `main` |
| `ghcr.io/ajthom90/facility-maps:sha-<short>` | Exact commit build |

```bash
docker pull ghcr.io/ajthom90/facility-maps:0.1.0
# or
docker pull ghcr.io/ajthom90/facility-maps:latest
```

Example run (Postgres still required):

```bash
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=postgres://… \
  -e SESSION_SECRET='your-long-random-secret' \
  -e COOKIE_SECURE=false \
  -e ADMIN_BOOTSTRAP_USERNAME=admin \
  -e ADMIN_BOOTSTRAP_PASSWORD='change-me' \
  -v uploads:/data/uploads \
  ghcr.io/ajthom90/facility-maps:0.1.0
```

Or point Compose at a published tag:

```bash
export FACILITY_MAPS_IMAGE=ghcr.io/ajthom90/facility-maps:0.1.0
# use image only — skip local build if desired
docker compose pull app && docker compose up -d
```

**Public package:** the Container workflow attempts to set package visibility to public. If pulls fail with auth errors, open the package on GitHub → **Package settings** → **Change visibility** → **Public**.

### Startup on every container start / image update

1. **Migrate** — apply Drizzle SQL from `apps/api/drizzle`
2. **Seed** — insert any new system layer presets; refresh type lists for known system presets (`all`, `evacuation`, …) so catalog expansions from newer images land automatically
3. **Bootstrap admin** — only when the users table is empty and bootstrap env vars are set
4. **Listen** — API + SPA

Pulling a new image and recreating the app container is enough to pick up new feature types/presets; you do not need a manual `db:seed` in production.

## Development

Requires Node.js 22+ and a Postgres database.

```bash
# Install
npm ci

# Postgres (example via compose db only)
SESSION_SECRET=dev-only-session-secret-ok docker compose up db -d

export DATABASE_URL=postgres://facility:facility@localhost:5432/facility_maps
export ADMIN_BOOTSTRAP_USERNAME=admin
export ADMIN_BOOTSTRAP_PASSWORD=changeme

# Migrate + seed presets (also runs automatically when starting the API via dist/index)
npm run db:migrate -w @facility-maps/api
npm run db:seed -w @facility-maps/api

# API on :3000, Vite web on :5173 (proxy /api in vite.config)
npm run dev -w @facility-maps/api
npm run dev -w @facility-maps/web
```

Tests:

```bash
npm test
```

## Versioning

This project uses [Semantic Versioning](https://semver.org/). **Source of truth:** root `package.json` `"version"`. Workspace packages must match:

```bash
npm run version:sync    # copy root version → apps/api + apps/web
npm run version:check   # CI fails if out of sync
```

| Bump | Use when |
|------|----------|
| **MAJOR** | Breaking API, stored feature-type keys, env/deploy contracts, or data without a safe migration |
| **MINOR** | Backward-compatible features (new feature types, presets, endpoints, locales) |
| **PATCH** | Bug fixes, docs, safe dependency updates |

Release process: update root version → `version:sync` → `CHANGELOG.md` → commit → tag `vX.Y.Z` → push tag (Container workflow publishes GHCR). Agents should follow `.grok/skills/facility-maps-versioning/SKILL.md`.

## Environment variables

| Variable | Description | Default / notes |
|----------|-------------|-----------------|
| `PORT` | HTTP port | `3000` |
| `DATABASE_URL` | Postgres connection string | `postgres://facility:facility@localhost:5432/facility_maps` |
| `SESSION_SECRET` | Signs admin session cookies | **Required** for Compose and production. Min 16 chars; rejects known defaults when `NODE_ENV=production` |
| `COOKIE_SECURE` | Set `Secure` on session cookies | `false` (Compose / `.env.example`). Use `true` behind HTTPS |
| `ADMIN_BOOTSTRAP_USERNAME` | Create first admin if table empty | empty = skip bootstrap |
| `ADMIN_BOOTSTRAP_PASSWORD` | Password for bootstrap user | empty = skip bootstrap |
| `UPLOAD_DIR` | Floor plan upload directory | `./data/uploads` (Docker: `/data/uploads`) |
| `MAX_UPLOAD_BYTES` | Max plan upload size | `20971520` (20 MiB) |
| `WEB_DIST` | **Relative** path from process cwd to built web assets | empty = API only; Docker: `apps/web/dist` |
| `APP_VERSION` | Reported by `/api/health` | Baked into the image via Docker `ARG`/`ENV`; local default `0.0.0-dev` if unset |

`WEB_DIST` must be relative (e.g. `apps/web/dist`). Absolute paths are not supported by the static file server.

### Plain HTTP vs HTTPS

| Deploy mode | `COOKIE_SECURE` |
|-------------|-----------------|
| Plain HTTP (LAN / reverse-proxy TLS offload not terminating at app, internal only) | `false` |
| HTTPS (TLS to the app or cookies only on HTTPS paths) | `true` |

If `COOKIE_SECURE=true` while you only access the app via `http://`, browsers will not store the admin session cookie and login will appear to fail.

## Production image

The `Dockerfile` multi-stage build:

1. Installs workspace dependencies
2. Builds `@facility-maps/web` and `@facility-maps/api`
3. Runner stage: `npm ci --omit=dev`, copies API `dist`, **Drizzle migrations** (`apps/api/drizzle`), and web `dist`
4. Sets `WEB_DIST=apps/web/dist` and `APP_VERSION` (build-arg) so Hono serves the SPA and health reports the version

Startup applies migrations, **re-runs system preset seed**, and bootstraps an admin when configured.

CI:

- [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) — tests + build on PRs/`main`
- [`.github/workflows/container.yml`](./.github/workflows/container.yml) — build/push GHCR on `main` (`:edge`) and on tags `v*.*.*`

## Adding a language

1. Copy `apps/web/src/locales/en.json` to `apps/web/src/locales/xx.json` and translate values.
2. Register the locale in `apps/web/src/i18n.ts`:
   - import the JSON
   - add `"xx"` to `SUPPORTED_LOCALES`
   - add `xx: { translation: xx }` under `resources`
3. Rebuild the web app (`npm run build -w @facility-maps/web` or Docker rebuild).

The language switcher picks up supported locales automatically.

## Backup

Two pieces of state matter:

1. **Postgres** — campuses, floors, features, users, presets, sessions metadata  
2. **Uploads volume** — floor plan image/SVG files

```bash
# Database dump
docker compose exec -T db pg_dump -U facility facility_maps > backup-$(date +%Y%m%d).sql

# Uploads (named volume)
docker run --rm -v facility-safety-maps_uploads:/data -v "$PWD":/backup alpine \
  tar czf /backup/uploads-$(date +%Y%m%d).tar.gz -C /data .
```

Restore: recreate the DB from the SQL dump and extract the uploads archive into the `uploads` volume (or `UPLOAD_DIR`).

Adjust the volume name (`docker volume ls`) if your Compose project name differs.

## License

MIT — see [LICENSE](./LICENSE).
