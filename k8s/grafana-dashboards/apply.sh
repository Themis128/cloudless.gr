#!/usr/bin/env bash
# Replace Grafana dashboards with the slim cluster-health set.
#
# 1. Inventory all current dashboards
# 2. Delete only those whose panels reference metrics that disappeared
#    after `prometheus-slim.yaml` was applied (i.e. non-cluster-health
#    metrics that no longer scrape)
# 3. Import the 3 new dashboards in this directory
#
# Requires:
#   GRAFANA_URL (default http://grafana.cloudless.gr)
#   GRAFANA_API_TOKEN (from SSM: /cloudless/production/GRAFANA_API_TOKEN)
#
# Idempotent — re-running this updates dashboards in place via uid.

set -euo pipefail

cd "$(dirname "$0")"

GRAFANA_URL="${GRAFANA_URL:-http://grafana.cloudless.gr}"

if [ -z "${GRAFANA_API_TOKEN:-}" ]; then
  GRAFANA_API_TOKEN=$(aws ssm get-parameter \
    --name /cloudless/production/GRAFANA_API_TOKEN \
    --with-decryption --query 'Parameter.Value' --output text 2>/dev/null || echo "")
fi

if [ -z "$GRAFANA_API_TOKEN" ]; then
  echo "❌ GRAFANA_API_TOKEN not set and not in SSM."
  echo "   Create one at $GRAFANA_URL/org/apikeys (role: Editor or Admin)"
  echo "   then export GRAFANA_API_TOKEN=<token> or push to SSM."
  exit 1
fi

AUTH="Authorization: Bearer $GRAFANA_API_TOKEN"

# Datasource lookup
DS_UID=$(curl -fsS -H "$AUTH" "$GRAFANA_URL/api/datasources/name/Prometheus" | jq -r '.uid')
if [ -z "$DS_UID" ] || [ "$DS_UID" = "null" ]; then
  echo "❌ Could not find Prometheus datasource. Check /api/datasources"
  exit 1
fi
echo "✓ Prometheus datasource uid: $DS_UID"

# ─── Step 1: Inventory current dashboards ────────────────────────────────────
echo ""
echo "── Step 1/3: Inventory dashboards ──"
curl -fsS -H "$AUTH" "$GRAFANA_URL/api/search?type=dash-db" \
  | jq -r '.[] | "\(.uid)\t\(.title)"' \
  > /tmp/grafana-dashboards-before.tsv
echo "  $(wc -l < /tmp/grafana-dashboards-before.tsv) dashboards currently in Grafana"

# ─── Step 2: Delete orphaned dashboards ──────────────────────────────────────
echo ""
echo "── Step 2/3: Delete dashboards that reference dropped metrics ──"
# Metrics that survive Prometheus slim: node_*, kube_*, kubelet_*, apiserver_*,
# coredns_*, prometheus_*, up, scrape_*. Everything else is orphaned.
ORPHAN_PATTERNS='loki_|grafana_|n8n_|traefik_|duckdb_|metabase_|cloudless_app_|oncall_|home_assistant_|mosquitto_|alert_api_'

while IFS=$'\t' read -r uid title; do
  # Skip our own new dashboards (we'll create them in step 3)
  if [[ "$uid" =~ ^(cluster-overview-2026|pod-health-2026|per-node-detail-2026)$ ]]; then
    continue
  fi
  # Fetch dashboard JSON, check if any panel target uses an orphan metric
  body=$(curl -fsS -H "$AUTH" "$GRAFANA_URL/api/dashboards/uid/$uid" 2>/dev/null || echo "")
  if [ -z "$body" ]; then continue; fi
  if echo "$body" | grep -qE "\"expr\":\s*\"[^\"]*($ORPHAN_PATTERNS)" ; then
    echo "  ✗ deleting: $title ($uid)"
    curl -fsS -X DELETE -H "$AUTH" "$GRAFANA_URL/api/dashboards/uid/$uid" >/dev/null
  fi
done < /tmp/grafana-dashboards-before.tsv

# ─── Step 3: Import new dashboards ───────────────────────────────────────────
echo ""
echo "── Step 3/3: Import the 3 new cluster-health dashboards ──"
for file in cluster-overview.json pod-health.json per-node-detail.json; do
  # Replace any datasource ref with the real Prometheus uid
  payload=$(jq --arg uid "$DS_UID" \
    'walk(if type == "object" and .datasource? then .datasource = {type:"prometheus", uid:$uid} else . end)
     | { dashboard: ., overwrite: true, folderUid: "" }' \
    "$file")
  curl -fsS -X POST -H "$AUTH" -H "Content-Type: application/json" \
    -d "$payload" "$GRAFANA_URL/api/dashboards/db" \
    | jq -r '"  ✓ \(.status): \(.url)"'
done

echo ""
echo "✓ Done. Final state:"
curl -fsS -H "$AUTH" "$GRAFANA_URL/api/search?type=dash-db" \
  | jq -r '.[] | "  - \(.title) (\(.uid))"'
