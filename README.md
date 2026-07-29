# Facility Safety Maps

Self-hosted open-source web app for interactive campus facility safety maps. Public users pan/zoom floor plans, filter safety layers by preset, and inspect pins and polygons. Admins manage campus structure, upload floor plans, edit features, manage users, and tune layer presets.

**Current version:** see root [`package.json`](./package.json) and [CHANGELOG.md](./CHANGELOG.md).

## Features

- **Public maps** — campus hierarchy (full, floors-only, or single site map) with pan/zoom plans
- **Safety features** — AWAIR-oriented catalog: exits, assembly points, extinguishers, AEDs, eye wash, spill kits, shutoffs, LOTO, confined spaces, SDS stations, and more
- **Layer presets** — Evacuation, Fire response, Medical, Spill/chemical, Utilities, Hazards, All (admin-editable)
- **i18n** — English catalog included; easy to add languages
- **Admin** — cookie-session login, structure CRUD, plan upload, map editor (pin/polygon), users, presets
- **Docker** — single app container (SQLite + SPA); portable **data** and **config** volumes
- **Auto migrate + seed** — every container start applies DB migrations and refreshes system layer presets

## Quick start (Docker Compose)

```bash
cp .env.example .env
# Edit .env: set SESSION_SECRET to a long random string (not a placeholder)
docker compose up --build -d
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

### TrueNAS SCALE (no `.env` file)

TrueNAS SCALE Custom Apps / YAML installs often cannot use a host `.env`. Use the sample compose that inlines every setting:

- [`docker-compose.truenas.yml`](./docker-compose.truenas.yml)

1. Create host datasets (example): `/mnt/<pool>/apps/facility-maps/data` and `…/config`
2. Edit the sample: host paths, `SESSION_SECRET` (`openssl rand -hex 32`), bootstrap password, image tag, port
3. Install as a **Custom App** (paste YAML) or run: `docker compose -f docker-compose.truenas.yml up -d`
4. Open `http://<truenas-ip>:3000/` and `/admin/login`

Host-path binds are used so TrueNAS snapshots/replication cover DB + uploads. Named Docker volumes are documented as an optional alternative in the sample file.

### What is stored where (portable volumes)

| Volume name | Mount | Contents |
|-------------|--------|----------|
| `facility-maps-data` | `/data` | SQLite DB (`/data/db/facility-maps.sqlite`), floor-plan files (`/data/uploads`) |
| `facility-maps-config` | `/config` | `app.env` (SESSION_SECRET, bootstrap users, paths) — written on first start |

Moving to another Docker host = copy those two volumes (or a backup archive) + run the same image/compose. You do **not** need a separate database server.

## Backup & host migration

### One-shot backup archive

```bash
./scripts/backup.sh ./backups
# → ./backups/facility-maps-backup-YYYYMMDD-HHMMSS.tar.gz
```

The archive contains `data/`, `config/`, and `meta.txt`.

### Restore on any host

```bash
# Install compose file + image (or git clone), then:
./scripts/restore.sh ./backups/facility-maps-backup-YYYYMMDD-HHMMSS.tar.gz
docker compose up -d
```

Secrets come from the restored `config` volume (`/config/app.env`). You can leave host `.env` `SESSION_SECRET` empty after a restore; the app loads the config file.

### Manual volume copy

```bash
# Source host
docker run --rm -v facility-maps-data:/data -v facility-maps-config:/config \
  -v "$PWD":/backup alpine \
  tar czf /backup/facility-maps-volumes.tgz -C / data config

# Target host (volumes must exist or will be created empty first)
docker volume create facility-maps-data
docker volume create facility-maps-config
docker run --rm -v facility-maps-data:/data -v facility-maps-config:/config \
  -v "$PWD":/backup alpine \
  tar xzf /backup/facility-maps-volumes.tgz -C /
```

Prefer stopping the app (or using `./scripts/backup.sh`, which checkpoints SQLite WAL) before a cold copy.

## Published container (GHCR)

Images are built by GitHub Actions and published to the GitHub Container Registry:

| Tag | Meaning |
|-----|---------|
| `ghcr.io/ajthom90/facility-maps:X.Y.Z` | Release matching git tag `vX.Y.Z` |
| `ghcr.io/ajthom90/facility-maps:latest` | Latest release tag |
| `ghcr.io/ajthom90/facility-maps:edge` | Latest successful build from `main` |
| `ghcr.io/ajthom90/facility-maps:sha-<short>` | Exact commit build |

```bash
docker pull ghcr.io/ajthom90/facility-maps:0.2.0
# or
docker pull ghcr.io/ajthom90/facility-maps:latest
```

Example run:

```bash
docker run --rm -p 3000:3000 \
  -e SESSION_SECRET='your-long-random-secret' \
  -e COOKIE_SECURE=false \
  -e ADMIN_BOOTSTRAP_USERNAME=admin \
  -e ADMIN_BOOTSTRAP_PASSWORD='change-me' \
  -v facility-maps-data:/data \
  -v facility-maps-config:/config \
  ghcr.io/ajthom90/facility-maps:0.2.0
```

Or point Compose at a published tag:

```bash
export FACILITY_MAPS_IMAGE=ghcr.io/ajthom90/facility-maps:0.2.0
docker compose pull && docker compose up -d
```

**Public package:** if pulls need auth, open the package on GitHub → **Package settings** → **Change visibility** → **Public**.

### Startup on every container start / image update

1. **Load config** — optional `/config/app.env` (and write it on first boot if missing)
2. **Migrate** — apply Drizzle SQL from `apps/api/drizzle` to the SQLite file
3. **Seed** — insert/refresh system layer presets
4. **Bootstrap admin** — only when the users table is empty and bootstrap credentials are set
5. **Listen** — API + SPA

## Development

Requires Node.js 22+. No external database server — SQLite file under `./data/`.

```bash
npm ci

export ADMIN_BOOTSTRAP_USERNAME=admin
export ADMIN_BOOTSTRAP_PASSWORD=changeme
# optional: SQLITE_PATH=./data/facility-maps.sqlite

npm run db:migrate -w @facility-maps/api
npm run db:seed -w @facility-maps/api

npm run dev -w @facility-maps/api
npm run dev -w @facility-maps/web
```

Tests (temp SQLite files, no Docker DB):

```bash
npm test
```

## Versioning

This project uses [Semantic Versioning](https://semver.org/). **Source of truth:** root `package.json` `"version"`. Workspace packages must match:

```bash
npm run version:sync
npm run version:check
```

| Bump | Use when |
|------|----------|
| **MAJOR** | Breaking API, stored data shape, env/deploy contracts |
| **MINOR** | Backward-compatible features (new feature types, presets, endpoints) |
| **PATCH** | Bug fixes, docs, safe dependency updates |

Agents: see `.grok/skills/facility-maps-versioning/SKILL.md`.

## Environment variables

| Variable | Description | Default / notes |
|----------|-------------|-----------------|
| `PORT` | HTTP port | `3000` |
| `SQLITE_PATH` | SQLite database file | `./data/facility-maps.sqlite` locally; Docker `/data/db/facility-maps.sqlite` |
| `UPLOAD_DIR` | Floor plan files | `./data/uploads` locally; Docker `/data/uploads` |
| `CONFIG_FILE` | KEY=VALUE config file | Docker `/config/app.env` |
| `SESSION_SECRET` | Signs admin session cookies | Required in production (min 16 chars, not a known default) |
| `COOKIE_SECURE` | Set `Secure` on session cookies | `false` for plain HTTP |
| `ADMIN_BOOTSTRAP_USERNAME` | Create first admin if table empty | empty = skip |
| `ADMIN_BOOTSTRAP_PASSWORD` | Password for bootstrap user | empty = skip |
| `MAX_UPLOAD_BYTES` | Max plan upload size | `20971520` (20 MiB) |
| `WEB_DIST` | Relative path to built SPA | Docker: `apps/web/dist` |
| `APP_VERSION` | Reported by `/api/health` | Baked into image |

## Production image

The `Dockerfile` multi-stage build (Node 22 bookworm for `better-sqlite3` prebuilds):

1. Install workspace dependencies
2. Build web + API
3. Runner: production deps, API `dist`, Drizzle migrations, web `dist`
4. Default paths: `SQLITE_PATH=/data/db/…`, `UPLOAD_DIR=/data/uploads`, `CONFIG_FILE=/config/app.env`

CI: [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) · Container: [`.github/workflows/container.yml`](./.github/workflows/container.yml)

## Adding a language

1. Copy `apps/web/src/locales/en.json` to `apps/web/src/locales/xx.json` and translate values.
2. Register the locale in `apps/web/src/i18n.ts`.
3. Rebuild the web app.

## License

MIT — see [LICENSE](./LICENSE).
