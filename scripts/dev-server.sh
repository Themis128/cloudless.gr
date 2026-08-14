#!/usr/bin/env bash
# Foreground Next.js supervisor for local `pnpm dev`.
#
# Heals the failures that leave localhost:4000 dead or lying:
#   - EADDRINUSE / leftover next-server after Ctrl+C or Playwright
#   - process crash / SIGKILL / OOM
#   - hung /api/health
#   - stale Turbopack routing (auth pages and APIs 404 in a few ms)
# Always kills the whole tree on SIGINT/SIGTERM so the next start is clean.
#
# Usage:
#   bash scripts/dev-server.sh [--webpack] [--clean] [--no-heal]
# Env:
#   DEV_PORT          listen port (default 4000)
#   DEV_HOST          hostname (default localhost)
#   DEV_HEAL=0        disable probe-based restarts (crash restart still runs)
#   DEV_HEAL_INTERVAL probe period in seconds (default 5)
#   DEV_HEAL_FAILS    consecutive probe failures before restart (default 3)
#   DEV_HEAL_MAX      max restarts per session (default 20)

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT="${DEV_PORT:-4000}"
HOST="${DEV_HOST:-localhost}"
BUNDLER="turbopack"
CLEAN=0
HEAL="${DEV_HEAL:-1}"
INTERVAL="${DEV_HEAL_INTERVAL:-5}"
FAILS_NEEDED="${DEV_HEAL_FAILS:-3}"
MAX_RESTARTS="${DEV_HEAL_MAX:-20}"
READY_TIMEOUT="${DEV_READY_TIMEOUT:-90}"
CHILD=""
SHUTDOWN=0
RESTARTS=0
BOOT_FAILURES=0
CLEANED_FOR_STALE=0
PIDFILE="${XDG_RUNTIME_DIR:-/tmp}/cloudless-dev-${PORT}.pid"

log() { printf '[dev-heal] %s\n' "$*"; }

# Local next-dev always binds wrangler D1 sqlite unless HTTP D1 is forced.
if [[ "${AUTH_DB_USE_HTTP:-}" != "1" ]]; then
  export AUTH_DB_PREFER_LOCAL="${AUTH_DB_PREFER_LOCAL:-1}"
fi

for arg in "$@"; do
  case "$arg" in
    --webpack) BUNDLER="webpack" ;;
    --clean) CLEAN=1 ;;
    --restart) ;; # start is always a clean bind
    --no-heal) HEAL=0 ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *)
      log "unknown arg: $arg"
      exit 2
      ;;
  esac
done

# Playwright owns the suite lifecycle; do not yank the server mid-run.
if [[ "${NEXT_PUBLIC_E2E:-}" == "1" || -n "${CI:-}" ]]; then
  HEAL=0
fi

NEXT_BIN="$ROOT/node_modules/.bin/next"
if [[ ! -x "$NEXT_BIN" ]]; then
  log "missing $NEXT_BIN — run pnpm install"
  exit 1
fi

listening_pids() {
  local pids=""
  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | sort -u | tr '\n' ' ')"
  fi
  if [[ -z "${pids// /}" ]] && command -v ss >/dev/null 2>&1; then
    pids="$(ss -ltnp 2>/dev/null | sed -n "s/.*:${PORT} .*pid=\\([0-9][0-9]*\\).*/\\1/p" | sort -u | tr '\n' ' ')"
  fi
  printf '%s' "${pids%% }"
}

kill_tree() {
  local pid="$1"
  local kid
  [[ -n "$pid" ]] || return 0
  while read -r kid; do
    [[ -n "$kid" ]] && kill_tree "$kid"
  done < <(pgrep -P "$pid" 2>/dev/null || true)
  kill -TERM "$pid" 2>/dev/null || true
}

free_port() {
  local pids
  pids="$(listening_pids)"
  if [[ -n "${pids// /}" ]]; then
    log "freeing :$PORT (pids: $pids)"
    # shellcheck disable=SC2086
    kill -TERM $pids 2>/dev/null || true
    sleep 0.4
    pids="$(listening_pids)"
    if [[ -n "${pids// /}" ]]; then
      # shellcheck disable=SC2086
      kill -9 $pids 2>/dev/null || true
      sleep 0.3
    fi
  fi

  local leftover
  leftover="$(pgrep -f "next dev -p ${PORT}" 2>/dev/null | grep -v "^$$$" || true)"
  if [[ -n "$leftover" ]]; then
    log "killing leftover next dev -p $PORT (pids: $leftover)"
    # shellcheck disable=SC2086
    kill -TERM $leftover 2>/dev/null || true
    sleep 0.3
    # shellcheck disable=SC2086
    kill -9 $leftover 2>/dev/null || true
  fi

  local still
  still="$(listening_pids)"
  if [[ -n "${still// /}" ]]; then
    log "port $PORT still bound after kill (pids: $still)"
    return 1
  fi

  local lock="$ROOT/.next/dev/lock"
  if [[ -e "$lock" ]]; then
    rm -f "$lock" 2>/dev/null || true
  fi
  return 0
}

http_code() {
  local url="$1"
  local timeout="${2:-3}"
  local code
  code="$(curl -sS -o /dev/null -w "%{http_code}" --max-time "$timeout" "$url" 2>/dev/null || true)"
  printf '%s' "${code:-000}"
}

route_ok() {
  local code="$1"
  case "$code" in
    404|000) return 1 ;;
    *) return 0 ;;
  esac
}

stop_child() {
  if [[ -n "$CHILD" ]] && kill -0 "$CHILD" 2>/dev/null; then
    kill_tree "$CHILD"
    local i
    for i in 1 2 3 4 5 6 7 8; do
      kill -0 "$CHILD" 2>/dev/null || break
      sleep 0.25
    done
    if kill -0 "$CHILD" 2>/dev/null; then
      kill -9 "$CHILD" 2>/dev/null || true
      kill_tree "$CHILD"
    fi
    wait "$CHILD" 2>/dev/null || true
  fi
  CHILD=""
  free_port || true
}

release_pidfile() {
  if [[ -f "$PIDFILE" ]] && [[ "$(cat "$PIDFILE" 2>/dev/null || true)" == "$$" ]]; then
    rm -f "$PIDFILE"
  fi
}

on_signal() {
  SHUTDOWN=1
  log "stopping (signal) — releasing :$PORT"
  stop_child
  release_pidfile
  exit 0
}
trap on_signal INT TERM

takeover_supervisor() {
  local old i
  if [[ -f "$PIDFILE" ]]; then
    old="$(cat "$PIDFILE" 2>/dev/null || true)"
    if [[ "$old" =~ ^[0-9]+$ ]] && kill -0 "$old" 2>/dev/null && [[ "$old" != "$$" ]]; then
      log "taking over from supervisor pid $old"
      kill -TERM "$old" 2>/dev/null || true
      for i in $(seq 1 25); do
        kill -0 "$old" 2>/dev/null || break
        sleep 0.2
      done
      kill -9 "$old" 2>/dev/null || true
    fi
  fi
  echo $$ > "$PIDFILE"
}

ensure_local_d1() {
  if [[ "${AUTH_DB_USE_HTTP:-}" == "1" ]]; then
    log "AUTH_DB_USE_HTTP=1 — skipping local D1 sqlite migrate"
    return 0
  fi
  log "ensuring local D1 (user-auth-db)"
  if ! bash "$ROOT/scripts/ensure-local-d1.sh"; then
    log "local D1 migrate failed — AUTH_DB will be unbound"
    return 1
  fi
  return 0
}

health_ok() {
  local body
  body="$(curl -sS --max-time 8 "http://${HOST}:${PORT}/api/health" 2>/dev/null || true)"
  printf '%s' "$body" | python3 -c '
import json, sys
raw = sys.stdin.read()
try:
    data = json.loads(raw)
except Exception:
    raise SystemExit(1)
ok = data.get("status") == "ok" and data.get("dbConnected") is True
raise SystemExit(0 if ok else 1)
'
}

clear_cache() {
  log "clearing .next and tmp"
  rm -rf "$ROOT/.next" "$ROOT/tmp"
}

if [[ "$CLEAN" -eq 1 ]]; then
  clear_cache
fi

start_next() {
  local args=(dev -p "$PORT" --hostname "$HOST")
  if [[ "$BUNDLER" == "webpack" ]]; then
    args+=(--webpack)
  fi
  log "starting next ${args[*]} ($BUNDLER)"
  "$NEXT_BIN" "${args[@]}" &
  CHILD=$!
}

wait_ready() {
  local i code
  for i in $(seq 1 "$READY_TIMEOUT"); do
    if [[ "$SHUTDOWN" -eq 1 ]]; then
      return 1
    fi
    if ! kill -0 "$CHILD" 2>/dev/null; then
      wait "$CHILD" 2>/dev/null || true
      log "next exited before ready"
      return 1
    fi
    code="$(http_code "http://${HOST}:${PORT}/api/health" 8)"
    if [[ "$code" == "200" ]] && health_ok; then
      log "healthy after ${i}s (/api/health ok, D1 bound)"
      return 0
    fi
    sleep 1
  done
  log "timed out waiting for /api/health (last ${code:-000})"
  return 1
}

warm_routes() {
  local path code attempt ok
  local paths=(
    /api/health
    /en
    /en/auth/login
    /en/auth/signup
    /api/auth/session
    /api/auth/login
  )
  for path in "${paths[@]}"; do
    ok=0
    for attempt in $(seq 1 8); do
      code="$(http_code "http://${HOST}:${PORT}${path}" 8)"
      if route_ok "$code"; then
        ok=1
        break
      fi
      sleep 0.5
    done
    if [[ "$ok" -eq 0 ]]; then
      log "warm ${path} still ${code:-000} — treating as stale routing"
      return 1
    fi
  done
  log "warmed auth + health routes"
  return 0
}

watch_child() {
  local fail=0 code login_fail=0
  while kill -0 "$CHILD" 2>/dev/null; do
    if [[ "$SHUTDOWN" -eq 1 ]]; then
      return 0
    fi
    sleep "$INTERVAL"
    if [[ "$HEAL" != "1" ]]; then
      continue
    fi
    code="$(http_code "http://${HOST}:${PORT}/api/health")"
    if [[ "$code" != "200" ]] || ! health_ok; then
      fail=$((fail + 1))
      log "health ${code} d1-unbound (${fail}/${FAILS_NEEDED})"
      if [[ "$fail" -ge "$FAILS_NEEDED" ]]; then
        return 1
      fi
      continue
    fi
    fail=0
    code="$(http_code "http://${HOST}:${PORT}/en/auth/login")"
    if ! route_ok "$code"; then
      login_fail=$((login_fail + 1))
      log "auth login ${code} (${login_fail}/${FAILS_NEEDED})"
      if [[ "$login_fail" -ge "$FAILS_NEEDED" ]]; then
        return 1
      fi
    else
      login_fail=0
    fi
  done
  wait "$CHILD" 2>/dev/null || true
  log "next process exited"
  return 1
}

if [[ ! -f "$ROOT/.env.local" ]]; then
  log "warning: .env.local is missing — CMS/integrations may be degraded; D1 still binds via local sqlite"
fi

log "auto-heal on (crash restart always; probe restart=$HEAL). Ctrl+C stops the tree."
takeover_supervisor

while [[ "$SHUTDOWN" -eq 0 ]]; do
  if ! ensure_local_d1; then
    RESTARTS=$((RESTARTS + 1))
    if [[ "$RESTARTS" -ge "$MAX_RESTARTS" ]]; then
      log "gave up after ${MAX_RESTARTS} restarts (D1 migrate failed)"
      stop_child
      release_pidfile
      exit 1
    fi
    sleep 2
    continue
  fi
  if ! free_port; then
    log "could not bind :$PORT — retrying"
    sleep 1
    continue
  fi

  start_next
  if ! wait_ready; then
    if [[ "$SHUTDOWN" -eq 1 ]]; then
      stop_child
      break
    fi
    BOOT_FAILURES=$((BOOT_FAILURES + 1))
    stop_child
    if [[ "$BOOT_FAILURES" -eq 3 && "$CLEANED_FOR_STALE" -eq 0 ]]; then
      CLEANED_FOR_STALE=1
      clear_cache
    fi
  else
    BOOT_FAILURES=0
    if ! warm_routes; then
      log "stale routing after ready — restarting"
      stop_child
      if [[ "$CLEANED_FOR_STALE" -eq 0 ]]; then
        CLEANED_FOR_STALE=1
        rm -f "$ROOT/.next/dev/lock" 2>/dev/null || true
      fi
    else
      watch_child || true
      stop_child
    fi
  fi

  if [[ "$SHUTDOWN" -eq 1 ]]; then
    break
  fi

  RESTARTS=$((RESTARTS + 1))
  if [[ "$RESTARTS" -ge "$MAX_RESTARTS" ]]; then
    log "gave up after ${MAX_RESTARTS} restarts"
    stop_child
    release_pidfile
    exit 1
  fi
  backoff=$((RESTARTS < 5 ? RESTARTS * 2 : 10))
  log "restart ${RESTARTS}/${MAX_RESTARTS} in ${backoff}s"
  sleep "$backoff"
done

release_pidfile
exit 0
