#!/usr/bin/env bash
# cloudless-boot-stagger.sh — after docker/k3s are up, pause mailcow briefly
# then bring it back so the Pi 5 boot storm does not trip the HW watchdog.
set -euo pipefail
LOG_TAG=cloudless-boot-stagger
log() { echo "[$LOG_TAG] $*"; logger -t "$LOG_TAG" "$*" 2>/dev/null || true; }

COMPOSE="${MAILCOW_COMPOSE:-/srv/mailcow/docker-compose.yml}"
DELAY_SEC="${BOOT_STAGGER_DELAY_SEC:-180}"

# Mailbox SoT is omv-ha (Roundcube/dovecot). Mailcow on omv is retired —
# do not start it (it contributed to Pi 5 watchdog reboot storms).
if [[ -f /srv/mailcow/DISABLED.cloudless ]] || [[ "${SKIP_MAILCOW:-1}" == "1" ]]; then
  log "mailcow skipped (DISABLED.cloudless or SKIP_MAILCOW=1) — SoT is omv-ha"
  exit 0
fi

if [[ ! -f "$COMPOSE" ]]; then
  log "no mailcow compose at $COMPOSE — skip"
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  log "docker missing — skip"
  exit 0
fi

log "stopping mailcow for ${DELAY_SEC}s so k3s can settle"
docker compose -f "$COMPOSE" stop >/dev/null 2>&1 || true

# Wait for load to drop or timeout
deadline=$((SECONDS + DELAY_SEC))
while (( SECONDS < deadline )); do
  # 1-min load average (field 1 of /proc/loadavg)
  load1=$(awk '{print $1}' /proc/loadavg)
  # Bash can't float-compare easily — use awk
  if awk -v l="$load1" 'BEGIN { exit !(l < 8.0) }'; then
    log "load1=${load1} < 8 — early resume (${SECONDS}s elapsed)"
    break
  fi
  sleep 10
done

log "starting mailcow"
docker compose -f "$COMPOSE" up -d >/dev/null 2>&1 || log "WARN: mailcow up -d failed"
log "done"
