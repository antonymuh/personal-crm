#!/usr/bin/env bash
# Deploys one image version of the app on the server.
# Usage: ./deploy.sh <image-tag>   (the tag is the git commit SHA)
# Order: pull -> database backup -> migrations -> new app -> smoke /health. No automatic rollback.
set -euo pipefail

TAG="${1:?Usage: deploy.sh <image-tag>}"
cd "$(dirname "$0")"
source ./lib.sh

if [ ! -f .env ]; then
  echo "ERROR: $(pwd)/.env is missing" >&2
  exit 1
fi
chmod 600 .env

export IMAGE_TAG="$TAG"

echo "==> Pulling $IMAGE:$TAG"
docker pull "$IMAGE:$TAG"

echo "==> Starting database"
compose up -d --wait db

# The backup name carries the version that ran before this deploy: restore it together with that version.
before="$(cat .current-tag 2>/dev/null || true)"
before="${before:-none}"
echo "==> Backing up database (version before deploy: $before)"
if ! backup_database "before-${before:0:7}" >/dev/null; then
  echo "ERROR: database backup failed, the running app version was left untouched" >&2
  exit 1
fi

echo "==> Applying migrations"
if ! compose --profile migrate run --rm migrate; then
  echo "ERROR: migrations failed, the running app version was left untouched" >&2
  exit 1
fi

echo "==> Starting app $TAG"
compose up -d app

echo "==> Smoke test /health"
smoke_health

# Remember versions for a manual rollback: ./deploy.sh "$(cat .previous-tag)"
current="$(cat .current-tag 2>/dev/null || true)"
if [ -n "$current" ] && [ "$current" != "$TAG" ]; then
  echo "$current" > .previous-tag
fi
echo "$TAG" > .current-tag
previous="$(cat .previous-tag 2>/dev/null || true)"

echo "==> Removing old app images (keeping current and previous)"
docker images "$IMAGE" --format '{{.Tag}}' | while read -r t; do
  if [ "$t" != "$TAG" ] && [ "$t" != "$previous" ]; then
    docker rmi "$IMAGE:$t" >/dev/null || true
  fi
done
docker image prune -f >/dev/null

echo "==> Deployed $TAG"
