#!/usr/bin/env bash
# Watch the latest deploy-pi.yml run + once rolled-out, hit /api/newsletter-slack/events
# with a signed app_home_opened payload to confirm the verifier reads the SSM secret.
set -u
cd ~/code/cloudless.gr 2>/dev/null || cd /sessions/fervent-epic-darwin/mnt/cloudless.gr

RUN_ID=$(gh run list --repo Themis128/cloudless.gr --workflow=deploy-pi.yml --limit 1 --json databaseId --jq '.[0].databaseId')
echo "Watching run $RUN_ID"
gh run view "$RUN_ID" --repo Themis128/cloudless.gr --json jobs --jq '.jobs[] | {name, status, conclusion}'

echo
echo "=== Probing endpoint with signed app_home_opened payload ==="
SIGNING_SECRET="b54278ce32368436866e8bdba42794e2"
TS=$(date +%s)
BODY="{\"type\":\"event_callback\",\"team_id\":\"T09AF5VTK4G\",\"api_app_id\":\"A0BAQUDSXBN\",\"event\":{\"type\":\"app_home_opened\",\"user\":\"U09AF5VU7LY\",\"channel\":\"D00PROBE\",\"event_ts\":\"${TS}.000000\",\"tab\":\"home\"},\"event_id\":\"Ev${TS}\",\"event_time\":${TS}}"
BASE="v0:${TS}:${BODY}"
SIG="v0=$(printf '%s' "$BASE" | openssl dgst -sha256 -hmac "$SIGNING_SECRET" | awk '{print $2}')"
curl -sS -o /tmp/evt.txt -w 'HTTP %{http_code}\n' \
  -X POST https://cloudless.gr/api/newsletter-slack/events \
  -H 'Content-Type: application/json' \
  -H "x-slack-request-timestamp: $TS" \
  -H "x-slack-signature: $SIG" \
  --data "$BODY"
head -c 300 /tmp/evt.txt
echo
