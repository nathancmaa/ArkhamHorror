#!/bin/sh
#
# Backups for the NAS stack (the `backup` service in docker-compose.nas.yaml).
#
# Writes a pg_dump custom-format archive of the whole database to /backups:
#   - once when the container starts, which is every stack deploy. `migrate`
#     waits for this one, so each upgrade leaves a dump taken before it;
#   - then once a day at ARKHAM_BACKUP_AT (HH:MM, container time, which is UTC).
# Dumps older than ARKHAM_BACKUP_KEEP_DAYS are deleted. Restoring one is
# described in nas/README.md.
#
# A failed dump is logged and does not stop the app from starting: the
# readiness file is written after the startup attempt either way.
#
set -eu

export PGHOST="${PGHOST:-db}"
export PGUSER="${PGUSER:-arkham_pg_user}"
export PGDATABASE="${PGDATABASE:-arkham-horror-backend}"
export PGPASSWORD="${PGPASSWORD:-${POSTGRES_PASSWORD:-}}"

DIR=/backups
AT="${ARKHAM_BACKUP_AT:-11:00}"
KEEP_DAYS="${ARKHAM_BACKUP_KEEP_DAYS:-14}"
READY=/tmp/backup-ready

dump() {
  ts="$(date +%Y%m%d-%H%M%S)"
  out="$DIR/arkham-$ts.dump"
  tmp="$DIR/.arkham-$ts.dump.partial"
  if pg_dump --format=custom --file="$tmp"; then
    mv "$tmp" "$out"
    echo "backup: wrote $(basename "$out") ($(du -h "$out" | cut -f1))"
    # -exec rm rather than -delete, which not every busybox build has.
    find "$DIR" -maxdepth 1 -name 'arkham-*.dump' -mtime +"$KEEP_DAYS" -print -exec rm -f {} + |
      sed 's/^/backup: pruned /'
  else
    rm -f "$tmp"
    echo "backup: pg_dump failed; the previous dumps are untouched" >&2
  fi
}

mkdir -p "$DIR"
rm -f "$READY"

echo "backup: waiting for database at $PGHOST..."
until pg_isready -q; do sleep 2; done

dump || true
touch "$READY"

echo "backup: next dumps daily at $AT (container time $(date +%H:%M)), keeping $KEEP_DAYS days"
last=""
while :; do
  if [ "$(date +%H:%M)" = "$AT" ] && [ "$(date +%F)" != "$last" ]; then
    last="$(date +%F)"
    dump || true
  fi
  sleep 20
done
