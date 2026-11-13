#!/usr/bin/env bash
# Deploys one image version of the app to one environment on the server.
# Usage: ./deploy.sh <prod|staging> <image-tag>   (the tag is the git commit SHA)
# Order: pull -> database backup (prod only) -> migrations -> new app -> smoke /health.
# No automatic rollback.
set -euo pipefail

USAGE="Usage: deploy.sh <prod|staging> <image-tag>"
ENV_ARG="${1:?$USAGE}"
TAG="${2:?$USAGE}"
cd "$(dirname "$0")"
source ./lib.sh
use_env "$ENV_ARG"

# Two deploys to the same environment never run at the same time: the second one waits.
exec 9> .deploy.lock
if ! flock -n 9; then
  echo "==> Another deploy to $ENV_NAME is running, waiting for it to finish"
  flock 9
fi

if [ ! -f .env ]; then
  echo "ERROR: $(pwd)/.env is missing" >&2
  exit 1
fi
chmod 600 .env

export IMAGE_TAG="$TAG"

echo "==> Deploying $TAG to $ENV_NAME"
echo "==> Pulling $IMAGE:$TAG"
docker pull "$IMAGE:$TAG"

echo "==> Starting database"
compose up -d --wait db

# Only production data is backed up: the staging database is a disposable copy of it.
if [ "$ENV_NAME" = "prod" ]; then
  # The backup name carries the version that ran before this deploy: restore it together with that version.
  before="$(cat .current-tag 2>/dev/null || true)"
  before="${before:-none}"
  echo "==> Backing up database (version before deploy: $before)"
  if ! backup_database "before-${before:0:7}" >/dev/null; then
    echo "ERROR: database backup failed, the running app version was left untouched" >&2
    exit 1
  fi
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

# Remember versions for a manual rollback: ./deploy.sh <env> "$(cat .previous-tag)"
current="$(cat .current-tag 2>/dev/null || true)"
if [ -n "$current" ] && [ "$current" != "$TAG" ]; then
  echo "$current" > .previous-tag
fi
echo "$TAG" > .current-tag

echo "==> Removing app images no environment uses"
remove_unused_images

echo "==> Deployed $TAG to $ENV_NAME"
