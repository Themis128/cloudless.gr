#!/usr/bin/env bash
# probe-lead-enrich.sh — dry-run the EspoCRM Lead → n8n → Apollo enrich loop.
#
# What it does:
#   1. Reads NOTION_WEBHOOK_SECRET from SSM (the internal-webhook secret
#      reused by the n8n trigger receiver).
#   2. POSTs a synthetic Lead payload to /api/webhooks/n8n/trigger with the
#      lead-enrich alias.
#   3. Surfaces the response code + body so the operator can see the loop
#      either fired (200), no-op'd (204 = workflow ID not set in SSM yet),
#      or failed (4xx/5xx).
#   4. Optionally tails the n8n executions API for the most recent run if
#      N8N_API_KEY is set.
#
# Usage:
#   bash scripts/probe-lead-enrich.sh              # local — hits production
#   BASE_URL=https://staging.cloudless.gr bash scripts/probe-lead-enrich.sh
#
# R6 of the 2026-06-21 R-series.
set -uo pipefail

BASE_URL="${BASE_URL:-https://cloudless.gr}"
SECRET=$(aws ssm get-parameter --name /cloudless/production/NOTION_WEBHOOK_SECRET \
  --with-decryption --query Parameter.Value --output text 2>/dev/null)

if [[ -z "$SECRET" ]]; then
  echo "ERROR: NOTION_WEBHOOK_SECRET not in SSM — cannot authenticate the probe."
  exit 1
fi

PAYLOAD=$(cat <<JSON
{
  "name": "lead-enrich",
  "payload": {
    "entity": "Lead",
    "action": "create",
    "record": {
      "id": "probe-lead-$(date +%s)",
      "firstName": "Probe",
      "lastName": "Lead",
      "emailAddress": "probe+leadenrich@cloudless.gr",
      "accountName": "Probe Co"
    }
  }
}
JSON
)

echo "=== POST $BASE_URL/api/webhooks/n8n/trigger ==="
RESP=$(curl -sk -o /tmp/probe-lead-enrich.json -w '%{http_code}' \
  -X POST -H 'Content-Type: application/json' \
  -H "x-n8n-trigger-secret: $SECRET" \
  -d "$PAYLOAD" \
  "$BASE_URL/api/webhooks/n8n/trigger")

echo "HTTP $RESP"
case "$RESP" in
  200)  echo "✅ workflow fired — $(head -c 200 /tmp/probe-lead-enrich.json)" ;;
  204)  echo "ℹ️  workflow ID not in SSM yet — graceful no-op; see infrastructure/n8n/workflows/README.md" ;;
  401)  echo "❌ secret rejected (NOTION_WEBHOOK_SECRET mismatch between SSM + receiver)" ;;
  503)  echo "❌ n8n not configured (N8N_API_URL or N8N_API_KEY missing in SSM)" ;;
  502)  echo "❌ n8n upstream failed — $(head -c 200 /tmp/probe-lead-enrich.json)" ;;
  *)    echo "❌ unexpected: $(head -c 200 /tmp/probe-lead-enrich.json)" ;;
esac

# Optional — tail the n8n execution list for the most recent record.
N8N_KEY=$(aws ssm get-parameter --name /cloudless/production/N8N_API_KEY \
  --with-decryption --query Parameter.Value --output text 2>/dev/null || echo "")
N8N_URL=$(aws ssm get-parameter --name /cloudless/production/N8N_API_URL \
  --query Parameter.Value --output text 2>/dev/null || echo "")

if [[ -n "$N8N_KEY" && -n "$N8N_URL" ]]; then
  echo
  echo "=== Most recent n8n execution ==="
  curl -sk -H "X-N8N-API-KEY: $N8N_KEY" \
    "${N8N_URL%/}/api/v1/executions?limit=1&includeData=false" \
    | python3 -c "import sys,json
d = json.load(sys.stdin).get('data', [])
if not d:
    print('  no executions yet')
else:
    e = d[0]
    print(f\"  id={e.get('id')} workflow={e.get('workflowId')} status={e.get('status')} started={e.get('startedAt')}\")"
fi

rm -f /tmp/probe-lead-enrich.json
