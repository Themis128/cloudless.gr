#!/usr/bin/env bash
#
# notion-discover-esp32.sh — find ESP32 databases accessible to the Notion integration.
#
# The notion-restore-esp32 workflow returned 0 rows because the Notion integration
# may not have access to the ESP32 Devices / Telemetry databases, or the IDs are wrong.
#
# This script:
#   1. Lists all pages and databases accessible to the integration
#   2. Filters for anything ESP32/devices/telemetry related
#   3. Reports all database IDs found so the restore script can be updated

set -uo pipefail

NOTION_VERSION="2022-06-28"
HEADERS=(
  -H "Authorization: Bearer ${NOTION_API_KEY}"
  -H "Notion-Version: ${NOTION_VERSION}"
  -H "Content-Type: application/json"
)

note() { printf "[esp32-discover] %s\n" "$*"; }

note "=== notion-discover-esp32 $(date -u '+%F %T')Z ==="

# ---------------------------------------------------------------------------
# Step 1: Search for all databases accessible to the integration
# ---------------------------------------------------------------------------
note "Querying all accessible databases..."
DB_RESULT=$(curl -sS -X POST "https://api.notion.com/v1/search" \
  "${HEADERS[@]}" \
  -d '{"filter":{"value":"database","property":"object"},"page_size":100}')

ALL_DBS=$(echo "$DB_RESULT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
results = data.get('results', [])
print(f'Total databases accessible: {len(results)}')
for r in results:
    rid = r.get('id','')
    title = ''
    title_prop = r.get('title', [])
    if title_prop:
        title = ''.join(t.get('plain_text','') for t in title_prop)
    else:
        for v in r.get('properties', {}).values():
            if v.get('type') == 'title':
                title = ''.join(t.get('plain_text','') for t in v.get('title', []))
                break
    archived = r.get('archived', False)
    print(f'  DB: {rid} | {title} | archived={archived}')
" 2>/dev/null || echo "  (parse error)")

note "$ALL_DBS"

# ---------------------------------------------------------------------------
# Step 2: Search specifically for ESP32 / devices / telemetry pages
# ---------------------------------------------------------------------------
note ""
note "Searching for ESP32 / devices / telemetry pages..."
for QUERY in "ESP32" "Devices" "Telemetry" "ESPHome" "Watchdog"; do
  RESULT=$(curl -sS -X POST "https://api.notion.com/v1/search" \
    "${HEADERS[@]}" \
    -d "{\"query\": \"${QUERY}\", \"page_size\": 10}")

  MATCHES=$(echo "$RESULT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for r in data.get('results', []):
    rid = r.get('id','')
    obj = r.get('object','')
    archived = r.get('archived', False)
    title = ''
    if obj == 'database':
        for t in r.get('title', []):
            title += t.get('plain_text','')
    else:
        for v in r.get('properties', {}).values():
            if v.get('type') == 'title':
                title = ''.join(t.get('plain_text','') for t in v.get('title', []))
                break
    if title or rid:
        print(f'  {obj}: {rid} | {title} | archived={archived}')
" 2>/dev/null || echo "  (no matches)")

  note "Query '${QUERY}': ${MATCHES:-no matches}"
done

# ---------------------------------------------------------------------------
# Step 3: Try the hardcoded DB IDs from notion-restore-esp32.sh directly
# ---------------------------------------------------------------------------
note ""
note "Testing hardcoded DB IDs from restore script..."
for DB_ID in "022b2212-995b-4e29-8c3c-900297b435b9" "3214d53d-90ff-4b7a-81c3-f689a92ee167"; do
  RESP=$(curl -sS -X POST "https://api.notion.com/v1/databases/${DB_ID}/query" \
    "${HEADERS[@]}" \
    -d '{"page_size":1}')
  OBJ=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('object',''))" 2>/dev/null || echo "")
  if [ "$OBJ" = "list" ]; then
    COUNT=$(echo "$RESP" | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('results',[])))" 2>/dev/null || echo "?")
    note "  DB ${DB_ID}: ACCESSIBLE (returned ${COUNT} rows)"
  else
    CODE=$(echo "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('code','unknown'))" 2>/dev/null || echo "unknown")
    MSG=$(echo "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('message',''))" 2>/dev/null || echo "")
    note "  DB ${DB_ID}: NOT accessible (${CODE}: ${MSG})"
  fi
done

note ""
note "=== DONE ==="
note "If the hardcoded IDs are 'object_not_found': the Notion integration needs"
note "to be shared with those databases in the Notion UI:"
note "  1. Open ESP32 Devices database in Notion"
note "  2. Click Share → invite the Cloudless Notion integration"
note "  3. Repeat for ESP32 Telemetry database"
note "  4. Re-run notion-restore-esp32 workflow"
