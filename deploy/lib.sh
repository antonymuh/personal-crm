# Shared helpers for the deploy scripts. Sourced, not run on its own.
# Expects the current directory to be the deploy directory of one environment
# (/opt/crm/prod or /opt/crm/staging); call use_env first.

IMAGE="ghcr.io/antonymuh/personal-crm"
DB_USER="crm"
DB_NAME="personal_crm"
BACKUP_DIR="backups"
# How many backups of each kind (daily, before a deploy) to keep.
BACKUPS_TO_KEEP=7
# Images older than this are removed from the server after a prod deploy.
IMAGE_MAX_AGE_DAYS=14

# Picks the environment: its docker compose project and the local port of its app.
# Refuses to run from another environment's directory, so prod and staging never mix.
use_env() {
  ENV_NAME="$1"
  case "$ENV_NAME" in
    prod) APP_PORT=3000 ;;
    staging) APP_PORT=3001 ;;
    *)
      echo "ERROR: unknown environment '$ENV_NAME', expected prod or staging" >&2
      exit 1
      ;;
  esac
  if [ "$(basename "$(pwd)")" != "$ENV_NAME" ]; then
    echo "ERROR: $(pwd) is not the $ENV_NAME deploy directory (/opt/crm/$ENV_NAME)" >&2
    exit 1
  fi
  export APP_PORT
}

compose() { docker compose -p "$ENV_NAME" -f compose.yaml "$@"; }

# Dumps the environment's database to backups/<UTC time>_<label>.dump and prints the file path.
# The dump goes to a .partial file first, so a failed dump never looks like a valid backup.
# Backups contain personal data: the folder is 700, the files are 600.
backup_database() {
  local label="$1"
  local file
  file="$BACKUP_DIR/$(date -u +%Y-%m-%d_%H%M%S)_${label}.dump"

  mkdir -p "$BACKUP_DIR"
  chmod 700 "$BACKUP_DIR"

  if ! (umask 077 && compose exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$file.partial"); then
    rm -f "$file.partial"
    echo "ERROR: pg_dump failed" >&2
    return 1
  fi
  if [ ! -s "$file.partial" ]; then
    rm -f "$file.partial"
    echo "ERROR: pg_dump produced an empty file" >&2
    return 1
  fi
  mv "$file.partial" "$file"

  echo "Backup: $file ($(du -h "$file" | cut -f1)), free disk: $(df -h . | awk 'NR==2 {print $4}')" >&2
  echo "$file"
}

# Drops the environment's database, creates it empty and loads a backup file into it.
# The app must be stopped first.
load_backup() {
  local file="$1"
  echo "==> Recreating database $DB_NAME"
  compose exec -T db psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS $DB_NAME WITH (FORCE)" \
    -c "CREATE DATABASE $DB_NAME OWNER $DB_USER" || return 1
  echo "==> Loading the backup"
  compose exec -T db pg_restore -U "$DB_USER" -d "$DB_NAME" --no-owner --exit-on-error < "$file"
}

# Waits up to a minute for the app to answer 200 on /health.
smoke_health() {
  for _ in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:$APP_PORT/health"; then
      echo
      return 0
    fi
    sleep 2
  done
  echo "ERROR: smoke test failed, /health is not answering 200" >&2
  compose logs --tail 50 app >&2
  return 1
}

# Keeps the newest $BACKUPS_TO_KEEP backups of each kind: daily ones and the ones taken before a deploy.
# Copies taken by restore.sh (before-restore-*) are never removed automatically.
prune_backups() {
  local pattern
  for pattern in '_daily\.dump$' '_before-([0-9a-f]{7}|none)\.dump$'; do
    # Names start with the UTC time, so sorting by name puts the newest first.
    ls -1 "$BACKUP_DIR" | { grep -E -- "$pattern" || true; } | sort -r | tail -n "+$((BACKUPS_TO_KEEP + 1))" |
      while read -r f; do
        rm -f -- "${BACKUP_DIR:?}/$f"
        echo "Removed old backup: $f" >&2
      done
  done
}

# Removes app images older than $IMAGE_MAX_AGE_DAYS days, except the two latest prod versions
# (current and previous, needed for a rollback) and the current staging version.
remove_old_images() {
  local keep cutoff t created
  keep="$(cat ../prod/.current-tag ../prod/.previous-tag ../staging/.current-tag 2>/dev/null || true)"
  cutoff="$(date -u -d "$IMAGE_MAX_AGE_DAYS days ago" +%s)"
  docker images "$IMAGE" --format '{{.Tag}}' | while read -r t; do
    if [ "$t" = "<none>" ] || grep -qxF -- "$t" <<< "$keep"; then
      continue
    fi
    created="$(date -u -d "$(docker image inspect -f '{{.Created}}' "$IMAGE:$t")" +%s)"
    if [ "$created" -lt "$cutoff" ]; then
      docker rmi "$IMAGE:$t" >/dev/null && echo "Removed image $t" || true
    fi
  done
  docker image prune -f >/dev/null
}

# Installs or updates the systemd timer that backs up the prod database every day.
# The unit files live in deploy/systemd; nothing is touched when they have not changed.
install_backup_timer() {
  local unit changed=0
  for unit in systemd/crm-prod-backup.service systemd/crm-prod-backup.timer; do
    if ! cmp -s "$unit" "/etc/systemd/system/$(basename "$unit")"; then
      sudo -n install -m 644 "$unit" /etc/systemd/system/
      changed=1
    fi
  done
  if [ "$changed" = 1 ]; then
    sudo -n systemctl daemon-reload
  fi
  sudo -n systemctl enable --now crm-prod-backup.timer
}
