#!/usr/bin/env bash
#
# notion-update-cluster-docs.sh — update (or create) the cluster operations
# runbook in Notion to reflect the current cluster doctor + recovery tools.
#
# Runs on ubuntu-latest via GitHub Actions — has network access to Notion.
# Uses NOTION_API_KEY secret.
#
# Behaviour:
#   1. Search Notion for a page whose title is specifically about cluster
#      operations/runbooks. Excludes pages that merely contain the word
#      "cluster" in an unrelated context (e.g. ESP32 watchdog hardware pages).
#   2. If found: replace its blocks with the current runbook content.
#   3. If not found: create a new page titled "Cluster Operations Runbook".
#   4. Post the result (page URL) to GitHub issue #382.

set -uo pipefail

NOTION_VERSION="2022-06-28"
HEADERS=(
  -H "Authorization: Bearer ${NOTION_API_KEY}"
  -H "Notion-Version: ${NOTION_VERSION}"
  -H "Content-Type: application/json"
)

note() { printf "[notion-update] %s\n" "$*"; }

note "=== notion-update-cluster-docs $(date -u '+%F %T')Z ==="

# ---------------------------------------------------------------------------
# Step 1: Find the canonical cluster ops runbook page.
#
# Priority order:
#   a) CLUSTER_OPS_PAGE_ID env var (set as a GitHub repo variable) — direct lookup,
#      avoids search entirely and prevents duplicate page creation
#   b) Known page IDs from previous successful runs (direct GET, no search needed)
#   c) Title search (last resort, only if direct lookups fail)
# ---------------------------------------------------------------------------
note "Locating cluster operations runbook page..."

PAGE_ID=""
PAGE_URL=""
PAGE_TITLE=""

# Known page IDs from previous successful runs (most recent first)
KNOWN_IDS=(
  "${CLUSTER_OPS_PAGE_ID:-}"                   # repo variable — canonical (always update this first)
  "3737d82c-410a-81a2-9b53-c54644d94dce"       # created 2026-06-02 run 3 — current canonical
  "3737d82c-410a-8130-b90d-c55017e86059"       # created 2026-06-02 run 2 — archived
  "3737d82c-410a-81e5-bb2c-fcd31e49d57c"       # created 2026-06-02 run 1 — archived
)

for KID in "${KNOWN_IDS[@]}"; do
  [ -z "$KID" ] && continue
  RESP=$(curl -sS "https://api.notion.com/v1/pages/${KID}" "${HEADERS[@]}")
  OBJ=$(echo "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('object',''))" 2>/dev/null || echo "")
  if [ "$OBJ" = "page" ]; then
    ARCHIVED=$(echo "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('archived',True))" 2>/dev/null || echo "True")
    if [ "$ARCHIVED" = "False" ]; then
      PAGE_ID="$KID"
      PAGE_URL=$(echo "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('url',''))" 2>/dev/null || echo "")
      PAGE_TITLE=$(echo "$RESP" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for v in d.get('properties',{}).values():
    if v.get('type')=='title':
        print(''.join(t.get('plain_text','') for t in v.get('title',[])))
        break
" 2>/dev/null || echo "known page")
      note "  Found via direct lookup: ${PAGE_ID} (${PAGE_TITLE})"
      break
    fi
  fi
done

# Fallback: title search (only if none of the known IDs worked)
if [ -z "$PAGE_ID" ]; then
  note "  No known page found — searching by title..."
  for QUERY in "Cluster Operations Runbook" "Cluster Operations" "k3s Runbook"; do
    SEARCH_RESULT=$(curl -sS -X POST "https://api.notion.com/v1/search" \
      "${HEADERS[@]}" \
      -d "{\"query\": \"${QUERY}\", \"filter\": {\"value\": \"page\", \"property\": \"object\"}, \"page_size\": 10}")

    MATCH=$(echo "$SEARCH_RESULT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
exclude = ['esp32', 'esphome', 'sensor', 'temperature', 'humidity', 'device', 'firmware', 'iot']
required = ['cluster operation', 'k3s runbook', 'cluster incident', 'cluster doctor runbook', 'cluster ops runbook']
for r in data.get('results', []):
    if r.get('archived'): continue
    props = r.get('properties', {})
    for k, v in props.items():
        if v.get('type') == 'title':
            title = ''.join(t.get('plain_text','') for t in v.get('title',[])).lower()
            if any(ex in title for ex in exclude): continue
            if any(req in title for req in required):
                print(r['id'] + '|' + r.get('url','') + '|' + title)
                sys.exit(0)
" 2>/dev/null || echo "")

    if [ -n "$MATCH" ]; then
      PAGE_ID=$(echo "$MATCH" | cut -d'|' -f1)
      PAGE_URL=$(echo "$MATCH" | cut -d'|' -f2)
      PAGE_TITLE=$(echo "$MATCH" | cut -d'|' -f3)
      note "  Found via search: ${PAGE_ID}"
      break
    fi
  done
fi

# ---------------------------------------------------------------------------
# Step 2: Build the runbook content as Notion blocks
# ---------------------------------------------------------------------------
TODAY=$(date -u '+%Y-%m-%d')

build_blocks() {
# Write blocks JSON to a temp file to avoid shell variable expansion issues
# with special characters (em-dashes, arrows, etc.)
local outfile="${1:-/tmp/notion-blocks.json}"
python3 - "$TODAY" "$outfile" <<'PYEOF'
import json, sys

today = sys.argv[1]
outfile = sys.argv[2]

def p(text):
    return {'object':'block','type':'paragraph','paragraph':{'rich_text':[{'text':{'content':text}}]}}
def h1(text):
    return {'object':'block','type':'heading_1','heading_1':{'rich_text':[{'text':{'content':text}}]}}
def h2(text):
    return {'object':'block','type':'heading_2','heading_2':{'rich_text':[{'text':{'content':text}}]}}
def h3(text):
    return {'object':'block','type':'heading_3','heading_3':{'rich_text':[{'text':{'content':text}}]}}
def bul(text):
    return {'object':'block','type':'bulleted_list_item','bulleted_list_item':{'rich_text':[{'text':{'content':text}}]}}
def todo(text, checked=False):
    return {'object':'block','type':'to_do','to_do':{'rich_text':[{'text':{'content':text}}],'checked':checked}}
def divider():
    return {'object':'block','type':'divider','divider':{}}
def code(text, lang='bash'):
    return {'object':'block','type':'code','code':{'rich_text':[{'text':{'content':text}}],'language':lang}}

blocks = [
    h1('Cluster Operations — cloudless.gr (omv k3s)'),
    p(f'Last updated: {today}  |  Pi: omv / 192.168.1.128 / Tailscale 100.113.41.119'),
    p('Runbook for the omv k3s cluster. Driven entirely through GitHub Actions — no direct kubectl/SSH from cloud sessions.'),
    divider(),
    h2('Service Map (13 services, 6 tiers)'),
    p('Tier 1 — Auth'),
    p('Tier 2 — App'),
    bul('cloudless/cloudless — standby (Low)'),
    bul('ntfy/ntfy — 96Mi → 128Mi — Medium (tight)'),
    bul('n8n/n8n — 256Mi — Low'),
    p('Tier 3 — Monitoring'),
    bul('monitoring/prometheus — 700Mi — Low'),
    bul('monitoring/grafana — 256Mi — Low'),
    bul('monitoring/alertmanager — 128Mi — Low'),
    bul('monitoring/loki — 400Mi — Medium'),
    p('Tier 4 — Analytics'),
    bul('analytics/metabase — 400Mi → 600Mi — HIGH (JVM -Xmx320m)'),
    bul('analytics/duckdb-api — 1500Mi — Low'),
    p('Tier 5 — Infra CronJobs'),
    bul('monitoring/etcd-defrag — weekly'),
    bul('monitoring/cluster-alerts — nightly'),
    divider(),
    h2('Cluster Doctor (6-tier diagnostics)'),
    p('Trigger: edit scripts/cluster-doctor.sh → PR → squash-merge → wait 2 min → read GitHub issue #382'),
    bul('Tier 1: Auth — Cognito (managed AWS, no in-cluster pods)'),
    bul('Tier 2: App — cloudless AUTH_URL/envFrom + ntfy + n8n'),
    bul('Tier 3: Monitoring — Prometheus rules + Grafana HTTP + Alertmanager + Loki'),
    bul('Tier 4: Analytics — Metabase + DuckDB API pods + memory limits'),
    bul('Tier 5: Infra — nodes + etcd-defrag last 3 runs + CronJobs'),
    divider(),
    h2('Recovery Tools'),
    h3('Auth'),
    h3('Analytics'),
    bul('analytics-restore.yml — Metabase OOMKilled (patches to 600Mi + -Xmx480m) or DuckDB API restart'),
    h3('App'),
    bul('ntfy-restore.yml — ntfy Error/CrashLoop (patches to 128Mi if OOMKilled, force-restarts)'),
    h3('Monitoring'),
    bul('prometheus-tune.yml — PrometheusRuleFailures (removes heavy kube-apiserver-burnrate SLO rules)'),
    h3('Infrastructure (requires OMV_SSH_KEY secret)'),
    bul('k3s-ssh-restart.yml — k3s process stopped (connection refused on port 6443)'),
    bul('k3s-watchdog-deploy.yml — install Restart=always systemd drop-in on Pi (one-time)'),
    divider(),
    h2('Failure Mode Decision Table'),
    bul('connection refused on port 6443 → k3s process stopped → k3s-ssh-restart.yml'),
    bul('ServiceUnavailable on port 6443 → k3s starting → wait 2-5 min, re-doctor'),
    bul('PrometheusRuleFailures → kube-apiserver-burnrate timeout → prometheus-tune.yml'),
    bul('PrometheusKubernetesListWatchFailures → Prometheus cannot reach k3s API → run doctor; if API down → k3s-ssh-restart.yml'),
    bul('Metabase OOMKilled/CrashLoop → JVM heap exceeds 400Mi → analytics-restore.yml (→600Mi)'),
    bul('DuckDB API high restarts → memory spike → analytics-restore.yml (restart)'),
    bul('ntfy Error/CrashLoopBackOff → OOM or exit 1 → ntfy-restore.yml'),
    bul('Grafana 503 → pod crash → restart via remediate workflow'),
    divider(),
    h2('Memory Sizing Rules'),
    bul('NEVER cap a JVM container below -Xmx + ~200Mi non-heap'),
    bul('Metabase: 600Mi limit | -Xmx480m (400Mi original = OOMKill risk on heavy queries)'),
    bul('ntfy: 128Mi (96Mi = too tight for any traffic spike)'),
    divider(),
    h2('Key Incidents'),
    bul('2026-06-02: k3s API crash → PrometheusKubernetesListWatchFailures — Self-resolved; watchdog pending'),
    divider(),
    h2('Pending Setup'),
    todo('Add OMV_SSH_KEY GitHub repo secret (Pi ~/.ssh/id_ed25519) to enable SSH recovery workflows'),
    todo('Run k3s-watchdog-deploy.yml once OMV_SSH_KEY is set — installs Restart=always on Pi'),
    todo('SES SMTP: AWS Console → SES → SMTP Settings → Create credentials → run provision-ses-smtp workflow'),
    divider(),
    p(f'Auto-updated {today} by notion-update-cluster-docs.yml'),
]
with open(outfile, 'w') as f:
    json.dump({'children': blocks[:100]}, f)
PYEOF
}

# ---------------------------------------------------------------------------
# Step 3: Update existing page or create a new one
# ---------------------------------------------------------------------------
BLOCKS_FILE="/tmp/notion-blocks-$$.json"
build_blocks "$BLOCKS_FILE"

if [ -n "$PAGE_ID" ]; then
  note "Found existing runbook page: ${PAGE_ID}"
  note "  Title: ${PAGE_TITLE}"
  note "  URL:   ${PAGE_URL}"
  note "  Replacing blocks..."

  # Safety check: confirm the page title before clearing.
  # We already verified title matches during search, but double-check
  # that we're not about to wipe an unrelated page.
  LIVE_TITLE=$(curl -sS "https://api.notion.com/v1/pages/${PAGE_ID}" "${HEADERS[@]}" | \
    python3 -c "
import json,sys
d=json.load(sys.stdin)
for v in d.get('properties',{}).values():
    if v.get('type')=='title':
        print(''.join(t.get('plain_text','') for t in v.get('title',[])).lower())
        break
" 2>/dev/null || echo "")
  REQUIRED_PHRASES=("cluster operation" "k3s runbook" "cluster incident" "cluster doctor runbook" "cluster ops runbook")
  SAFE=0
  for PHRASE in "${REQUIRED_PHRASES[@]}"; do
    if [[ "$LIVE_TITLE" == *"$PHRASE"* ]]; then
      SAFE=1
      break
    fi
  done
  if [ "$SAFE" = "0" ]; then
    note "  SAFETY ABORT: live page title '${LIVE_TITLE}' does not match cluster ops phrases."
    note "  Refusing to overwrite. Check PAGE_ID or update REQUIRED_PHRASES."
    exit 1
  fi

  # Explicitly unarchive the page before editing — Notion blocks edits if the
  # page or a parent is archived, even when GET reports archived:false
  curl -sS -X PATCH "https://api.notion.com/v1/pages/${PAGE_ID}" \
    "${HEADERS[@]}" \
    -d '{"archived": false}' >/dev/null
  note "  Page unarchived (pre-edit)"

  # Delete existing blocks
  EXISTING=$(curl -sS "https://api.notion.com/v1/blocks/${PAGE_ID}/children?page_size=100" "${HEADERS[@]}")
  echo "$EXISTING" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for b in data.get('results', []):
    print(b['id'])
" 2>/dev/null | while IFS= read -r BID; do
    curl -sS -X DELETE "https://api.notion.com/v1/blocks/${BID}" "${HEADERS[@]}" >/dev/null
  done
  note "  Existing blocks cleared"

  APPEND_RESULT=$(curl -sS -X PATCH "https://api.notion.com/v1/blocks/${PAGE_ID}/children" \
    "${HEADERS[@]}" \
    --data "@${BLOCKS_FILE}")
  STATUS=$(echo "$APPEND_RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('object') or d.get('code','error'))" 2>/dev/null || echo "error")
  if [ "$STATUS" = "error" ]; then
    ERRMSG=$(echo "$APPEND_RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('message','unknown'))" 2>/dev/null)
    note "  Append ERROR: ${ERRMSG}"
    exit 1
  fi
  note "  Append status: ${STATUS}"
  ACTION="updated"

else
  note "No existing runbook found — creating new 'Cluster Operations Runbook' page..."

  # Find a parent page to nest under
  ALL_PAGES=$(curl -sS -X POST "https://api.notion.com/v1/search" \
    "${HEADERS[@]}" \
    -d '{"filter":{"value":"page","property":"object"},"page_size":5}')
  PARENT_ID=$(echo "$ALL_PAGES" | python3 -c "
import json, sys
data = json.load(sys.stdin)
results = data.get('results', [])
if results:
    print(results[0]['id'])
" 2>/dev/null || echo "")

  if [ -z "$PARENT_ID" ]; then
    note "ERROR: No accessible Notion pages to use as parent. Share a page with the integration first."
    exit 1
  fi

  CREATE_PAYLOAD=$(python3 -c "
import json, sys
payload = {
    'parent': {'page_id': sys.argv[1]},
    'properties': {
        'title': {'title': [{'text': {'content': 'Cluster Operations Runbook — cloudless.gr (omv k3s)'}}]}
    }
}
print(json.dumps(payload))
" "$PARENT_ID")

  CREATE_RESULT=$(curl -sS -X POST "https://api.notion.com/v1/pages" \
    "${HEADERS[@]}" \
    -d "$CREATE_PAYLOAD")
  PAGE_ID=$(echo "$CREATE_RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")
  PAGE_URL=$(echo "$CREATE_RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('url',''))" 2>/dev/null || echo "")

  if [ -z "$PAGE_ID" ]; then
    note "ERROR: Failed to create page"
    echo "$CREATE_RESULT"
    exit 1
  fi

  note "  Created page: ${PAGE_ID}"

  APPEND_RESULT=$(curl -sS -X PATCH "https://api.notion.com/v1/blocks/${PAGE_ID}/children" \
    "${HEADERS[@]}" \
    --data "@${BLOCKS_FILE}")
  STATUS=$(echo "$APPEND_RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('object') or d.get('code','error'))" 2>/dev/null || echo "error")
  note "  Content appended (status: ${STATUS})"
  ACTION="created"
fi

# ---------------------------------------------------------------------------
# Step 4: Report
# ---------------------------------------------------------------------------
note ""
note "=== DONE — ${ACTION} ==="
note "Page URL: ${PAGE_URL:-https://notion.so/${PAGE_ID}}"
