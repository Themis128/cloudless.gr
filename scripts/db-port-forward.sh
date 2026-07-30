#!/usr/bin/env bash
# db-port-forward.sh — expose omv k3s databases on localhost for SQLTools / redis-cli.
#
# DB ports are ClusterIP-only (never Cloudflare-tunnelled). This script opens
# kubectl port-forwards so Cursor SQLTools can connect to 127.0.0.1.
#
# Usage:
#   bash scripts/db-port-forward.sh          # start all (background)
#   bash scripts/db-port-forward.sh status
#   bash scripts/db-port-forward.sh stop
#   bash scripts/db-port-forward.sh passwords # print DB passwords from k8s secrets
#
# Local ports (fixed; match .vscode/settings.json sqltools.connections):
#   13306  EspoCRM MariaDB
#   15432  AppFlowy Postgres
#   15433  Postiz Postgres
#   16379  AppFlowy Redis
#   16380  Postiz Redis
#   17700  Meilisearch
#   19000  AppFlowy MinIO API
#   19001  AppFlowy MinIO console

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="${CLOUDLESS_DB_FORWARD_DIR:-}"
if [[ -z "$STATE_DIR" ]]; then
  if [[ -n "${XDG_RUNTIME_DIR:-}" && -w "${XDG_RUNTIME_DIR}" ]]; then
    STATE_DIR="${XDG_RUNTIME_DIR}/cloudless-db-forward"
  else
    STATE_DIR="$ROOT/.local/db-forward"
  fi
fi
PID_FILE="$STATE_DIR/pids"
LOG_FILE="$STATE_DIR/forward.log"

mkdir -p "$STATE_DIR"

need_kubectl() {
  # Cursor sandbox injects HTTP(S)_PROXY; LAN kube-apiserver must bypass it.
  export NO_PROXY="${NO_PROXY:-},127.0.0.1,::1,localhost,192.168.1.128,192.168.1.130,10.43.0.0/16,10.42.0.0/16,.svc,.cluster.local"
  export no_proxy="$NO_PROXY"
  unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy \
    SOCKS_PROXY SOCKS5_PROXY socks_proxy socks5_proxy 2>/dev/null || true

  if ! command -v kubectl >/dev/null 2>&1; then
    echo "kubectl not found. See docs/kubectl-tailscale.md" >&2
    exit 1
  fi
  if ! kubectl get ns >/dev/null 2>&1; then
    echo "kubectl cannot reach the cluster (context: $(kubectl config current-context 2>/dev/null || echo unknown))" >&2
    exit 1
  fi
}

# name|namespace|resource|local|remote
FORWARDS=(
  "espocrm-mariadb|espocrm|svc/espocrm-mariadb|13306|3306"
  "appflowy-postgres|appflowy|svc/postgres|15432|5432"
  "postiz-postgres|postiz|svc/postiz-postgres|15433|5432"
  "appflowy-redis|appflowy|svc/redis|16379|6379"
  "postiz-redis|postiz|svc/postiz-redis|16380|6379"
  "meilisearch|meilisearch|svc/meilisearch|17700|7700"
  "appflowy-minio|appflowy|svc/minio|19000|9000"
  "appflowy-minio-console|appflowy|svc/minio|19001|9001"
)

print_map() {
  cat <<'EOF'
Local port map (use after: bash scripts/db-port-forward.sh)
  127.0.0.1:13306  EspoCRM MariaDB     user=espocrm  db=espocrm
  127.0.0.1:15432  AppFlowy Postgres   user=postgres db=postgres
  127.0.0.1:15433  Postiz Postgres     user=postiz   db=postiz
  127.0.0.1:16379  AppFlowy Redis      (no auth)
  127.0.0.1:16380  Postiz Redis        (no auth)
  127.0.0.1:17700  Meilisearch         Bearer MEILI_MASTER_KEY
  127.0.0.1:19000  AppFlowy MinIO API
  127.0.0.1:19001  AppFlowy MinIO console

SQLTools connections are preconfigured in .vscode/settings.json.
Passwords: bash scripts/db-port-forward.sh passwords
SQLite (n8n / Kuma / Grafana): bash scripts/db-sqlite-pull.sh
Cloudflare D1 snapshots:       bash scripts/db-d1-pull.sh
Docs: docs/databases/
(ms-mssql SQL Server extension is not used — MariaDB/Postgres/SQLite/D1 only.)
EOF
}

is_listening() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn "sport = :$port" 2>/dev/null | grep -q ":$port"
  else
    # fallback: try connect
    (echo >/dev/tcp/127.0.0.1/"$port") >/dev/null 2>&1
  fi
}

stop_all() {
  if [[ -f "$PID_FILE" ]]; then
    while read -r pid name; do
      [[ -z "${pid:-}" ]] && continue
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
        echo "stopped $name (pid $pid)"
      fi
    done <"$PID_FILE"
    rm -f "$PID_FILE"
  fi
  # orphan cleanup by port
  for entry in "${FORWARDS[@]}"; do
    IFS='|' read -r name _ns _res local_port _remote <<<"$entry"
    if command -v fuser >/dev/null 2>&1; then
      fuser -k "${local_port}/tcp" >/dev/null 2>&1 || true
    fi
  done
  echo "all port-forwards stopped"
}

status_all() {
  echo "cluster context: $(kubectl config current-context 2>/dev/null || echo unknown)"
  printf '%-24s %-8s %s\n' "NAME" "PORT" "STATE"
  for entry in "${FORWARDS[@]}"; do
    IFS='|' read -r name _ns _res local_port _remote <<<"$entry"
    if is_listening "$local_port"; then
      printf '%-24s %-8s %s\n' "$name" "$local_port" "listening"
    else
      printf '%-24s %-8s %s\n' "$name" "$local_port" "down"
    fi
  done
}

start_one() {
  local name="$1" ns="$2" res="$3" local_port="$4" remote_port="$5"
  if is_listening "$local_port"; then
    echo "skip $name — :$local_port already listening"
    return 0
  fi
  # shellcheck disable=SC2086
  kubectl -n "$ns" port-forward "$res" "${local_port}:${remote_port}" \
    >>"$LOG_FILE" 2>&1 &
  local pid=$!
  echo "$pid $name" >>"$PID_FILE"
  # wait up to ~5s for bind (slow over LAN/Tailscale; postiz-redis often needs longer)
  for _ in $(seq 1 30); do
    if is_listening "$local_port"; then
      echo "ok   $name → 127.0.0.1:${local_port}"
      return 0
    fi
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "FAIL $name — port-forward exited (see $LOG_FILE)" >&2
      return 1
    fi
    sleep 0.167
  done
  echo "warn $name — pid $pid started but :$local_port not yet listening"
}

start_all() {
  need_kubectl
  : >"$LOG_FILE"
  : >"$PID_FILE"
  local failed=0
  for entry in "${FORWARDS[@]}"; do
    IFS='|' read -r name ns res local_port remote_port <<<"$entry"
    start_one "$name" "$ns" "$res" "$local_port" "$remote_port" || failed=1
  done
  echo
  print_map
  if [[ "$failed" -ne 0 ]]; then
    echo >&2
    echo "Some forwards failed — check $LOG_FILE" >&2
    exit 1
  fi
}

print_passwords() {
  need_kubectl
  echo "# Secrets from live cluster (do not commit)"
  echo
  echo "## EspoCRM MariaDB (127.0.0.1:13306)"
  echo "user: espocrm"
  echo -n "password: "
  kubectl -n espocrm get secret espocrm-secrets -o jsonpath='{.data.mariadb-password}' | base64 -d
  echo
  echo -n "root password: "
  kubectl -n espocrm get secret espocrm-secrets -o jsonpath='{.data.mariadb-root-password}' | base64 -d
  echo
  echo
  echo "## AppFlowy Postgres (127.0.0.1:15432)"
  echo "user: postgres"
  echo -n "password: "
  kubectl -n appflowy get secret appflowy-secrets -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d
  echo
  echo
  echo "## Postiz Postgres (127.0.0.1:15433)"
  echo "user: postiz"
  echo -n "password: "
  kubectl -n postiz get secret postiz-secrets -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d
  echo
  echo
  echo "## Meilisearch (127.0.0.1:17700)"
  echo -n "MEILI_MASTER_KEY: "
  kubectl -n meilisearch get secret meilisearch-secret -o jsonpath='{.data.MEILI_MASTER_KEY}' 2>/dev/null | base64 -d \
    || kubectl -n meilisearch get secret meilisearch-secret -o jsonpath='{.data.master-key}' 2>/dev/null | base64 -d \
    || echo "(check secret keys: kubectl -n meilisearch get secret meilisearch-secret -o json)"
  echo
  echo
  echo "## AppFlowy MinIO"
  echo -n "access key: "
  kubectl -n appflowy get secret appflowy-secrets -o jsonpath='{.data.APPFLOWY_S3_ACCESS_KEY}' | base64 -d
  echo
  echo -n "secret key: "
  kubectl -n appflowy get secret appflowy-secrets -o jsonpath='{.data.APPFLOWY_S3_SECRET_KEY}' | base64 -d
  echo
}

cmd="${1:-start}"
case "$cmd" in
  start) start_all ;;
  stop) stop_all ;;
  status) status_all ;;
  passwords) print_passwords ;;
  map) print_map ;;
  *)
    echo "Usage: $0 {start|stop|status|passwords|map}" >&2
    exit 2
    ;;
esac
