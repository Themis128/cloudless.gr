#!/usr/bin/env bash
#
# Wrapper that loads .env.e2e and runs Playwright.
# When COVERAGE=1, also starts the Next dev server with NODE_V8_COVERAGE so
# server-side V8 coverage is captured.

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.e2e"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
  printf "\033[1;36m[e2e]\033[0m Loaded %s\n" "$ENV_FILE"
fi

ENABLED=()
[ -n "$E2E_USER_EMAIL" ] && [ -n "$E2E_USER_PASSWORD" ] && ENABLED+=("user")
[ -n "$E2E_ADMIN_EMAIL" ] && [ -n "$E2E_ADMIN_PASSWORD" ] && ENABLED+=("admin")
[ -n "$CRON_SECRET" ] && ENABLED+=("cron")
[ -n "${COVERAGE}" ] && ENABLED+=("coverage")
if [ ${#ENABLED[@]} -gt 0 ]; then
  printf "\033[1;32m[e2e]\033[0m Enabled: %s\n" "${ENABLED[*]}"
else
  printf "\033[1;33m[e2e]\033[0m Enabled: (none) — only public/unauth tests will run\n"
fi

cd "$REPO_ROOT"

# In coverage mode, ensure a dev server is running with NODE_V8_COVERAGE.
# If one is already up on 4000 without NODE_V8_COVERAGE, restart it.
if [ "$COVERAGE" = "1" ]; then
  COVDIR="$REPO_ROOT/.coverage-v8-server"
  mkdir -p "$COVDIR"
  rm -f "$COVDIR"/*.json 2>/dev/null

  # If port 4000 is taken, check if the process has NODE_V8_COVERAGE set
  EXISTING_PID="$(lsof -ti:4000 2>/dev/null | head -1)"
  if [ -n "$EXISTING_PID" ]; then
    if cat /proc/"$EXISTING_PID"/environ 2>/dev/null | tr '\0' '\n' | grep -q "^NODE_V8_COVERAGE="; then
      printf "\033[1;32m[e2e]\033[0m Existing dev server already has NODE_V8_COVERAGE — reusing\n"
    else
      printf "\033[1;33m[e2e]\033[0m Killing existing dev server (no NODE_V8_COVERAGE)\n"
      kill -9 "$EXISTING_PID" 2>/dev/null || true
      sleep 2
    fi
  fi

  # Start dev server if not running
  if ! lsof -ti:4000 >/dev/null 2>&1; then
    printf "\033[1;36m[e2e]\033[0m Starting Next dev with NODE_V8_COVERAGE=%s\n" "$COVDIR"
    NODE_V8_COVERAGE="$COVDIR" NEXT_PUBLIC_E2E=1 setsid npx next dev -p 4000 --webpack < /dev/null >> "$REPO_ROOT/.coverage-run/dev.log" 2>&1 &
    disown
    # Wait until up
    for i in $(seq 1 60); do
      if curl -sf -m 2 http://localhost:4000 -o /dev/null; then
        printf "\033[1;32m[e2e]\033[0m Dev server up after %ds\n" "$((i*2))"
        break
      fi
      sleep 2
    done
  fi
fi

exec npx playwright test "$@"
