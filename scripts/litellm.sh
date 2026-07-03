#!/usr/bin/env bash
# Manage the LiteLLM proxy for Postiz AI (routes to Ollama)
# Usage: ./scripts/litellm.sh {start|stop|restart|status|logs}
set -euo pipefail

NAMESPACE="postiz"
DEPLOYMENT="postiz-litellm"
MANIFEST="infrastructure/appflowy/evicted-deployments/postiz-litellm.yaml"

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
warn() { printf "\033[33mWARN: %s\033[0m\n" "$*" >&2; }

die() { warn "$*"; exit 1; }

start_litellm() {
  bold "==> Starting LiteLLM"
  kubectl -n "${NAMESPACE}" get deploy "${DEPLOYMENT}" >/dev/null 2>&1 && {
    echo "    already exists — skipping apply";
  } || {
    kubectl apply -f "${MANIFEST}";
  }
  kubectl -n "${NAMESPACE}" rollout status deploy/${DEPLOYMENT} --timeout=120s
  kubectl -n "${NAMESPACE}" get pods -l app=${DEPLOYMENT}
}

stop_litellm() {
  bold "==> Stopping LiteLLM"
  kubectl -n "${NAMESPACE}" delete deploy "${DEPLOYMENT}" || true
  kubectl -n "${NAMESPACE}" get pods -l app=${DEPLOYMENT} || true
}

status_litellm() {
  kubectl -n "${NAMESPACE}" get pods -l app=${DEPLOYMENT} || true
}

logs_litellm() {
  kubectl -n "${NAMESPACE}" logs deploy/${DEPLOYMENT} --tail=50 -f
}

case "${1:-}" in
  start)
    start_litellm
    ;;
  stop)
    stop_litellm
    ;;
  restart)
    stop_litellm
    sleep 2
    start_litellm
    ;;
  status)
    status_litellm
    ;;
  logs)
    logs_litellm
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|logs}"
    exit 1
    ;;
esac
