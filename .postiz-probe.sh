#!/usr/bin/env bash
set -uo pipefail
CSV="/mnt/c/Users/baltz/Downloads/rootkey (1).csv"
KEYID=$(tail -1 "$CSV" | tr -d '\r\n' | awk -F, '{print $1}')
SECRET=$(tail -1 "$CSV" | tr -d '\r\n' | awk -F, '{print $2}')
export AWS_ACCESS_KEY_ID="$KEYID" AWS_SECRET_ACCESS_KEY="$SECRET" AWS_REGION=us-east-1
PKEY=$(aws ssm get-parameter --name /cloudless/production/POSTIZ_API_KEY --with-decryption --query 'Parameter.Value' --output text)
BASE="https://postiz.cloudless.gr"

echo "=== probe known Postiz endpoints ==="
for P in /api/public/v1/integrations \
         /api/public/v1/integrations/is-connected \
         /api/public/v1/groups \
         /api/public/v1/sets \
         /api/public/v1/customer \
         /api/public/v1/customers \
         /api/public/v1/posts \
         /api/v1/groups \
         /public/v1/groups \
         /api/health ; do
  CODE=$(curl -s -o /tmp/b -w '%{http_code}' --max-time 8 -H "Authorization: $PKEY" "$BASE$P")
  printf '  %-45s HTTP %s   ' "$P" "$CODE"
  head -c 120 /tmp/b 2>/dev/null
  echo
done
rm -f /tmp/b .postiz-probe.sh
