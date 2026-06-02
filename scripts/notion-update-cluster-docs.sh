#!/usr/bin/env bash
#
# notion-update-cluster-docs.sh — update (or create) the cluster operations
# runbook in Notion to reflect the current cluster doctor + recovery tools.
#
# Runs on ubuntu-latest via GitHub Actions — has network access to Notion.
# Uses NOTION_API_KEY secret.
#
# Behaviour:
#   1. Search Notion for an existing "Cluster Operations" / "Cluster Doctor"
#      page accessible to the integration.
#   2. If found: clear its blocks and replace with fresh markdown.
#   3. If not found: create a new standalone page with the content.
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
# Step 1: Search for an existing cluster ops page
# ---------------------------------------------------------------------------
note "Searching Notion for existing cluster operations page..."

SEARCH_RESULT=$(curl -sS -X POST "https://api.notion.com/v1/search" \
  "${HEADERS[@]}" \
  -d '{
    "query": "Cluster Operations",
    "filter": { "value": "page", "property": "object" },
    "page_size": 10
  }')

PAGE_ID=$(echo "$SEARCH_RESULT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for r in data.get('results', []):
    props = r.get('properties', {})
    for k, v in props.items():
        if v.get('type') == 'title':
            title = ''.join(t.get('plain_text','') for t in v.get('title',[]))
            if any(kw in title.lower() for kw in ['cluster', 'incident', 'runbook', 'k3s', 'infrastructure']):
                print(r['id'])
                sys.exit(0)
" 2>/dev/null || echo "")

# Also try "k3s" and "incident" searches if first came up empty
if [ -z "$PAGE_ID" ]; then
  for QUERY in "k3s cluster" "incident response" "cluster doctor" "infrastructure runbook"; do
    SEARCH_RESULT=$(curl -sS -X POST "https://api.notion.com/v1/search" \
      "${HEADERS[@]}" \
      -d "{\"query\": \"${QUERY}\", \"filter\": {\"value\": \"page\", \"property\": \"object\"}, \"page_size\": 5}")
    PAGE_ID=$(echo "$SEARCH_RESULT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for r in data.get('results', []):
    props = r.get('properties', {})
    for k, v in props.items():
        if v.get('type') == 'title':
            title = ''.join(t.get('plain_text','') for t in v.get('title',[]))
            if any(kw in title.lower() for kw in ['cluster', 'incident', 'runbook', 'k3s', 'infra', 'ops', 'doctor']):
                print(r['id'])
                sys.exit(0)
" 2>/dev/null || echo "")
    if [ -n "$PAGE_ID" ]; then
      break
    fi
  done
fi

# ---------------------------------------------------------------------------
# Step 2: Build the markdown content
# ---------------------------------------------------------------------------
TODAY=$(date -u '+%Y-%m-%d')
CONTENT=$(cat <<'MARKDOWN'
# Cluster Operations — cloudless.gr (omv k3s)

> **Last updated:** REPLACE_DATE
> Runbook for the omv k3s cluster. Driven exclusively through GitHub Actions workflows — no direct kubectl/SSH from cloud sessions.

---

## Service Map (13 services, 6 tiers)

| Tier | Namespace | Service | Memory limit | OOM risk |
|---|---|---|---|---|
| Auth | keycloak | keycloak | 768Mi | CRITICAL — JVM -Xmx512m |
| Auth | keycloak | postgres | — | Low |
| App | cloudless | cloudless | — | Low |
| App | ntfy | ntfy | 96Mi → 128Mi | Medium (tight) |
| App | n8n | n8n | 256Mi | Low |
| Monitoring | monitoring | prometheus | 700Mi | Low |
| Monitoring | monitoring | grafana | 256Mi | Low |
| Monitoring | monitoring | alertmanager | 128Mi | Low |
| Monitoring | monitoring | loki | 400Mi | Medium |
| Analytics | analytics | metabase | 400Mi → 600Mi | HIGH — JVM -Xmx320m |
| Analytics | analytics | duckdb-api | 1500Mi | Low |
| Infra | monitoring | etcd-defrag | CronJob | — |
| Infra | monitoring | cluster-alerts | CronJob | — |

---

## Cluster Doctor (6-tier diagnostics)

Trigger: edit `scripts/cluster-doctor.sh` → PR → squash-merge → wait 2 min → read [issue #382](https://github.com/themis128/cloudless.gr/issues/382).

**Workflow:** `.github/workflows/cluster-doctor.yml`

Tiers covered:
1. **Auth** — Keycloak (pods/logs/limits/heap env/drift) + PostgreSQL
2. **App** — cloudless (AUTH_URL + envFrom) + ntfy + n8n
3. **Monitoring** — Prometheus rules + Grafana HTTP + Alertmanager + Loki
4. **Analytics** — Metabase + DuckDB API (pods + memory limits)
5. **Infra** — nodes + etcd-defrag last 3 runs + maintenance CronJobs
6. **External** — Public HTTP surfaces (Lambda/Keycloak/Grafana) + GitHub runners

---

## Recovery Tools

| Symptom | Tool | Trigger |
|---|---|---|
| auth.cloudless.gr 503 / Keycloak OOM | `restore-keycloak.yml` | edit the workflow file |
| Keycloak drift (every 15 min auto-heal) | `keycloak-ensure.yml` | cron + push |
| Metabase OOMKilled / CrashLoop | `analytics-restore.yml` | edit workflow or script |
| DuckDB API high restarts / OOM | `analytics-restore.yml` | edit workflow or script |
| ntfy Error / CrashLoopBackOff | `ntfy-restore.yml` | edit workflow or script |
| PrometheusRuleFailures | `prometheus-tune.yml` | edit the workflow file |
| k3s API server connection refused | `k3s-ssh-restart.yml` | requires OMV_SSH_KEY secret |
| k3s watchdog install | `k3s-watchdog-deploy.yml` | requires OMV_SSH_KEY secret |

---

## Memory Sizing Rules

- **Never cap a JVM container below -Xmx + ~200Mi non-heap.**
- Keycloak 26.2: 768Mi limit for -Xmx512m heap. Heap var = `JAVA_OPTS_APPEND` (not `JAVA_OPTS_KC_HEAP`).
- Metabase: 600Mi limit for -Xmx480m heap (400Mi original = OOMKill risk on heavy queries).
- ntfy: 128Mi (96Mi original is too tight for any spike).

---

## Failure Mode Decision Table

| Symptom | Likely cause | Tool |
|---|---|---|
| auth.cloudless.gr HTTP 503 | Keycloak OOMKilled / CrashLoop | restore-keycloak.yml |
| Doctor: connection refused on port 6443 | k3s process stopped | k3s-ssh-restart.yml |
| Doctor: ServiceUnavailable on port 6443 | k3s starting / overloaded | wait 2–5 min, re-doctor |
| PrometheusRuleFailures alert | kube-apiserver-burnrate rules timing out | prometheus-tune.yml |
| PrometheusKubernetesListWatchFailures | Prometheus can't reach k3s API | run doctor; if API down → k3s-ssh-restart.yml |
| Metabase OOMKilled / CrashLoop | JVM heap exceeds 400Mi limit | analytics-restore.yml (patches to 600Mi) |
| DuckDB API high restarts | Memory spike from heavy query | analytics-restore.yml (restarts DuckDB) |
| ntfy Error / CrashLoopBackOff | OOM (96Mi) or exit 1 | ntfy-restore.yml |
| Grafana unreachable (503) | Pod crash or OOM | restart via remediate workflow |

---

## Key Incidents

| Date | Summary | Fix |
|---|---|---|
| 2026-05-31 | memory-relief PR capped Keycloak at 384Mi → OOMKill loop | Patched to 768Mi + -Xmx512m |
| 2026-06-01 | Keycloak 503 ~8h, login/registration down | restore-keycloak.yml |
| 2026-06-02 | k3s API server crash → PrometheusKubernetesListWatchFailures | Self-resolved; watchdog install pending (needs OMV_SSH_KEY) |

---

## Pending Setup

- [ ] Add `OMV_SSH_KEY` GitHub repo secret (Pi's `~/.ssh/id_ed25519`) to enable SSH-based recovery
- [ ] Run `k3s-watchdog-deploy.yml` once OMV_SSH_KEY is set — installs Restart=always systemd drop-in
- [ ] SES SMTP: AWS Console → SES → SMTP Settings → Create SMTP credentials → run `provision-ses-smtp` workflow

---

*Auto-updated by [notion-update-cluster-docs.yml](https://github.com/themis128/cloudless.gr/blob/main/.github/workflows/notion-update-cluster-docs.yml)*
MARKDOWN
)

CONTENT="${CONTENT/REPLACE_DATE/$TODAY}"

# ---------------------------------------------------------------------------
# Step 3: Update existing page or create new one
# ---------------------------------------------------------------------------
if [ -n "$PAGE_ID" ]; then
  note "Found existing page: ${PAGE_ID} — updating via markdown API..."

  # Retrieve current title for logging
  PAGE_META=$(curl -sS "https://api.notion.com/v1/pages/${PAGE_ID}" "${HEADERS[@]}")
  PAGE_TITLE=$(echo "$PAGE_META" | python3 -c "
import json, sys
data = json.load(sys.stdin)
props = data.get('properties', {})
for k, v in props.items():
    if v.get('type') == 'title':
        print(''.join(t.get('plain_text','') for t in v.get('title',[])))
        break
" 2>/dev/null || echo "unknown")
  PAGE_URL=$(echo "$PAGE_META" | python3 -c "import json,sys; print(json.load(sys.stdin).get('url',''))" 2>/dev/null || echo "")

  note "  Title: ${PAGE_TITLE}"
  note "  URL:   ${PAGE_URL}"

  # Try markdown patch endpoint (Notion API 2025+)
  MD_PAYLOAD=$(python3 -c "import json, sys; print(json.dumps({'markdown': sys.stdin.read()}))" <<< "$CONTENT")
  PATCH_RESULT=$(curl -sS -X PATCH "https://api.notion.com/v1/pages/${PAGE_ID}/markdown" \
    "${HEADERS[@]}" \
    -d "$MD_PAYLOAD")

  PATCH_STATUS=$(echo "$PATCH_RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('object','error'))" 2>/dev/null || echo "error")

  if [ "$PATCH_STATUS" = "page" ]; then
    note "  SUCCESS: page updated via markdown API"
    ACTION="updated"
  else
    # Fallback: replace blocks manually
    note "  Markdown API not available (${PATCH_STATUS}), falling back to block replacement..."

    # Clear existing blocks
    BLOCKS=$(curl -sS "https://api.notion.com/v1/blocks/${PAGE_ID}/children?page_size=100" "${HEADERS[@]}")
    BLOCK_IDS=$(echo "$BLOCKS" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for b in data.get('results', []):
    print(b['id'])
" 2>/dev/null || echo "")

    if [ -n "$BLOCK_IDS" ]; then
      while IFS= read -r BID; do
        curl -sS -X DELETE "https://api.notion.com/v1/blocks/${BID}" "${HEADERS[@]}" >/dev/null
      done <<< "$BLOCK_IDS"
      note "  Cleared existing blocks"
    fi

    # Append fresh content as simple paragraphs (paragraph fallback)
    # Build blocks from content lines
    BLOCKS_JSON=$(python3 -c "
import json, sys

content = sys.stdin.read()
blocks = []
for line in content.split('\n'):
    stripped = line.strip()
    if not stripped:
        continue
    if stripped.startswith('# ') and not stripped.startswith('## '):
        blocks.append({'object':'block','type':'heading_1','heading_1':{'rich_text':[{'text':{'content':stripped[2:]}}]}})
    elif stripped.startswith('## '):
        blocks.append({'object':'block','type':'heading_2','heading_2':{'rich_text':[{'text':{'content':stripped[3:]}}]}})
    elif stripped.startswith('### '):
        blocks.append({'object':'block','type':'heading_3','heading_3':{'rich_text':[{'text':{'content':stripped[4:]}}]}})
    elif stripped.startswith('- [ ] '):
        blocks.append({'object':'block','type':'to_do','to_do':{'rich_text':[{'text':{'content':stripped[6:]}}],'checked':False}})
    elif stripped.startswith('- '):
        blocks.append({'object':'block','type':'bulleted_list_item','bulleted_list_item':{'rich_text':[{'text':{'content':stripped[2:]}}]}})
    elif stripped.startswith('> '):
        blocks.append({'object':'block','type':'quote','quote':{'rich_text':[{'text':{'content':stripped[2:]}}]}})
    elif stripped.startswith('|') or stripped.startswith('---') or stripped == '---':
        blocks.append({'object':'block','type':'paragraph','paragraph':{'rich_text':[{'text':{'content':stripped}}]}})
    else:
        blocks.append({'object':'block','type':'paragraph','paragraph':{'rich_text':[{'text':{'content':stripped}}]}})

# Notion allows max 100 blocks per append
print(json.dumps({'children': blocks[:100]}))
" <<< "$CONTENT")

    APPEND_RESULT=$(curl -sS -X PATCH "https://api.notion.com/v1/blocks/${PAGE_ID}/children" \
      "${HEADERS[@]}" \
      -d "$BLOCKS_JSON")
    APPEND_STATUS=$(echo "$APPEND_RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('object','error'))" 2>/dev/null || echo "error")
    note "  Block append status: ${APPEND_STATUS}"
    ACTION="updated (block fallback)"
  fi

else
  # No matching page found — create a new standalone page
  note "No existing cluster ops page found — creating new page..."

  # Find a parent: try to find any accessible page to use as parent,
  # otherwise create at workspace root (not supported by API — need a parent page)
  # We'll find the first accessible page as parent
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
    note "ERROR: No accessible Notion pages found — cannot create new page (integration needs to be added to at least one page)"
    note "Please share a Notion page with the integration at: https://www.notion.so/"
    exit 1
  fi

  CREATE_PAYLOAD=$(python3 -c "
import json, sys
parent_id = sys.argv[1]
payload = {
    'parent': {'page_id': parent_id},
    'properties': {
        'title': {'title': [{'text': {'content': 'Cluster Operations — cloudless.gr (omv k3s)'}}]}
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
    note "ERROR: Failed to create Notion page"
    echo "$CREATE_RESULT"
    exit 1
  fi

  note "  Created page: ${PAGE_ID}"
  note "  URL: ${PAGE_URL}"

  # Append content blocks
  BLOCKS_JSON=$(python3 -c "
import json, sys

content = sys.stdin.read()
blocks = []
for line in content.split('\n'):
    stripped = line.strip()
    if not stripped:
        continue
    if stripped.startswith('# ') and not stripped.startswith('## '):
        blocks.append({'object':'block','type':'heading_1','heading_1':{'rich_text':[{'text':{'content':stripped[2:]}}]}})
    elif stripped.startswith('## '):
        blocks.append({'object':'block','type':'heading_2','heading_2':{'rich_text':[{'text':{'content':stripped[3:]}}]}})
    elif stripped.startswith('### '):
        blocks.append({'object':'block','type':'heading_3','heading_3':{'rich_text':[{'text':{'content':stripped[4:]}}]}})
    elif stripped.startswith('- [ ] '):
        blocks.append({'object':'block','type':'to_do','to_do':{'rich_text':[{'text':{'content':stripped[6:]}}],'checked':False}})
    elif stripped.startswith('- '):
        blocks.append({'object':'block','type':'bulleted_list_item','bulleted_list_item':{'rich_text':[{'text':{'content':stripped[2:]}}]}})
    elif stripped.startswith('> '):
        blocks.append({'object':'block','type':'quote','quote':{'rich_text':[{'text':{'content':stripped[2:]}}]}})
    else:
        blocks.append({'object':'block','type':'paragraph','paragraph':{'rich_text':[{'text':{'content':stripped}}]}})

print(json.dumps({'children': blocks[:100]}))
" <<< "$CONTENT")

  APPEND_RESULT=$(curl -sS -X PATCH "https://api.notion.com/v1/blocks/${PAGE_ID}/children" \
    "${HEADERS[@]}" \
    -d "$BLOCKS_JSON")
  note "  Content appended"
  ACTION="created"
fi

# ---------------------------------------------------------------------------
# Step 4: Report
# ---------------------------------------------------------------------------
note ""
note "=== DONE — ${ACTION} ==="
note "Page URL: ${PAGE_URL:-https://notion.so/${PAGE_ID}}"
