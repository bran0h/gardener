#!/bin/sh
# Proves the newest local backup restores: loads it into a throwaway Postgres
# (the same supabase/postgres image as production) and compares row counts of
# the important tables with the live database. Nothing live is touched.
#
#   sh /opt/backup/restore-test.sh [backup-dir]
set -eu

ROOT=/opt/backup
DIR=${1:-$(ls -1d "$ROOT"/local/*/ | sort | tail -n 1)}
DIR=${DIR%/}
IMAGE=$(docker inspect supabase-db --format '{{.Config.Image}}')
NAME=restore-test-$$
PW=$(head -c 18 /dev/urandom | base64 | tr -d '/+=')

echo "restoring $DIR into a throwaway $IMAGE"
cleanup() { docker rm -f "$NAME" > /dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$NAME" -e POSTGRES_PASSWORD="$PW" -v "$DIR:/b:ro" "$IMAGE" > /dev/null
i=0
until docker exec "$NAME" pg_isready -U postgres -h 127.0.0.1 > /dev/null 2>&1; do
  i=$((i + 1)); [ $i -gt 60 ] && { echo "postgres did not start"; exit 1; }; sleep 2
done
sleep 5  # the image runs its own init scripts after the first ready

# Roles first (existing ones just error), then the database, as the image's superuser.
docker exec "$NAME" psql -U supabase_admin -d postgres -q -f /b/roles.sql > /dev/null 2>&1 || true
docker exec "$NAME" pg_restore -U supabase_admin -d postgres --clean --if-exists --no-owner --role=supabase_admin /b/postgres.dump > /tmp/$NAME.log 2>&1 || true

COUNTS="select 'auth.users', count(*) from auth.users
  union all select 'profiles', count(*) from public.profiles
  union all select 'files (cloud)', count(*) from public.files
  union all select 'folders (cloud)', count(*) from public.folders
  union all select 'gardener_homes', count(*) from public.gardener_homes
  union all select 'gardener_plants', count(*) from public.gardener_plants
  union all select 'gardener_care_logs', count(*) from public.gardener_care_logs
  union all select 'storage.objects', count(*) from storage.objects
  order by 1"

docker exec supabase-db psql -U postgres -At -F'|' -c "$COUNTS" > /tmp/$NAME.live
docker exec "$NAME" psql -U supabase_admin -d postgres -At -F'|' -c "$COUNTS" > /tmp/$NAME.restored

printf '%-22s %8s %9s\n' table live restored
paste -d'|' /tmp/$NAME.live /tmp/$NAME.restored \
  | awk -F'|' '{ printf "%-22s %8s %9s  %s\n", $1, $2, $4, ($2 == $4 ? "ok" : "DIFFERENT") }'
if cmp -s /tmp/$NAME.live /tmp/$NAME.restored; then
  echo "RESTORE OK"
else
  echo "RESTORE DIFFERS (writes since the backup can explain small differences)"
  grep -iE "error" /tmp/$NAME.log | head -5
fi
rm -f /tmp/$NAME.live /tmp/$NAME.restored /tmp/$NAME.log
