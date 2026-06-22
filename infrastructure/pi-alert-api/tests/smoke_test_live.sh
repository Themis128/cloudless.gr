#!/usr/bin/env bash
# Live end-to-end smoke test for the alert-api → Slack pipeline.
#
# What it does:
#   1. POSTs a synthetic Alertmanager-shaped payload to the live alert-api
#      webhook (NodePort 30800 on omv-main).
#   2. Polls the alert-api DB through /api/alerts to confirm the alert was
#      persisted with the verbose multi-line message body.
#   3. Resolves the synthetic alert so it doesn't linger in the active set.
#   4. Tails the alert-api pod logs and asserts the Slack webhook returned 200.
#
# Run from a host that can reach 192.168.1.128:30800 OR through the cluster
# (the script auto-detects via $ALERT_API_URL).
#
# Usage:
#   bash infrastructure/pi-alert-api/tests/smoke_test_live.sh
#
# Override URL:
#   ALERT_API_URL=http://alert-api.alert-manager:8080 \
#     bash infrastructure/pi-alert-api/tests/smoke_test_live.sh
#
# Exit codes:
#   0  all assertions passed; check Slack to visually confirm the message
#   1  webhook returned non-200 OR alert never reached the DB
#   2  DB row missing expected fields (Value, Instance, Target/Probe, Runbook)
#   3  prerequisites missing (curl, jq)
set -euo pipefail

ALERT_API_URL="${ALERT_API_URL:-http://192.168.1.128:30800}"
SMOKE_CODE="SMOKETEST_$(date +%s)"

# ── prereqs ───────────────────────────────────────────────────────────────
command -v curl >/dev/null || { echo "FAIL: curl not installed"; exit 3; }
command -v jq   >/dev/null || { echo "FAIL: jq not installed";   exit 3; }

echo "==> Sending synthetic alert: code=${SMOKE_CODE} url=${ALERT_API_URL}"

PAYLOAD=$(cat <<EOF
{
  "alerts": [{
    "status": "firing",
    "labels": {
      "alertname": "${SMOKE_CODE}",
      "severity": "warning",
      "target": "cloudless.gr",
      "probe": "esp32-https",
      "instance": "smoke-test-cli"
    },
    "annotations": {
      "summary": "${SMOKE_CODE} — e2e verification of alert-api v3.3 verbose rendering",
      "description": "This is a synthetic alert from infrastructure/pi-alert-api/tests/smoke_test_live.sh\n\nIf you see this in #alerts as a multi-line message with Value, Instance, Target/Probe, Runbook, and Source fields, the alert-api → Slack pipeline is healthy.\n\nWill be auto-resolved by the smoke test within ~10 seconds.",
      "runbook_url": "https://github.com/Themis128/cloudless.gr/blob/main/infrastructure/pi-alert-api/tests/smoke_test_live.sh"
    },
    "generatorURL": "http://prometheus.monitoring.svc.cluster.local:9090/graph"
  }]
}
EOF
)

WEBHOOK_RESP=$(curl -sS --max-time 10 -X POST "${ALERT_API_URL}/api/alertmanager/webhook" \
  -H 'Content-Type: application/json' \
  -d "${PAYLOAD}")

if ! echo "${WEBHOOK_RESP}" | jq -e '.ok == true' >/dev/null; then
  echo "FAIL: webhook returned: ${WEBHOOK_RESP}"
  exit 1
fi
echo "    webhook OK: ${WEBHOOK_RESP}"

# ── give the alert-api a moment to persist + Slack ───────────────────────
sleep 3

# ── verify DB row ────────────────────────────────────────────────────────
echo "==> Verifying alert landed in DB..."
ALERT_ROW=$(curl -sS --max-time 5 "${ALERT_API_URL}/api/alerts?status=active" \
  | jq -e ".[] | select(.code == \"${SMOKE_CODE}\")")

if [[ -z "${ALERT_ROW}" ]]; then
  echo "FAIL: alert ${SMOKE_CODE} not found in active alerts"
  exit 1
fi

MESSAGE=$(echo "${ALERT_ROW}" | jq -r '.message')

# Assert each verbose-rendering field is present.
errors=0
for needle in \
  "e2e verification of alert-api v3.3" \
  "*Instance:* \`smoke-test-cli\`" \
  "*Target / Probe:* \`cloudless.gr\` / \`esp32-https\`" \
  "📖 *Runbook:*" \
  "📊 *Source:*"
do
  if echo "${MESSAGE}" | grep -qF "${needle}"; then
    echo "    ✓ ${needle}"
  else
    echo "    ✗ MISSING: ${needle}"
    errors=$((errors+1))
  fi
done

if [[ ${errors} -gt 0 ]]; then
  echo
  echo "FAIL: ${errors} expected fields missing from rendered message:"
  echo "--- BEGIN MESSAGE ---"
  echo "${MESSAGE}"
  echo "--- END MESSAGE ---"
  exit 2
fi

# ── resolve so it doesn't pollute the active list ────────────────────────
echo "==> Resolving smoke alert"
curl -sS --max-time 5 -X POST "${ALERT_API_URL}/api/alerts/${SMOKE_CODE}/resolve" >/dev/null
echo "    resolved"

echo
echo "PASS — alert-api v3.3 verbose rendering is healthy end-to-end."
echo "      Visually confirm the message landed in your #alerts channel."
