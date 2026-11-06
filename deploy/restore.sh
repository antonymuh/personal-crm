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

fail() {
  echo "ERROR: $1" >&2
  echo "The app is stopped. The database as it was before restore: $(pwd)/$safety" >&2
  echo "To bring it back: ./restore.sh $safety" >&2
  exit 1
}

echo "==> Recreating database $DB_NAME"
compose exec -T db psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS $DB_NAME WITH (FORCE)" \
  -c "CREATE DATABASE $DB_NAME OWNER $DB_USER" ||
  fail "could not recreate the database"

echo "==> Loading the backup"
compose exec -T db pg_restore -U "$DB_USER" -d "$DB_NAME" --no-owner --exit-on-error < "$FILE" ||
  fail "pg_restore failed, the database is incomplete"

echo "==> Starting app $TAG"
compose up -d app

echo "==> Smoke test /health"
if ! smoke_health; then
  echo "ERROR: the database is restored, but the app does not answer. Copy before restore: $(pwd)/$safety" >&2
  exit 1
fi

echo "==> Restored $FILE"
