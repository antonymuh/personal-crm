#!/usr/bin/env bash
# Daily backup of the production database: backups/<UTC time>_daily.dump, the newest 7 are kept.
# Run by the crm-prod-backup systemd timer at 03:00 Moscow time; can also be run by hand.
# Usage: ./backup.sh
set -euo pipefail

cd "$(dirname "$0")"
source ./lib.sh
use_env prod

# compose.yaml needs the app version even to reach the database container.
TAG="$(cat .current-tag 2>/dev/null || true)"
if [ -z "$TAG" ]; then
  echo "ERROR: $(pwd)/.current-tag is missing, prod has not been deployed yet" >&2
  exit 1
fi
export IMAGE_TAG="$TAG"

# Not in the middle of a deploy: wait for it to finish.
exec 9> .deploy.lock
flock 9

echo "==> Backing up the prod database"
backup_database daily >/dev/null
prune_backups
