#!/usr/bin/env bash
set -euo pipefail

nodes=(omv omv-ha)

ok=0
fail=0

pass() {
  printf '✅ %s\n' "$*"
  ok=$((ok+1))
}

missing() {
  printf '❌ %s\n' "$*"
  fail=$((fail+1))
}

echo "== cluster node SSH access check =="
echo

for node in "${nodes[@]}"; do
  echo "-- $node --"

  if ! getent hosts "$node" >/dev/null 2>&1; then
    missing "$node does not resolve via hosts/DNS"
    echo
    continue
  fi

  pass "$node resolves"

  tmp="$(mktemp)"
  if ssh -o BatchMode=yes -o ConnectTimeout=8 "$node" \
    'hostname; hostname -I; uname -a; command -v kubectl >/dev/null 2>&1 && echo kubectl-ok || true' \
    >"$tmp" 2>&1; then
    cat "$tmp"
    pass "$node SSH works non-interactively"
  else
    cat "$tmp" || true
    missing "$node SSH failed non-interactively"
  fi

  rm -f "$tmp"
  echo
done

printf 'Summary: %s passed, %s failures\n' "$ok" "$fail"

[[ "$fail" -eq 0 ]]
