#!/bin/sh
# Every night at 03:00 Dhaka (21:00 UTC): dump the database and sync uploads to the bucket,
# keeping BACKUP_KEEP_DAYS of dumps. Restore: gunzip -c dump.sql.gz | psql.
set -eu
apk add --no-cache rclone >/dev/null

# rclone reads its remote from env, so no config file is needed.
export RCLONE_CONFIG_OFFSITE_TYPE=s3
export RCLONE_CONFIG_OFFSITE_PROVIDER="${BACKUP_S3_PROVIDER:-Cloudflare}"
export RCLONE_CONFIG_OFFSITE_ENDPOINT="$BACKUP_S3_ENDPOINT"
export RCLONE_CONFIG_OFFSITE_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY"
export RCLONE_CONFIG_OFFSITE_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY"
target="offsite:${BACKUP_S3_BUCKET}"
keep="${BACKUP_KEEP_DAYS:-14}"

run() {
  name="db-$(date -u +%Y%m%d-%H%M).sql.gz"
  pg_dump --no-owner | gzip -9 > "/tmp/$name"
  rclone copyto "/tmp/$name" "$target/db/$name"
  rm -f "/tmp/$name"
  rclone sync /uploads "$target/uploads"
  rclone delete --min-age "${keep}d" "$target/db"
  echo "backup ok: $name"
}

while :; do
  now=$(date -u +%s)
  next=$(date -u -d "$(date -u +%Y-%m-%d) 21:00" +%s 2>/dev/null || echo $((now + 86400)))
  [ "$next" -le "$now" ] && next=$((next + 86400))
  sleep $((next - now))
  run || echo "backup FAILED" >&2
done
