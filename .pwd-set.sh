#!/usr/bin/env bash
set -uo pipefail
OLD=$(printf admin:9d75a13d583b9a9ccc57e501045eaf02 | base64 -w0)
NEW_PWD='TH!123789th!'

echo "=== set admin password via API ==="
curl -sS -X PUT -H "Espo-Authorization: $OLD" -H 'Content-Type: application/json' \
  -d "{\"password\":\"$NEW_PWD\"}" \
  "https://espocrm.cloudless.gr/api/v1/User/6a36eb5087aa6107f" -o /tmp/u -w '  HTTP=%{http_code}\n'
grep -oE '"userName":"[^"]*"|"type":"[^"]*"' /tmp/u | head -2

echo
echo "=== verify new password works ==="
NEW=$(printf "admin:$NEW_PWD" | base64 -w0)
curl -sS -H "Espo-Authorization: $NEW" "https://espocrm.cloudless.gr/api/v1/App/user" -o /tmp/v -w '  HTTP=%{http_code}\n'
grep -oE '"userName":"[^"]*"|"type":"[^"]*"|"isActive":(true|false)' /tmp/v | head -3

echo
echo "=== verify old password no longer works (should be 401) ==="
curl -sS -H "Espo-Authorization: $OLD" "https://espocrm.cloudless.gr/api/v1/App/user" -o /dev/null -w '  HTTP=%{http_code}\n'

rm -f /tmp/u /tmp/v .pwd-set.sh
