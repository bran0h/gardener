#!/bin/sh
# Nightly backup of the self-hosted Supabase on 169.58.223.190 (and with it every
# hozza.dev app: cloud, auth, pdf, gardener). Installed at /opt/backup/backup.sh,
# run by /etc/cron.d/hozza-backup at 02:30.
#
#   1. roles + the postgres and _supabase databases (pg_dump custom format)
#   2. storage files (photos)          /opt/supabase/volumes/storage
#   3. config needed to bring it back  .env (JWT + vault keys), overrides, Caddyfile, API env
#   4. kept 7 days here, 30 days in Cloudflare R2 (/opt/backup/r2.env)
#   5. touches /opt/backup/heartbeat/backup-ok only after the off-site copy worked;
#      gardener-api shows it on /health and the GitHub monitor alerts when it is old.
set -eu
umask 077

ROOT=/opt/backup
TS=$(date -u +%Y-%m-%dT%H%MZ)
DIR=$ROOT/local/$TS
KEEP_LOCAL=7
KEEP_REMOTE_DAYS=30

log() { echo "$(date -u +%FT%TZ) $*"; }

mkdir -p "$DIR" "$ROOT/heartbeat"
log "backup $TS starting"

# 1. Database --------------------------------------------------------------------
docker exec supabase-db pg_dumpall -U supabase_admin --roles-only > "$DIR/roles.sql"
docker exec supabase-db pg_dump -U supabase_admin -Fc -d postgres > "$DIR/postgres.dump"
docker exec supabase-db pg_dump -U supabase_admin -Fc -d _supabase > "$DIR/_supabase.dump"

# A dump that pg_restore cannot list is not a backup.
for f in postgres.dump _supabase.dump; do
  docker run --rm -v "$DIR:/b:ro" postgres:17-alpine pg_restore --list "/b/$f" > /dev/null
done

# 2. Photos and other stored files ---------------------------------------------------
tar -czf "$DIR/storage.tar.gz" -C /opt/supabase/volumes storage

# 3. Config (secrets: the bucket is private) ----------------------------------------------
tar -czf "$DIR/config.tar.gz" \
  /opt/supabase/.env \
  /opt/supabase/docker-compose.hozza.yml \
  /opt/supabase/volumes/proxy/caddy/Caddyfile \
  /opt/gardener/.env.api \
  /etc/cron.d/hozza-backup \
  2>/dev/null || tar -czf "$DIR/config.tar.gz" /opt/supabase/.env /opt/supabase/docker-compose.hozza.yml

(cd "$DIR" && sha256sum * > SHA256SUMS)
log "local copy done: $(du -sh "$DIR" | cut -f1)"

# 4a. Keep the newest few locally -----------------------------------------------------------
ls -1d "$ROOT"/local/*/ 2>/dev/null | sort | head -n -"$KEEP_LOCAL" | xargs -r rm -rf

# 4b. Off-site: Cloudflare R2 ------------------------------------------------------------------
if [ ! -f "$ROOT/r2.env" ]; then
  log "WARNING: $ROOT/r2.env missing, no off-site copy (heartbeat not updated)"
  exit 2
fi
. "$ROOT/r2.env"

rclone() {
  docker run --rm \
    -e RCLONE_CONFIG_R2_TYPE=s3 \
    -e RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
    -e RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
    -e RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
    -e RCLONE_CONFIG_R2_ENDPOINT="https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com" \
    -e RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true \
    -v "$ROOT/local:/local:ro" \
    rclone/rclone:1.68 "$@"
}

rclone copy "/local/$TS" "r2:$R2_BUCKET/nightly/$TS" --s3-no-check-bucket
rclone check "/local/$TS" "r2:$R2_BUCKET/nightly/$TS" --one-way
rclone delete "r2:$R2_BUCKET/nightly" --min-age "${KEEP_REMOTE_DAYS}d"
rclone rmdirs "r2:$R2_BUCKET/nightly" --leave-root

# 5. Heartbeat -----------------------------------------------------------------------------------
touch "$ROOT/heartbeat/backup-ok"
log "backup $TS done, copied to r2:$R2_BUCKET/nightly/$TS"
