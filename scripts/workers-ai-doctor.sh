#!/usr/bin/env bash
#
# Workers AI doctor — verifies the full /api/admin/ai/generate chain.
#
# Checks (each skipped gracefully when its credential isn't available):
#   1. Cloudflare token validity + Workers AI scope (needs CLOUDFLARE_API_TOKEN)
#      — runs a real 1-token inference against llama-3-8b-instruct.
#   2. Production Lambda env carries CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN
#      (needs AWS credentials with lambda:GetFunctionConfiguration).
#   3. Live endpoint is deployed and auth-gated: unauthenticated POST
#      https://cloudless.gr/api/admin/ai/generate must return 401.
#
# Usage:
#   CLOUDFLARE_API_TOKEN=... bash scripts/workers-ai-doctor.sh
#   bash scripts/workers-ai-doctor.sh            # env/Lambda/live checks only
#
# Exit code: 0 when every check that COULD run passed; 1 otherwise.

set -uo pipefail

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-fb7dc7b69b662480cd5961a4d1913c78}"
LAMBDA_FN="${LAMBDA_FN:-cloudless-production-CloudlessSiteServerUseast1Function-ddkafukh}"
SITE="${SITE:-https://cloudless.gr}"
FAIL=0

say() { printf '%s\n' "$*"; }

# ── 1. Token validity + Workers AI scope ─────────────────────────────────────
if [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
  say "== 1. Cloudflare token"
  VERIFY=$(curl -s --max-time 15 \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    https://api.cloudflare.com/client/v4/user/tokens/verify)
  if printf '%s' "$VERIFY" | grep -q '"status":"active"'; then
    say "   token: active"
  else
    say "   token: INVALID — $VERIFY"
    FAIL=1
  fi

  RUN_CODE=$(curl -s -o /tmp/wai-run.json -w '%{http_code}' --max-time 30 \
    -X POST \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"messages":[{"role":"user","content":"ping"}],"max_tokens":1}' \
    "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/@cf/meta/llama-3-8b-instruct")
  if [ "$RUN_CODE" = "200" ]; then
    say "   Workers AI scope: OK (inference HTTP 200)"
  else
    say "   Workers AI scope: MISSING/BLOCKED (HTTP ${RUN_CODE})"
    say "   body: $(head -c 300 /tmp/wai-run.json)"
    say "   fix: dash.cloudflare.com → API Tokens → edit token → add Account → Workers AI → Read+Run"
    FAIL=1
  fi
else
  say "== 1. Cloudflare token — SKIPPED (CLOUDFLARE_API_TOKEN not set)"
fi

# ── 2. Lambda env wiring ─────────────────────────────────────────────────────
if command -v aws >/dev/null 2>&1 && aws sts get-caller-identity >/dev/null 2>&1; then
  say "== 2. Lambda env"
  ENVV=$(aws lambda get-function-configuration --function-name "$LAMBDA_FN" \
    --region us-east-1 \
    --query "Environment.Variables.{ID:CLOUDFLARE_ACCOUNT_ID,TOK:CLOUDFLARE_API_TOKEN}" \
    --output text 2>/dev/null)
  ID_VAL=$(printf '%s' "$ENVV" | awk '{print $1}')
  TOK_VAL=$(printf '%s' "$ENVV" | awk '{print $2}')
  if [ "$ID_VAL" != "None" ] && [ -n "$ID_VAL" ]; then
    say "   CLOUDFLARE_ACCOUNT_ID: present"
  else
    say "   CLOUDFLARE_ACCOUNT_ID: MISSING — redeploy after setting the repo secret"
    FAIL=1
  fi
  if [ "$TOK_VAL" != "None" ] && [ -n "$TOK_VAL" ]; then
    say "   CLOUDFLARE_API_TOKEN: present"
  else
    say "   CLOUDFLARE_API_TOKEN: MISSING — add repo secret CLOUDFLARE_API_TOKEN, then gh workflow run deploy.yml"
    FAIL=1
  fi
else
  say "== 2. Lambda env — SKIPPED (no AWS credentials)"
fi

# ── 3. Live endpoint deployed + auth-gated ───────────────────────────────────
say "== 3. Live endpoint"
LIVE_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 \
  -X POST -H "Content-Type: application/json" -d '{"prompt":"ping"}' \
  "${SITE}/api/admin/ai/generate")
case "$LIVE_CODE" in
  401|403) say "   unauth POST → ${LIVE_CODE} (auth gate OK, route deployed)" ;;
  404)     say "   unauth POST → 404 — route NOT deployed yet (wait for deploy.yml)"; FAIL=1 ;;
  *)       say "   unauth POST → ${LIVE_CODE} (unexpected)"; FAIL=1 ;;
esac

say ""
if [ "$FAIL" = "0" ]; then
  say "WORKERS AI DOCTOR: all runnable checks passed ✓"
else
  say "WORKERS AI DOCTOR: issues found ✗"
fi
exit "$FAIL"
