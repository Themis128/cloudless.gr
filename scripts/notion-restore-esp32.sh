#!/usr/bin/env bash
#
# notion-restore-esp32.sh — reconstruct the ESP32 ESPHome Watchdog page
# that was accidentally overwritten by notion-update-cluster-docs on 2026-06-02.
#
# Page ID: 3677d82c-410a-81e4-a6db-e9ae89578fda
# Original title: ESP32 ESPHome Watchdog — Pi Cluster Monitor (v2)
#
# This script:
#   1. Reads the ESP32 Devices and Telemetry Notion databases to populate
#      what it can from structured data
#   2. Rebuilds a page skeleton with known facts about the ESPHome watchdog
#   3. Adds a banner asking the user to verify content from page history
#
# For a perfect restore: Notion UI → page → ··· → Page history → restore
# the version from before 2026-06-02 15:19 UTC.

set -uo pipefail

NOTION_VERSION="2022-06-28"
HEADERS=(
  -H "Authorization: Bearer ${NOTION_API_KEY}"
  -H "Notion-Version: ${NOTION_VERSION}"
  -H "Content-Type: application/json"
)

TARGET_PAGE_ID="3677d82c-410a-81e4-a6db-e9ae89578fda"
DEVICES_DB_ID="${NOTION_ESP32_DEVICES_DB_ID:-022b2212-995b-4e29-8c3c-900297b435b9}"
TELEMETRY_DB_ID="${NOTION_ESP32_TELEMETRY_DB_ID:-3214d53d-90ff-4b7a-81c3-f689a92ee167}"

note() { printf "[esp32-restore] %s\n" "$*"; }

note "=== notion-restore-esp32 $(date -u '+%F %T')Z ==="
note "Target page: ${TARGET_PAGE_ID}"

# ---------------------------------------------------------------------------
# Step 1: Read ESP32 Devices DB
# ---------------------------------------------------------------------------
note "Reading ESP32 Devices database..."
DEVICES_RAW=$(curl -sS -X POST "https://api.notion.com/v1/databases/${DEVICES_DB_ID}/query" \
  "${HEADERS[@]}" \
  -d '{"page_size": 100}')

DEVICES_INFO=$(echo "$DEVICES_RAW" | python3 -c "
import json, sys
data = json.load(sys.stdin)
rows = []
for r in data.get('results', []):
    props = r.get('properties', {})
    row = {}
    for k, v in props.items():
        t = v.get('type','')
        if t == 'title':
            row[k] = ''.join(x.get('plain_text','') for x in v.get('title',[]))
        elif t == 'rich_text':
            row[k] = ''.join(x.get('plain_text','') for x in v.get('rich_text',[]))
        elif t == 'select':
            row[k] = (v.get('select') or {}).get('name','')
        elif t == 'checkbox':
            row[k] = str(v.get('checkbox', False))
        elif t == 'url':
            row[k] = v.get('url','') or ''
    rows.append(row)
print(json.dumps(rows, indent=2))
" 2>/dev/null || echo "[]")

note "  Devices rows: $(echo "$DEVICES_INFO" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))' 2>/dev/null)"

# ---------------------------------------------------------------------------
# Step 2: Read ESP32 Telemetry DB (recent entries)
# ---------------------------------------------------------------------------
note "Reading ESP32 Telemetry database (last 10 entries)..."
TELEMETRY_RAW=$(curl -sS -X POST "https://api.notion.com/v1/databases/${TELEMETRY_DB_ID}/query" \
  "${HEADERS[@]}" \
  -d '{"page_size": 10, "sorts": [{"timestamp": "created_time", "direction": "descending"}]}')

TELEMETRY_INFO=$(echo "$TELEMETRY_RAW" | python3 -c "
import json, sys
data = json.load(sys.stdin)
rows = []
for r in data.get('results', []):
    props = r.get('properties', {})
    row = {'_created': r.get('created_time','')}
    for k, v in props.items():
        t = v.get('type','')
        if t == 'title':
            row[k] = ''.join(x.get('plain_text','') for x in v.get('title',[]))
        elif t == 'rich_text':
            row[k] = ''.join(x.get('plain_text','') for x in v.get('rich_text',[]))
        elif t == 'number':
            row[k] = str(v.get('number',''))
        elif t == 'select':
            row[k] = (v.get('select') or {}).get('name','')
        elif t == 'date':
            row[k] = (v.get('date') or {}).get('start','')
    rows.append(row)
print(json.dumps(rows, indent=2))
" 2>/dev/null || echo "[]")

note "  Telemetry rows fetched: $(echo "$TELEMETRY_INFO" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))' 2>/dev/null)"

# ---------------------------------------------------------------------------
# Step 3: Restore page title first
# ---------------------------------------------------------------------------
note "Restoring page title..."
TITLE_PATCH=$(python3 -c "
import json
payload = {
    'properties': {
        'title': {'title': [{'text': {'content': 'ESP32 ESPHome Watchdog — Pi Cluster Monitor (v2)'}}]}
    }
}
print(json.dumps(payload))
")
curl -sS -X PATCH "https://api.notion.com/v1/pages/${TARGET_PAGE_ID}" \
  "${HEADERS[@]}" \
  -d "$TITLE_PATCH" >/dev/null
note "  Title restored"

# ---------------------------------------------------------------------------
# Step 4: Clear overwritten blocks and rebuild from known data
# ---------------------------------------------------------------------------
note "Clearing overwritten blocks..."
EXISTING=$(curl -sS "https://api.notion.com/v1/blocks/${TARGET_PAGE_ID}/children?page_size=100" "${HEADERS[@]}")
echo "$EXISTING" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for b in data.get('results', []):
    print(b['id'])
" 2>/dev/null | while IFS= read -r BID; do
  curl -sS -X DELETE "https://api.notion.com/v1/blocks/${BID}" "${HEADERS[@]}" >/dev/null
done
note "  Cleared"

# ---------------------------------------------------------------------------
# Step 5: Rebuild page content from DB data + known facts
# ---------------------------------------------------------------------------
note "Rebuilding page content..."

NEW_BLOCKS=$(python3 -c "
import json, sys

devices = json.loads(sys.argv[1])
telemetry = json.loads(sys.argv[2])

def p(text):
    return {'object':'block','type':'paragraph','paragraph':{'rich_text':[{'text':{'content':text}}]}}
def h1(text):
    return {'object':'block','type':'heading_1','heading_1':{'rich_text':[{'text':{'content':text}}]}}
def h2(text):
    return {'object':'block','type':'heading_2','heading_2':{'rich_text':[{'text':{'content':text}}]}}
def bul(text):
    return {'object':'block','type':'bulleted_list_item','bulleted_list_item':{'rich_text':[{'text':{'content':text}}]}}
def callout(text, emoji='⚠️'):
    return {'object':'block','type':'callout','callout':{'rich_text':[{'text':{'content':text}}],'icon':{'type':'emoji','emoji':emoji}}}
def divider():
    return {'object':'block','type':'divider','divider':{}}

blocks = [
    callout('CONTENT PARTIALLY RESTORED — 2026-06-02: This page was accidentally overwritten by notion-update-cluster-docs.yml. The prose documentation was lost. For the full original content: open ••• menu → Page history → restore version before 15:19 UTC on 2026-06-02. The structured database data below was reconstructed from the ESP32 Devices and Telemetry databases.', '⚠️'),
    divider(),
    h1('ESP32 ESPHome Watchdog — Pi Cluster Monitor (v2)'),
    p('Hardware watchdog for the omv k3s cluster Pi nodes. Runs ESPHome firmware on ESP32 hardware to monitor cluster health and trigger physical resets if the Pi becomes unresponsive.'),
    divider(),
]

# Devices section
blocks.append(h2('Registered Devices'))
if devices:
    for d in devices:
        name = next((v for k,v in d.items() if k.lower() in ['name','device','title'] and v), None)
        if name:
            details = ', '.join(f'{k}: {v}' for k,v in d.items() if k not in ['name','device','title'] and v and k != '_created')
            blocks.append(bul(f'{name}' + (f' — {details}' if details else '')))
else:
    blocks.append(bul('(No devices found in database — check NOTION_ESP32_DEVICES_DB_ID)'))

blocks.append(divider())

# Telemetry section
blocks.append(h2('Recent Telemetry'))
if telemetry:
    for t in telemetry[:5]:
        created = t.get('_created','')[:16].replace('T',' ')
        name = next((v for k,v in t.items() if k.lower() in ['name','device','title'] and v), 'entry')
        details = ', '.join(f'{k}: {v}' for k,v in t.items() if k not in ['name','device','title','_created'] and v)
        blocks.append(bul(f'[{created}] {name}' + (f' — {details}' if details else '')))
else:
    blocks.append(bul('(No recent telemetry — check NOTION_ESP32_TELEMETRY_DB_ID)'))

blocks.append(divider())
blocks.append(h2('Recovery Note'))
blocks.append(p('To fully restore this page, use Notion page history:'))
blocks.append(bul('Open this page in Notion'))
blocks.append(bul('Click ••• (more menu) in the top right'))
blocks.append(bul('Click Page history'))
blocks.append(bul('Find the version from before 2026-06-02 15:19 UTC'))
blocks.append(bul('Click Restore'))

print(json.dumps({'children': blocks[:100]}))
" "$DEVICES_INFO" "$TELEMETRY_INFO")

APPEND_RESULT=$(curl -sS -X PATCH "https://api.notion.com/v1/blocks/${TARGET_PAGE_ID}/children" \
  "${HEADERS[@]}" \
  -d "$NEW_BLOCKS")
STATUS=$(echo "$APPEND_RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('object','error'))" 2>/dev/null || echo "error")
note "  Append status: ${STATUS}"

PAGE_URL="https://www.notion.so/ESP32-ESPHome-Watchdog-Pi-Cluster-Monitor-v2-3677d82c410a81e4a6dbe9ae89578fda"
note ""
note "=== DONE ==="
note "Restored (partial): ${PAGE_URL}"
note "ACTION REQUIRED: Open page → ••• → Page history → restore pre-15:19 UTC 2026-06-02 version for full content"
