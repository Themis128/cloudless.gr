#!/usr/bin/env bash
# gha-runner-heal.sh — clear ghost-busy / dead GitHub Actions runners after reboot.
#
# After a host power-cycle or sleep, the runner service can look "active" locally
# while GitHub still shows the runner offline+busy, blocking the job queue.
# This script:
#   1. On boot (--boot): always restart every actions.runner.*.service
#   2. Periodically (--check): restart any unit that is active but has no
#      Runner.Listener process (wedged listener)
#
# Safe to run while idle. Does NOT interrupt a healthy busy runner that has a
# live Listener (active jobs keep working).
set -euo pipefail

MODE="${1:---check}"
LOG_TAG="gha-runner-heal"

log() { echo "[$LOG_TAG] $*"; logger -t "$LOG_TAG" "$*" 2>/dev/null || true; }

list_runner_units() {
  systemctl list-units --type=service --all --no-legend 'actions.runner.*' 2>/dev/null \
    | awk '{print $1}' \
    | grep -E '^actions\.runner\.' \
    || true
}

listener_alive_for_unit() {
  local unit="$1"
  # WorkingDirectory from the unit points at the runner install (…/actions-runner*)
  local cwd
  cwd="$(systemctl show -p WorkingDirectory --value "$unit" 2>/dev/null || true)"
  if [[ -z "$cwd" || "$cwd" == "/" ]]; then
    # Fallback: any Runner.Listener owned by the runner user
    pgrep -f '[R]unner.Listener' >/dev/null 2>&1
    return $?
  fi
  pgrep -f "[R]unner.Listener" >/dev/null 2>&1 || return 1
  # Prefer a listener whose cwd/cmdline references this install path
  if pgrep -af '[R]unner.Listener' 2>/dev/null | grep -F "$cwd" >/dev/null 2>&1; then
    return 0
  fi
  # If only one runner on the box, any Listener is enough
  local count
  count="$(list_runner_units | wc -l)"
  if [[ "$count" -le 1 ]] && pgrep -f '[R]unner.Listener' >/dev/null 2>&1; then
    return 0
  fi
  # Multi-runner host without path match: treat as missing for this unit
  return 1
}

restart_unit() {
  local unit="$1"
  log "restarting $unit"
  systemctl restart "$unit" || log "WARN: restart failed for $unit"
}

case "$MODE" in
  --boot)
    log "boot heal: restarting all actions.runner.* services"
    sleep 5   # let network-online settle
    mapfile -t UNITS < <(list_runner_units)
    if [[ ${#UNITS[@]} -eq 0 ]]; then
      log "no actions.runner.* units found"
      exit 0
    fi
    for u in "${UNITS[@]}"; do
      restart_unit "$u"
    done
    sleep 3
    for u in "${UNITS[@]}"; do
      log "$u → $(systemctl is-active "$u" 2>/dev/null || echo unknown)"
    done
    ;;
  --check)
    mapfile -t UNITS < <(list_runner_units)
    for u in "${UNITS[@]}"; do
      state="$(systemctl is-active "$u" 2>/dev/null || echo inactive)"
      if [[ "$state" != "active" ]]; then
        log "$u is $state — starting"
        systemctl start "$u" || log "WARN: start failed for $u"
        continue
      fi
      if listener_alive_for_unit "$u"; then
        continue
      fi
      log "$u active but Runner.Listener missing — restarting (ghost/wedge)"
      restart_unit "$u"
    done
    ;;
  *)
    echo "Usage: $0 --boot|--check" >&2
    exit 2
    ;;
esac
