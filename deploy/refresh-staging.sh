#!/usr/bin/env bash
# Recreates the staging database as a copy of production: loads the newest production backup
# (or the given one) into staging. Staging only; production is not touched.
# Usage: ./refresh-staging.sh [backup-file]
# Order: stop app -> drop and recreate the database -> load the backup -> migrations
#        -> start the same app version -> smoke /health.
set -euo pipefail

cd "$(dirname "$0")"
PROD_BACKUPS="../prod/backups"

if [ -n "${1:-}" ]; then
  FILE="$(cd "$OLDPWD" && realpath -e -- "$1")" || { echo "ERROR: backup file not found: $1" >&2; exit 1; }
else
  # Backup names start with the UTC time, so the last one by name is the newest.
  FILE="$(ls -1 "$PROD_BACKUPS"/*.dump 2>/dev/null | sort | tail -n 1 || true)"
  if [ -z "$FILE" ]; then
    echo "ERROR: no production backups in $(realpath "$PROD_BACKUPS")" >&2
    exit 1
  fi
  FILE="$(realpath -e -- "$FILE")"
fi

source ./lib.sh
use_env staging

# Not at the same time as a deploy to staging.
exec 9> .deploy.lock
flock 9

TAG="$(cat .current-tag 2>/dev/null || true)"
if [ -z "$TAG" ]; then
  echo "ERROR: $(pwd)/.current-tag is missing: deploy staging once before copying data into it" >&2
  exit 1
fi
export IMAGE_TAG="$TAG"

compose up -d --wait db

if ! compose exec -T db pg_restore --list < "$FILE" >/dev/null; then
  echo "ERROR: $FILE is not a pg_dump backup" >&2
  exit 1
fi

echo "==> Copying production backup $FILE into staging (app version $TAG)"

echo "==> Stopping the staging app"
compose stop app

if ! load_backup "$FILE"; then
  echo "ERROR: could not load the backup, the staging database is incomplete; the staging app is stopped" >&2
  exit 1
fi

# The backup may be older than the staging version: bring the schema up to date.
echo "==> Applying migrations"
compose --profile migrate run --rm migrate

echo "==> Starting app $TAG"
compose up -d app

echo "==> Smoke test /health"
smoke_health

echo "==> Staging now holds the data from $FILE"
