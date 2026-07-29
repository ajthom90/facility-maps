#!/usr/bin/env bash
# Restore a Facility Safety Maps backup archive into Docker volumes.
#
# Usage:
#   ./scripts/restore.sh facility-maps-backup-YYYYMMDD-HHMMSS.tar.gz
#
# Stops the compose stack if running, reloads volumes, then you can
# `docker compose up -d` again. Does NOT overwrite host .env.

set -euo pipefail

ARCHIVE="${1:?Usage: $0 <backup.tar.gz>}"
if [[ ! -f "$ARCHIVE" ]]; then
  echo "Not a file: $ARCHIVE" >&2
  exit 1
fi

DATA_VOL="${FACILITY_MAPS_DATA_VOLUME:-facility-maps-data}"
CONFIG_VOL="${FACILITY_MAPS_CONFIG_VOLUME:-facility-maps-config}"
WORK="$(mktemp -d)"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

echo "Extracting $ARCHIVE…"
tar -xzf "$ARCHIVE" -C "$WORK"

if [[ ! -d "$WORK/data" || ! -d "$WORK/config" ]]; then
  echo "Archive missing data/ or config/ — not a facility-maps backup?" >&2
  exit 1
fi

echo "Stopping stack (if any)…"
docker compose -p facility-maps down 2>/dev/null || true

# Ensure volumes exist
docker volume create "$DATA_VOL" >/dev/null
docker volume create "$CONFIG_VOL" >/dev/null

echo "Restoring into ${DATA_VOL}…"
docker run --rm \
  -v "${DATA_VOL}:/to" \
  -v "${WORK}/data:/from:ro" \
  alpine:3.20 sh -c 'rm -rf /to/* /to/.[!.]* 2>/dev/null; cp -a /from/. /to/'

echo "Restoring into ${CONFIG_VOL}…"
docker run --rm \
  -v "${CONFIG_VOL}:/to" \
  -v "${WORK}/config:/from:ro" \
  alpine:3.20 sh -c 'rm -rf /to/* /to/.[!.]* 2>/dev/null; cp -a /from/. /to/'

echo "Restore complete."
echo "Start with:  docker compose up -d"
echo "Config (SESSION_SECRET etc.) lives in volume ${CONFIG_VOL} as app.env"
