#!/bin/sh
# Sourced by PVC backup CronJobs after apk add rclone.
# Expects: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET, KEY, LOCAL_FILE
set -euo pipefail

: "${R2_ACCESS_KEY_ID:?}"
: "${R2_SECRET_ACCESS_KEY:?}"
: "${R2_ENDPOINT:?}"
: "${R2_BUCKET:?}"
: "${KEY:?}"
: "${LOCAL_FILE:?}"

export RCLONE_CONFIG_R2_TYPE=s3
export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
export RCLONE_CONFIG_R2_ENDPOINT="${R2_ENDPOINT}"
export RCLONE_CONFIG_R2_REGION="${R2_REGION:-auto}"
export RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true

SIZE=$(wc -c < "${LOCAL_FILE}")
echo "→ uploading ${SIZE} bytes → r2://${R2_BUCKET}/${KEY}"
rclone copyto "${LOCAL_FILE}" "r2:${R2_BUCKET}/${KEY}" --s3-no-check-bucket
REMOTE_SIZE=$(rclone lsjson "r2:${R2_BUCKET}/${KEY}" | sed -n 's/.*"Size": *\([0-9]*\).*/\1/p' | head -1)
echo "✅ remote size ${REMOTE_SIZE} bytes"
if [ "${REMOTE_SIZE:-0}" -lt 10000 ]; then
  echo "❌ backup suspiciously small (<10KB) — failing job for retry"
  exit 1
fi
