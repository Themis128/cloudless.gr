#!/bin/bash
# Managed: infrastructure/omv - nightly Nextcloud DB + config backup
set -euo pipefail
DEST=/srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7/NAS-Backup/nextcloud/nightly
KEEP_DAYS=${KEEP_DAYS:-14}
TS=$(date +%Y%m%d-%H%M%S); D=$DEST/$TS
mkdir -p "$D"; chmod 700 "$DEST"
docker exec nextcloud-db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' | gzip -6 > "$D/nextcloud-db.sql.gz.part"
mv "$D/nextcloud-db.sql.gz.part" "$D/nextcloud-db.sql.gz"
cp -a /srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7/workspace/nextcloud-html/config "$D/config"
gzip -t "$D/nextcloud-db.sql.gz"
find "$DEST" -mindepth 1 -maxdepth 1 -type d -mtime +"$KEEP_DAYS" -exec rm -rf {} +
echo "ok $D $(du -sh "$D" | cut -f1)"
