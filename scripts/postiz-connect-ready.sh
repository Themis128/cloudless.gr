#!/usr/bin/env bash
# postiz-connect-ready.sh — verify OAuth env + Integration row count.
# Does not print secret values. Exit 0 when at least one channel is connected
# OR when --env-only (providers present enough to start UI OAuth).
set -euo pipefail

NS="${POSTIZ_NAMESPACE:-postiz}"
ENV_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --env-only) ENV_ONLY=1 ;;
  esac
done

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
ok() { printf '  OK  %s\n' "$*"; }
miss() { printf '  MISSING %s\n' "$*"; }

bold "==> Postiz OAuth env (pod)"
kubectl -n "$NS" exec deploy/postiz -- sh -c '
  for k in LINKEDIN_CLIENT_ID LINKEDIN_CLIENT_SECRET X_API_KEY X_API_SECRET \
           TIKTOK_CLIENT_ID TIKTOK_CLIENT_SECRET FACEBOOK_APP_ID FACEBOOK_APP_SECRET \
           POSTIZ_API_KEY API_LIMIT; do
    v=$(printenv "$k" 2>/dev/null || true)
    if [ -n "$v" ]; then echo "OK $k"; else echo "MISSING $k"; fi
  done
'

bold "==> Integration count (Postgres)"
COUNT=$(kubectl -n "$NS" exec deploy/postiz-postgres -- \
  psql -U postiz -d postiz -tAc 'SELECT count(*) FROM "Integration";' | tr -d '[:space:]')
echo "  Integration rows: ${COUNT:-?}"

if [[ "$ENV_ONLY" -eq 1 ]]; then
  bold "Env-only check done (channels still require UI OAuth)."
  exit 0
fi

if [[ "${COUNT:-0}" -gt 0 ]]; then
  ok "channels connected ($COUNT)"
  exit 0
fi

miss "no integrations — connect in https://postiz.cloudless.gr (see docs/integrations/POSTIZ-CONNECT.md)"
exit 1
