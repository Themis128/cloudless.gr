#!/usr/bin/env bash
#
# rollback.sh — instant rollback of the Pi-hosted cloudless.gr Next.js app
#               to any previously-deployed release, using the atomic-symlink
#               layout on omv (Pi 5).
#
# LAYOUT ON omv:
#   /home/tbaltzakis/cloudless-releases/<sha>/    ← each deploy writes here
#   /home/tbaltzakis/cloudless-standalone         ← symlink to a release
#   The k8s Deployment cloudless-app mounts cloudless-standalone via hostPath;
#   flipping the symlink + a rollout restart swaps versions in ~15s.
#
# USAGE (from the repo root; needs `kubectl` pointed at k3s + SSH to omv over Tailscale):
#   scripts/rollback.sh list                       # show available releases (newest first)
#   scripts/rollback.sh previous                   # flip to the release before the current one
#   scripts/rollback.sh <sha-prefix>               # flip to a specific release (SHA prefix ok)
#   scripts/rollback.sh --check                    # show current live + linked SHAs, no changes
#
# SAFETY:
# - Purely metadata: no code is rebuilt, no rsync, no destructive delete.
# - The failed release stays on disk (in releases/<its-sha>/), so any rollback
#   can itself be re-rolled-forward if you change your mind.
# - Verifies /api/health after the swap; refuses to leave things half-flipped.
#
set -euo pipefail

SSH_TARGET="${SSH_TARGET:-tbaltzakis@100.74.191.58}"   # omv over Tailscale
KEY="${SSH_KEY:-$HOME/.ssh/id_rsa}"
SSH="ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 -i $KEY $SSH_TARGET"
BASE=/home/tbaltzakis
RELEASES="$BASE/cloudless-releases"
CURRENT="$BASE/cloudless-standalone"
NS=cloudless
DEPLOY=cloudless-app
SITE="${SITE:-https://cloudless.gr}"

log()  { printf '\033[1m[rollback]\033[0m %s\n' "$*"; }
die()  { printf '\033[31m[rollback] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

# resolve the currently-linked SHA on omv
current_sha() {
  $SSH "readlink '$CURRENT' 2>/dev/null | sed 's|^cloudless-releases/||'" 2>/dev/null
}

# list release SHAs on omv, newest mtime first
list_releases() {
  $SSH "ls -1t '$RELEASES' 2>/dev/null" 2>/dev/null
}

# health probe of the live site — returns the version string or empty
live_version() {
  curl -sS --max-time 15 "$SITE/api/health" 2>/dev/null \
    | python3 -c "import sys,json;print(json.load(sys.stdin).get('version','')[:12])" 2>/dev/null
}

do_check() {
  local cur=$(current_sha)
  local live=$(live_version)
  log "linked on omv : $cur"
  log "live version  : $live"
  echo
  log "available releases (newest first):"
  list_releases | nl -w4 -s'  '
}

do_list() {
  local cur=$(current_sha)
  log "current linked: $cur"
  echo
  list_releases | awk -v cur="$cur" '{printf "  %s  %s\n", ($1==cur?"→":"  "), $1}'
}

# flip the symlink to $1 and restart the pod; verify health.
flip_to() {
  local target="$1"
  [ -n "$target" ] || die "no target release given"
  # verify release dir exists on omv
  $SSH "test -d '$RELEASES/$target'" || die "release '$target' does not exist on omv (list with 'scripts/rollback.sh list')"
  local cur=$(current_sha)
  if [ "$cur" = "$target" ]; then
    log "already on $target — nothing to do"; return 0
  fi
  log "flipping symlink: $cur → $target"
  $SSH "sudo ln -sfn 'cloudless-releases/$target' '$CURRENT' && sudo chown -h tbaltzakis:users '$CURRENT'"
  log "restarting deploy/$DEPLOY in ns $NS…"
  $SSH "sudo k3s kubectl -n '$NS' rollout restart deploy/$DEPLOY >/dev/null && sudo k3s kubectl -n '$NS' rollout status deploy/$DEPLOY --timeout=180s" | tail -1

  # verify /api/health returns the expected version
  local expected="$target" tries=0
  while [ $tries -lt 8 ]; do
    local got=$(live_version)
    if [ -n "$got" ] && [ "${expected:0:12}" = "${got:0:12}" ]; then
      log "✅ live version now: $got"; return 0
    fi
    tries=$((tries+1)); sleep 4
  done
  die "rollout completed but /api/health didn't report the expected version ($expected). Investigate."
}

# main dispatch
case "${1:-}" in
  ""|--help|-h)  sed -n '2,25p' "$0"; exit 0 ;;
  --check)       do_check ;;
  list)          do_list ;;
  previous)
    cur=$(current_sha)
    releases=$(list_releases | grep -v "^$cur$" | head -1)
    [ -n "$releases" ] || die "no previous release available (only '$cur' exists)"
    flip_to "$releases"
    ;;
  *)
    # match SHA prefix against available releases
    target=$(list_releases | grep -m1 "^$1" || true)
    [ -n "$target" ] || die "no release matching prefix '$1' (list with 'scripts/rollback.sh list')"
    flip_to "$target"
    ;;
esac
