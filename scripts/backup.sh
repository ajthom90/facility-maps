#!/usr/bin/env bash
# Backup portable Facility Safety Maps volumes to a single archive.
#
# Usage:
#   ./scripts/backup.sh [output-dir]
#
# Produces: facility-maps-backup-YYYYMMDD-HHMMSS.tar.gz containing:
#   data/   — SQLite DB (+ WAL/SHM if present) and uploads
#   config/ — app.env and other files from the config volume
#   meta.txt
#
# Requires: docker, running or stopped stack that owns volumes
#   facility-maps-data and facility-maps-config (see docker-compose.yml).

set -euo pipefail

OUT_DIR="${1:-.}"
STAMP="$(date +%Y%m%d-%H%M%S)"
WORK="$(mktemp -d)"
ARCHIVE="${OUT_DIR%/}/facility-maps-backup-${STAMP}.tar.gz"

DATA_VOL="${FACILITY_MAPS_DATA_VOLUME:-facility-maps-data}"
CONFIG_VOL="${FACILITY_MAPS_CONFIG_VOLUME:-facility-maps-config}"

cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

mkdir -p "$WORK/data" "$WORK/config" "$OUT_DIR"

echo "Checkpointing SQLite (best-effort) via app container if running…"
if docker compose -p facility-maps ps --status running 2>/dev/null | grep -q app; then
  docker compose -p facility-maps exec -T app \
    node -e "
      const Database = require('better-sqlite3');
      const p = process.env.SQLITE_PATH || '/data/db/facility-maps.sqlite';
      try {
        const db = new Database(p);
        db.pragma('wal_checkpoint(TRUNCATE)');
        db.close();
        console.log('wal_checkpoint ok');
      } catch (e) {
        console.warn('checkpoint skipped', e.message);
      }
    " 2>/dev/null || true
fi

echo "Copying volume ${DATA_VOL}…"
docker run --rm \
  -v "${DATA_VOL}:/from:ro" \
  -v "${WORK}/data:/to" \
  alpine:3.20 sh -c 'cp -a /from/. /to/'

echo "Copying volume ${CONFIG_VOL}…"
docker run --rm \
  -v "${CONFIG_VOL}:/from:ro" \
  -v "${WORK}/config:/to" \
  alpine:3.20 sh -c 'cp -a /from/. /to/'

{
  echo "created_at=${STAMP}"
  echo "data_volume=${DATA_VOL}"
  echo "config_volume=${CONFIG_VOL}"
} >"$WORK/meta.txt"

tar -czf "$ARCHIVE" -C "$WORK" data config meta.txt
echo "Wrote $ARCHIVE"
ls -lh "$ARCHIVE"
