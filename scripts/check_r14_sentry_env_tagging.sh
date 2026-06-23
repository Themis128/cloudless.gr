#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(pwd)}"
cd "$ROOT"

ok=0
fail=0
warn=0

pass() {
  printf '✅ %s\n' "$*"
  ok=$((ok + 1))
}

missing() {
  printf '❌ %s\n' "$*"
  fail=$((fail + 1))
}

warning() {
  printf '⚠️  %s\n' "$*"
  warn=$((warn + 1))
}

literal_contains() {
  local file="$1"
  local text="$2"

  [[ -f "$file" ]] && grep -qF "$text" "$file"
}

echo "== R14 Sentry env tagging check =="
echo "Repo: $ROOT"
echo

literal_contains sentry.server.config.ts 'process.env.SENTRY_ENVIRONMENT' \
  && pass 'server config uses SENTRY_ENVIRONMENT' \
  || missing 'server config missing SENTRY_ENVIRONMENT'

literal_contains sentry.edge.config.ts 'process.env.SENTRY_ENVIRONMENT' \
  && pass 'edge config uses SENTRY_ENVIRONMENT' \
  || missing 'edge config missing SENTRY_ENVIRONMENT'

literal_contains sentry.client.config.ts 'process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT' \
  && pass 'client config uses NEXT_PUBLIC_SENTRY_ENVIRONMENT' \
  || missing 'client config missing NEXT_PUBLIC_SENTRY_ENVIRONMENT'

echo

literal_contains .github/workflows/deploy.yml 'SENTRY_ENVIRONMENT: prod' \
  && pass 'AWS deploy sets SENTRY_ENVIRONMENT: prod' \
  || missing 'AWS deploy missing SENTRY_ENVIRONMENT: prod'

literal_contains .github/workflows/deploy.yml 'NEXT_PUBLIC_SENTRY_ENVIRONMENT: prod' \
  && pass 'AWS deploy sets NEXT_PUBLIC_SENTRY_ENVIRONMENT: prod' \
  || missing 'AWS deploy missing NEXT_PUBLIC_SENTRY_ENVIRONMENT: prod'

echo

for f in .github/workflows/deploy-pi.yml .github/workflows/build-pi-image.yml; do
  if [[ -f "$f" ]]; then
    literal_contains "$f" 'SENTRY_ENVIRONMENT=pi-standby' \
      && pass "$f sets SENTRY_ENVIRONMENT=pi-standby" \
      || missing "$f missing SENTRY_ENVIRONMENT=pi-standby"

    literal_contains "$f" 'NEXT_PUBLIC_SENTRY_ENVIRONMENT=pi-standby' \
      && pass "$f sets NEXT_PUBLIC_SENTRY_ENVIRONMENT=pi-standby" \
      || missing "$f missing NEXT_PUBLIC_SENTRY_ENVIRONMENT=pi-standby"
  else
    warning "$f not found"
  fi
done

echo

if [[ -f Dockerfile ]]; then
  literal_contains Dockerfile 'ARG SENTRY_ENVIRONMENT' \
    && pass 'Dockerfile declares ARG SENTRY_ENVIRONMENT' \
    || warning 'Dockerfile missing ARG SENTRY_ENVIRONMENT'

  literal_contains Dockerfile 'ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT' \
    && pass 'Dockerfile declares ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT' \
    || warning 'Dockerfile missing ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT'

  literal_contains Dockerfile 'SENTRY_ENVIRONMENT=${SENTRY_ENVIRONMENT}' \
    && pass 'Dockerfile exports SENTRY_ENVIRONMENT' \
    || warning 'Dockerfile may not export SENTRY_ENVIRONMENT'

  literal_contains Dockerfile 'NEXT_PUBLIC_SENTRY_ENVIRONMENT=${NEXT_PUBLIC_SENTRY_ENVIRONMENT}' \
    && pass 'Dockerfile exports NEXT_PUBLIC_SENTRY_ENVIRONMENT' \
    || warning 'Dockerfile may not export NEXT_PUBLIC_SENTRY_ENVIRONMENT'
else
  warning 'Dockerfile not found'
fi

echo

[[ -f __tests__/r14-sentry-env-tagging.test.ts ]] \
  && pass 'R14 static test exists' \
  || warning 'R14 static test missing'

echo
printf 'Summary: %s passed, %s warnings, %s failures\n' "$ok" "$warn" "$fail"

[[ "$fail" -eq 0 ]]
