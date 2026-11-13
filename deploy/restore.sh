#!/usr/bin/env bash
# Restores the production database from a backup file. Run by hand on the server only.
# Usage: ./restore.sh backups/<file>.dump
# Order: confirm -> copy of the current database -> stop app -> drop and recreate the database
#        -> load the backup -> start the same app version -> smoke /health. No automatic rollback.
set -euo pipefail

ARG="${1:?Usage: restore.sh <backup-file>}"
# Resolve the path before changing directory, so a path relative to the caller works.
FILE="$(realpath -e -- "$ARG")" || { echo "ERROR: backup file not found: $ARG" >&2; exit 1; }

cd "$(dirname "$0")"
source ./lib.sh
# Production only; the staging database is recreated with refresh-staging.sh.
use_env prod

TAG="$(cat .current-tag 2>/dev/null || true)"
if [ -z "$TAG" ]; then
  echo "ERROR: $(pwd)/.current-tag is missing, cannot tell which app version to start" >&2
  exit 1
fi
export IMAGE_TAG="$TAG"

compose up -d --wait db

if ! compose exec -T db pg_restore --list < "$FILE" >/dev/null; then
  echo "ERROR: $FILE is not a pg_dump backup" >&2
  exit 1
fi

echo
echo "Backup file:  $FILE ($(du -h "$FILE" | cut -f1), $(date -u -r "$FILE" '+%Y-%m-%d %H:%M UTC'))"
echo "Will replace: database '$DB_NAME' of docker compose project 'prod'"
echo "App version:  $TAG (stays the same)"
echo "A copy of the current database is saved to $BACKUP_DIR/ first."
echo
read -r -p 'Type "yes" to delete the current database and load this backup: ' answer
if [ "$answer" != "yes" ]; then
  echo "Aborted, nothing changed."
  exit 1
fi

echo "==> Saving a copy of the current database"
safety="$(backup_database "before-restore-${TAG:0:7}")"

echo "==> Stopping the app"
compose stop app

if ! load_backup "$FILE"; then
  echo "ERROR: the database could not be restored, it may be incomplete" >&2
  echo "The app is stopped. The database as it was before restore: $(pwd)/$safety" >&2
  echo "To bring it back: ./restore.sh $safety" >&2
  exit 1
fi

echo "==> Starting app $TAG"
compose up -d app

echo "==> Smoke test /health"
if ! smoke_health; then
  echo "ERROR: the database is restored, but the app does not answer. Copy before restore: $(pwd)/$safety" >&2
  exit 1
fi

echo "==> Restored $FILE"
