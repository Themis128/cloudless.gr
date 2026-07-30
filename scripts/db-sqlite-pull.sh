#!/usr/bin/env bash
# db-sqlite-pull.sh — copy in-pod SQLite files to .local/db/ for SQLTools.
#
# n8n / Uptime Kuma / Grafana keep SQLite on PVCs (no TCP DB service).
# Pull a snapshot locally, then open the matching SQLTools connection.
# Docs: docs/databases/
#
# Usage:
#   bash scripts/db-sqlite-pull.sh
#   bash scripts/db-sqlite-pull.sh n8n
#   bash scripts/db-sqlite-pull.sh kuma
#   bash scripts/db-sqlite-pull.sh grafana

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/.local/db"
mkdir -p "$OUT"

need_kubectl() {
  export NO_PROXY="${NO_PROXY:-},127.0.0.1,::1,localhost,192.168.1.128,192.168.1.130,10.43.0.0/16,10.42.0.0/16,.svc,.cluster.local"
  export no_proxy="$NO_PROXY"
  unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy \
    SOCKS_PROXY SOCKS5_PROXY socks_proxy socks5_proxy 2>/dev/null || true
  if ! kubectl get ns >/dev/null 2>&1; then
    echo "kubectl cannot reach the cluster" >&2
    exit 1
  fi
}

pull_n8n() {
  local pod
  pod="$(kubectl -n n8n get pod -l app=n8n -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
  if [[ -z "$pod" ]]; then
    pod="$(kubectl -n n8n get pods -o jsonpath='{.items[0].metadata.name}')"
  fi
  echo "pulling n8n SQLite from $pod …"
  kubectl -n n8n exec "$pod" -- sh -c 'test -f /home/node/.n8n/database.sqlite'
  kubectl -n n8n cp "${pod}:/home/node/.n8n/database.sqlite" "$OUT/n8n.sqlite"
  echo "→ $OUT/n8n.sqlite"
}

pull_kuma() {
  local pod
  pod="$(kubectl -n uptime-kuma get pod -l app=uptime-kuma -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
  if [[ -z "$pod" ]]; then
    pod="$(kubectl -n uptime-kuma get pods -o jsonpath='{.items[0].metadata.name}')"
  fi
  echo "pulling Uptime Kuma SQLite from $pod …"
  # common paths across Kuma versions
  local src
  src="$(kubectl -n uptime-kuma exec "$pod" -- sh -c '
    for f in /app/data/kuma.db /app/data/db/kuma.db /app/data/database.db; do
      if [ -f "$f" ]; then echo "$f"; exit 0; fi
    done
    find /app/data -name "*.db" 2>/dev/null | head -1
  ')"
  if [[ -z "$src" ]]; then
    echo "no .db found under /app/data in $pod" >&2
    exit 1
  fi
  kubectl -n uptime-kuma cp "${pod}:${src}" "$OUT/uptime-kuma.db"
  echo "→ $OUT/uptime-kuma.db (from $src)"
}

pull_grafana() {
  local pod
  pod="$(kubectl -n monitoring get pod -l app.kubernetes.io/name=grafana -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
  if [[ -z "$pod" ]]; then
    pod="$(kubectl -n monitoring get pods -l app.kubernetes.io/name=grafana -o jsonpath='{.items[0].metadata.name}')"
  fi
  echo "pulling Grafana SQLite from $pod …"
  kubectl -n monitoring exec "$pod" -- sh -c 'test -f /var/lib/grafana/grafana.db'
  kubectl -n monitoring cp "${pod}:/var/lib/grafana/grafana.db" "$OUT/grafana.db"
  echo "→ $OUT/grafana.db"
}

need_kubectl
target="${1:-all}"
case "$target" in
  all)
    pull_n8n
    pull_kuma
    pull_grafana || echo "warn: grafana pull skipped"
    ;;
  n8n) pull_n8n ;;
  kuma|uptime-kuma) pull_kuma ;;
  grafana) pull_grafana ;;
  *)
    echo "Usage: $0 [all|n8n|kuma|grafana]" >&2
    exit 2
    ;;
esac

echo
echo "Open SQLTools connections: omv · n8n SQLite / omv · Uptime Kuma SQLite / omv · Grafana SQLite"
echo "(Re-run this script after writes in the cluster — these are snapshots.)"
