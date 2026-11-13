# Shared helpers for the deploy scripts. Sourced, not run on its own.
# Expects the current directory to be the deploy directory of one environment
# (/opt/crm/prod or /opt/crm/staging); call use_env first.

IMAGE="ghcr.io/antonymuh/personal-crm"
DB_USER="crm"
DB_NAME="personal_crm"
BACKUP_DIR="backups"

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

# Removes app images that no environment on this server runs or keeps for a rollback
# (the current and previous versions of prod and of staging).
remove_unused_images() {
  local keep
  keep="$(cat ../*/.current-tag ../*/.previous-tag 2>/dev/null || true)"
  docker images "$IMAGE" --format '{{.Tag}}' | while read -r t; do
    if ! grep -qxF -- "$t" <<< "$keep"; then
      docker rmi "$IMAGE:$t" >/dev/null || true
    fi
  done
  docker image prune -f >/dev/null
}
