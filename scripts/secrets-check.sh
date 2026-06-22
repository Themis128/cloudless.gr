#!/usr/bin/env bash
#
# secrets-check.sh — verify all critical GitHub repo secrets are set.
# Posts a checklist to issue #382 so the operator knows what's missing.
#
# Secrets checked:
#   Cluster ops:  TS_AUTHKEY, KUBECONFIG_B64, OMV_SSH_KEY
#   Notifications: NOTION_API_KEY
#   Email:        SES_SMTP_USER, SES_SMTP_PASSWORD (or SSM path)
#   CI:           GH_PAT, AWS_DEPLOY_ROLE_ARN
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

# Notion
check "NOTION_API_KEY"    "${NOTION_API_KEY:-}"

# AWS / Deploy
check "AWS_DEPLOY_ROLE_ARN"  "${AWS_DEPLOY_ROLE_ARN:-}"

# SES SMTP (either direct or via SSM)
check "SES_SMTP_USER"     "${SES_SMTP_USER:-}"
check "SES_SMTP_PASSWORD" "${SES_SMTP_PASSWORD:-}"

# GitHub
check "GH_PAT"            "${GH_PAT:-}"
check "ADMIN_BOOTSTRAP_PASSWORD" "${ADMIN_BOOTSTRAP_PASSWORD:-}"
