#!/usr/bin/env bash
# Remediates Tailscale on managed Linux hosts and upgrades to latest stable.
#
# Expects to run on a host that can reach the Pis over LAN (omv runner) or
# already on the tailnet. Does NOT touch Windows office nodes (manual).
#
# Env:
#   DRY_RUN=1     — print plan only
#   FIX=1         — restart inactive tailscaled / bring node back
#   UPGRADE=1     — apt upgrade tailscale to candidate (= latest stable)
#   SSH_USER      — default tbaltzakis
#   REPORT_JSON   — optional fleet-health report to prefer outdated hosts
#
# Usage:
#   FIX=1 UPGRADE=1 bash scripts/tailscale-fleet-upgrade.sh
#   DRY_RUN=1 FIX=1 UPGRADE=1 bash scripts/tailscale-fleet-upgrade.sh
set -euo pipefail

DRY_RUN="${DRY_RUN:-0}"
FIX="${FIX:-0}"
UPGRADE="${UPGRADE:-0}"
SSH_USER="${SSH_USER:-tbaltzakis}"
SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10)
case "${DRY_RUN}" in 1|true|TRUE|yes|YES) DRY_RUN=1 ;; *) DRY_RUN=0 ;; esac
case "${FIX}" in 1|true|TRUE|yes|YES) FIX=1 ;; *) FIX=0 ;; esac
case "${UPGRADE}" in 1|true|TRUE|yes|YES) UPGRADE=1 ;; *) UPGRADE=0 ;; esac

# name|lan_ip|tailnet_ip
HOSTS=(
  "github-omv|192.168.1.128|100.74.191.58"
  "omv-ha|192.168.1.130|100.95.117.84"
)

need() { command -v "$1" >/dev/null || { echo "missing $1" >&2; exit 1; }; }
need ssh
need curl
need jq

LATEST=$(curl -fsSL 'https://pkgs.tailscale.com/stable/?mode=json' | jq -r '.TarballsVersion // empty')
[[ -n "$LATEST" ]] || { echo "Could not resolve latest Tailscale version" >&2; exit 1; }
echo "==> Latest stable: $LATEST"
echo "==> DRY_RUN=$DRY_RUN FIX=$FIX UPGRADE=$UPGRADE"

ssh_try() {
  local host="$1"
  shift
  ssh "${SSH_OPTS[@]}" "${SSH_USER}@${host}" "$@"
}

reachable() {
  local host="$1"
  ssh "${SSH_OPTS[@]}" "${SSH_USER}@${host}" true 2>/dev/null
}

pick_endpoint() {
  local lan="$1" ts="$2"
  if reachable "$lan"; then
    echo "$lan"
    return 0
  fi
  if reachable "$ts"; then
    echo "$ts"
    return 0
  fi
  return 1
}

remote_status() {
  local ep="$1"
  ssh_try "$ep" 'bash -s' <<'EOS'
set -euo pipefail
HOST=$(hostname 2>/dev/null || echo unknown)
ACTIVE=$(systemctl is-active tailscaled 2>/dev/null || echo inactive)
VER=$(tailscale version 2>/dev/null | head -1 || echo unknown)
SELF=$(tailscale status --self --json 2>/dev/null | head -c 2000 || true)
BACKEND=$(echo "$SELF" | python3 -c 'import json,sys
try:
  d=json.load(sys.stdin); print(d.get("BackendState") or "")
except Exception:
  print("")' 2>/dev/null || true)
printf 'host=%s active=%s version=%s backend=%s\n' "$HOST" "$ACTIVE" "$VER" "${BACKEND:-unknown}"
EOS
}

remote_fix() {
  local ep="$1"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "  [dry-run] would restart tailscaled on $ep"
    return 0
  fi
  ssh_try "$ep" 'bash -s' <<'EOS'
set -euo pipefail
sudo systemctl enable --now tailscaled
sudo systemctl restart tailscaled
sleep 4
# Keep classic OpenSSH for automation; Tailscale SSH is not required here.
sudo tailscale set --ssh=false 2>/dev/null || true
systemctl is-active tailscaled
tailscale status --self 2>/dev/null | head -2 || true
EOS
}

remote_upgrade() {
  local ep="$1"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "  [dry-run] would apt upgrade tailscale on $ep"
    return 0
  fi
  ssh_try "$ep" 'bash -s' <<'EOS'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
# Ensure Tailscale apt repo exists (idempotent).
if [[ ! -f /etc/apt/sources.list.d/tailscale.list ]] && [[ ! -f /usr/share/keyrings/tailscale-archive-keyring.gpg ]]; then
  curl -fsSL https://tailscale.com/install.sh | sudo sh
fi
sudo apt-get update -qq
BEFORE=$(tailscale version 2>/dev/null | head -1 || echo none)
sudo apt-get install -y -qq --only-upgrade tailscale tailscaled || sudo apt-get install -y -qq tailscale
AFTER=$(tailscale version 2>/dev/null | head -1 || echo none)
echo "before=$BEFORE"
echo "after=$AFTER"
# Restart if package changed or daemon unhealthy.
ACTIVE=$(systemctl is-active tailscaled 2>/dev/null || echo inactive)
if [[ "$BEFORE" != "$AFTER" || "$ACTIVE" != "active" ]]; then
  sudo systemctl restart tailscaled
  sleep 4
  sudo tailscale set --ssh=false 2>/dev/null || true
fi
systemctl is-active tailscaled
tailscale version | head -3
EOS
}

FAIL=0
for entry in "${HOSTS[@]}"; do
  IFS='|' read -r name lan ts <<<"$entry"
  echo ""
  echo "=== $name (lan=$lan ts=$ts) ==="
  EP=""
  if ! EP=$(pick_endpoint "$lan" "$ts"); then
    echo "  UNREACHABLE over SSH (lan + tailnet)"
    FAIL=1
    continue
  fi
  echo "  endpoint=$EP"
  STATUS=$(remote_status "$EP" || true)
  echo "  $STATUS"
  ACTIVE=$(echo "$STATUS" | sed -n 's/.*active=\([^ ]*\).*/\1/p')
  VER=$(echo "$STATUS" | sed -n 's/.*version=\([^ ]*\).*/\1/p')
  VER_BASE="${VER%%-*}"

  if [[ "$FIX" -eq 1 && "$ACTIVE" != "active" ]]; then
    echo "  → fixing inactive tailscaled"
    remote_fix "$EP" || FAIL=1
  fi

  NEEDS_UPGRADE=0
  if [[ "$UPGRADE" -eq 1 ]]; then
    if [[ "$VER_BASE" != "$LATEST" ]]; then
      NEEDS_UPGRADE=1
    elif [[ "${FORCE_APT:-0}" =~ ^(1|true|TRUE)$ ]]; then
      NEEDS_UPGRADE=1
    else
      echo "  already on $LATEST — skip apt (set FORCE_APT=1 to refresh anyway)"
    fi
  fi

  if [[ "$NEEDS_UPGRADE" -eq 1 ]]; then
    echo "  → upgrading Tailscale (have ${VER_BASE:-unknown}, want $LATEST)"
    remote_upgrade "$EP" || FAIL=1
    STATUS2=$(remote_status "$EP" || true)
    echo "  post: $STATUS2"
    VER2=$(echo "$STATUS2" | sed -n 's/.*version=\([^ ]*\).*/\1/p')
    VER2_BASE="${VER2%%-*}"
    if [[ -n "$VER2_BASE" && "$VER2_BASE" != "$LATEST" && "$DRY_RUN" -eq 0 ]]; then
      echo "  ::warning::$name still on $VER2_BASE after upgrade (latest $LATEST)"
      FAIL=1
    fi
  else
    echo "  ok (no upgrade requested)"
  fi
done

echo ""
if [[ "$FAIL" -ne 0 ]]; then
  echo "::error::One or more managed hosts failed Tailscale remediate/upgrade"
  exit 1
fi
echo "==> Fleet remediate/upgrade complete"
