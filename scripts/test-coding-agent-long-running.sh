#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/tbaltzakis/cloudless.gr"
cd "$PROJECT_DIR"

BASE_URL="${1:-http://localhost:8787}"

TOKEN="$(grep '^AGENT_AUTH_TOKEN=' .env.local | tail -n1 | cut -d= -f2-)"

if [ -z "$TOKEN" ]; then
  echo "Missing AGENT_AUTH_TOKEN in .env.local"
  exit 1
fi

echo "==> Testing CodingAgent lifecycle at: $BASE_URL"

echo
echo "==> 1. Unauthenticated status should return 401"
curl -i "$BASE_URL/api/agents/coding-agent/default/status"

echo
echo
echo "==> 2. Authenticated status"
curl -i \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/api/agents/coding-agent/default/status"

echo
echo
echo "==> 3. Submit coding task"
curl -i \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"prompt":"Review my Cloudflare Worker routing, /api/agents prefix rewrite, Bearer auth, Workers AI binding, and static assets fallback."}' \
  "$BASE_URL/api/agents/coding-agent/default/task"

echo
echo
echo "==> 4. Status after task"
curl -i \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/api/agents/coding-agent/default/status"

echo
echo
echo "==> 5. Result after task"
curl -i \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/api/agents/coding-agent/default/result"

echo
echo
echo "✅ CodingAgent lifecycle test complete."
