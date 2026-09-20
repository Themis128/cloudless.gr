#!/usr/bin/env bash
#
# secrets-check.sh — verify all critical GitHub repo secrets are set.
# Posts a checklist to issue #382 so the operator knows what's missing.
#
# Secrets checked:
#   Cluster ops:  TS_AUTHKEY, KUBECONFIG_B64, OMV_SSH_KEY
#   CMS:          APPFLOWY_API_URL, APPFLOWY_JWT_SECRET
#   Cloudflare:   CLOUDFLARE_API_TOKEN, CF_ACCOUNT_ID, CF_R2_* keys
#   CI:           GH_PAT, CRON_SECRET
#
# Each secret is tested for non-empty value only (never logged).

set -uo pipefail

note() { printf "[secrets-check] %s\n" "$*"; }

note "=== secrets-check $(date -u '+%F %T')Z ==="

check() {
  local name="$1"
  local value="${2:-}"
  if [ -n "$value" ]; then
    echo "ok:${name}"
  else
    echo "missing:${name}"
  fi
}

# Core cluster operations
check "TS_AUTHKEY"        "${TS_AUTHKEY:-}"
check "KUBECONFIG_B64"    "${KUBECONFIG_B64:-}"
check "OMV_SSH_KEY"       "${OMV_SSH_KEY:-}"

# CMS (AppFlowy)
check "APPFLOWY_API_URL"     "${APPFLOWY_API_URL:-}"
check "APPFLOWY_JWT_SECRET"  "${APPFLOWY_JWT_SECRET:-}"

# Cloudflare
check "CLOUDFLARE_API_TOKEN"    "${CLOUDFLARE_API_TOKEN:-}"
check "CF_ACCOUNT_ID"           "${CF_ACCOUNT_ID:-}"
check "CF_R2_ACCESS_KEY_ID"     "${CF_R2_ACCESS_KEY_ID:-}"
check "CF_R2_SECRET_ACCESS_KEY" "${CF_R2_SECRET_ACCESS_KEY:-}"

# Cron auth
check "CRON_SECRET"         "${CRON_SECRET:-}"

# GitHub
check "GH_PAT"            "${GH_PAT:-}"
check "ADMIN_BOOTSTRAP_PASSWORD" "${ADMIN_BOOTSTRAP_PASSWORD:-}"
