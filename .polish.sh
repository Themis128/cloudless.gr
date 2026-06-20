#!/usr/bin/env bash
set -uo pipefail
A=$(printf admin:9d75a13d583b9a9ccc57e501045eaf02 | base64 -w0)

echo "=== delete duplicate Cloudless App Full Access role (keep 6a36ef958fbd6c69c, drop 6a36ef738f55b4c6e) ==="
curl -sS -X DELETE -H "Espo-Authorization: $A" "https://espocrm.cloudless.gr/api/v1/Role/6a36ef738f55b4c6e" -o /dev/null -w '  HTTP=%{http_code}\n'

echo
echo "=== set timezone to Europe/Athens ==="
curl -sS -X PUT -H "Espo-Authorization: $A" -H 'Content-Type: application/json' \
  -d '{"timeZone":"Europe/Athens"}' \
  "https://espocrm.cloudless.gr/api/v1/Settings" -o /dev/null -w '  HTTP=%{http_code}\n'

echo
echo "=== verify ==="
curl -sS -H "Espo-Authorization: $A" "https://espocrm.cloudless.gr/api/v1/Settings" -o /tmp/s
grep -oE '"timeZone":"[^"]*"|"defaultCurrency":"[^"]*"|"language":"[^"]*"' /tmp/s | head
curl -sS -H "Espo-Authorization: $A" "https://espocrm.cloudless.gr/api/v1/Role?maxSize=10" -o /tmp/r
grep -oE '"name":"Cloudless[^"]*"' /tmp/r | sort -u
rm -f /tmp/s /tmp/r .polish.sh
