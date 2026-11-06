# Shared helpers for deploy.sh and restore.sh. Sourced, not run on its own.
# Expects the current directory to be the deploy directory (/opt/crm/prod).

IMAGE="ghcr.io/antonymuh/personal-crm"
DB_USER="crm"
DB_NAME="personal_crm"
BACKUP_DIR="backups"

compose() { docker compose -p prod -f compose.yaml "$@"; }

# Dumps the production database to backups/<UTC time>_<label>.dump and prints the file path.
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

# Waits up to a minute for the app to answer 200 on /health.
smoke_health() {
  for _ in $(seq 1 30); do
    if curl -fsS http://127.0.0.1:3000/health; then
      echo
      return 0
    fi
    sleep 2
  done
  echo "ERROR: smoke test failed, /health is not answering 200" >&2
  compose logs --tail 50 app >&2
  return 1
}
