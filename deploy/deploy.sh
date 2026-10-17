#!/usr/bin/env bash
# Deploys one image version of the app on the server.
# Usage: ./deploy.sh <image-tag>   (the tag is the git commit SHA)
# Order: pull -> migrations -> new app -> smoke /health. No automatic rollback.
set -euo pipefail

TAG="${1:?Usage: deploy.sh <image-tag>}"
IMAGE="ghcr.io/antonymuh/personal-crm"
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "ERROR: $(pwd)/.env is missing" >&2
  exit 1
fi
chmod 600 .env

export IMAGE_TAG="$TAG"
compose() { docker compose -p prod -f compose.yaml "$@"; }

echo "==> Pulling $IMAGE:$TAG"
docker pull "$IMAGE:$TAG"

echo "==> Starting database"
compose up -d --wait db

echo "==> Applying migrations"
if ! compose --profile migrate run --rm migrate; then
  echo "ERROR: migrations failed, the running app version was left untouched" >&2
  exit 1
fi

echo "==> Starting app $TAG"
compose up -d app

echo "==> Smoke test /health"
healthy=""
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/health; then
    healthy="yes"
    echo
    break
  fi
  sleep 2
done
if [ -z "$healthy" ]; then
  echo "ERROR: smoke test failed, /health is not answering 200" >&2
  compose logs --tail 50 app >&2
  exit 1
fi

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
