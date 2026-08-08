#!/usr/bin/env bash
#
# safedeploy-watchdog.sh — continuous prod health monitor + auto-rollback
#
# Runs on omv (host, outside the k3s cluster) via a systemd timer every 2 min.
# Polls the local cloudless-app NodePort. Uses "Notify-first" strategy:
#
#   • unhealthy 3× in a row  (~6 min)   → send alerts (ntfy + Slack + email)
#   • still unhealthy 8× total (~16 min)→ ALSO run scripts/rollback.sh-style
#                                          symlink flip + kubectl rollout restart,
#                                          then send "rolled back" alert
#   • recovers                          → send "recovered" alert; reset state
#
# Safeguards to prevent rollback loops or premature action:
#   • 60-min cooldown between auto-rollbacks
#   • skip rollback if current release symlink is <15 min old
#     (deploy-time verify already handled that window)
#   • one "alert" notification per incident (no repeated pings)
#
# Config: /etc/safedeploy-watchdog.env populated at install time from the
#         cloudless-secrets k8s Secret. Values are NEVER printed by this script.
#
# State: /var/lib/safedeploy-watchdog/{fail_count,last_rollback_ts,last_notify_ts,notified,incident_start}
#
set -euo pipefail

# --- config ------------------------------------------------------------------
STATE_DIR=/var/lib/safedeploy-watchdog
CURRENT=/home/tbaltzakis/cloudless-standalone
RELEASES=/home/tbaltzakis/cloudless-releases
NS=cloudless
DEPLOY=cloudless-app
HEALTH_URL_LOCAL=http://127.0.0.1:30300/api/health
HEALTH_URL_LAN=http://192.168.1.128:30300/api/health
HEALTH_URL_PUBLIC=https://cloudless.gr/api/health
NOTIFY_THRESHOLD=3        # consecutive failures to send first alert
ROLLBACK_THRESHOLD=8      # consecutive failures to auto-rollback
ROLLBACK_COOLDOWN=3600    # min seconds between auto-rollbacks
MIN_RELEASE_AGE=900       # skip rollback if symlink younger than this (seconds)

# --- credentials (from env file, never printed) ------------------------------
# shellcheck disable=SC1091
[ -f /etc/safedeploy-watchdog.env ] && . /etc/safedeploy-watchdog.env
: "${NTFY_BASE_URL:=}" "${NTFY_TOPIC:=}" "${NTFY_TOKEN:=}"
: "${SLACK_BOT_TOKEN:=}" "${SLACK_CHANNEL:=#general}"
: "${RESEND_API_KEY:=}" "${ALERT_EMAIL:=tbaltzakis@cloudless.gr}"

# --- state helpers -----------------------------------------------------------
mkdir -p "$STATE_DIR"
_get() { cat "$STATE_DIR/$1" 2>/dev/null || echo "$2"; }
_set() { printf '%s\n' "$2" > "$STATE_DIR/$1"; }
_now() { date -u +%s; }

log()  { logger -t safedeploy-watchdog "$*"; printf '[%(%FT%TZ)T] %s\n' -1 "$*"; }

# --- notifications (best-effort; failures never block the watchdog) ---------
notify_ntfy() {
  local title="$1" msg="$2" prio="${3:-high}"
  [ -n "$NTFY_BASE_URL" ] && [ -n "$NTFY_TOPIC" ] || return 0
  local auth=(); [ -n "$NTFY_TOKEN" ] && auth=(-H "Authorization: Bearer $NTFY_TOKEN")
  curl -fsSm 10 -X POST "${NTFY_BASE_URL%/}/${NTFY_TOPIC}" \
       -H "Title: $title" -H "Priority: $prio" -H "Tags: warning" \
       "${auth[@]}" -d "$msg" >/dev/null 2>&1 || true
}

notify_slack() {
  local title="$1" msg="$2"
  [ -n "$SLACK_BOT_TOKEN" ] || return 0
  local payload
  payload=$(printf '{"channel":"%s","text":"%s\n%s"}' "$SLACK_CHANNEL" "$title" "${msg//\"/\\\"}")
  curl -fsSm 10 -X POST https://slack.com/api/chat.postMessage \
       -H "Authorization: Bearer $SLACK_BOT_TOKEN" -H "Content-Type: application/json; charset=utf-8" \
       -d "$payload" >/dev/null 2>&1 || true
}

notify_email() {
  local subject="$1" body="$2"
  [ -n "$RESEND_API_KEY" ] || return 0
  local payload
  payload=$(python3 -c "import json,sys;print(json.dumps({'from':'safedeploy-watchdog@cloudless.gr','to':sys.argv[1],'subject':sys.argv[2],'text':sys.argv[3]}))" "$ALERT_EMAIL" "$subject" "$body")
  curl -fsSm 10 -X POST https://api.resend.com/emails \
       -H "Authorization: Bearer $RESEND_API_KEY" -H "Content-Type: application/json" \
       -d "$payload" >/dev/null 2>&1 || true
}

notify_all() {
  local title="$1" body="$2" prio="${3:-high}"
  notify_ntfy  "$title" "$body" "$prio"
  notify_slack "$title" "$body"
  notify_email "$title" "$body"
}

# --- health probe ------------------------------------------------------------
# Returns 0 healthy, 1 unhealthy. Also captures whether it's a 502 (strong
# signal — origin unreachable) vs a health-endpoint issue.
probe_health() {
  # Try local NodePort first (fastest, most direct)
  local resp code
  for url in "$HEALTH_URL_LOCAL" "$HEALTH_URL_LAN"; do
    code=$(curl -sS -o /tmp/sdw-body -w '%{http_code}' --max-time 8 "$url" 2>/dev/null || echo "000")
    if [ "$code" = "200" ] && grep -q '"status"' /tmp/sdw-body 2>/dev/null; then
      _set last_http_code "$code"
      return 0
    fi
  done
  # Fall back to public URL (catches tunnel/cloudflare-level breakage too)
  code=$(curl -sS -o /tmp/sdw-body -w '%{http_code}' --max-time 12 "$HEALTH_URL_PUBLIC" 2>/dev/null || echo "000")
  _set last_http_code "$code"
  [ "$code" = "200" ] && return 0 || return 1
}

# --- rollback (adapted from scripts/rollback.sh, LOCAL to omv) --------------
do_rollback() {
  local cur prev
  cur=$(readlink "$CURRENT" 2>/dev/null | sed 's|^cloudless-releases/||')
  prev=$(ls -1t "$RELEASES" 2>/dev/null | grep -v "^${cur}$" | head -1)
  if [ -z "$prev" ]; then
    log "ROLLBACK aborted: no previous release available"
    return 1
  fi
  log "ROLLBACK: flipping $cur → $prev"
  ln -sfn "cloudless-releases/$prev" "$CURRENT"
  chown -h tbaltzakis:users "$CURRENT"
  k3s kubectl -n "$NS" rollout restart "deploy/$DEPLOY" >/dev/null 2>&1
  k3s kubectl -n "$NS" rollout status "deploy/$DEPLOY" --timeout=180s >/dev/null 2>&1
  _set last_rollback_ts "$(_now)"
  log "ROLLBACK done, now on $prev (was $cur)"
  _set rollback_from "$cur"
  _set rollback_to   "$prev"
  return 0
}

# --- main tick ---------------------------------------------------------------
main() {
  local fail_count now
  fail_count=$(_get fail_count 0)
  now=$(_now)

  if probe_health; then
    # HEALTHY
    if [ "$fail_count" -gt 0 ] || [ "$(_get notified 0)" = "1" ]; then
      # was unhealthy, now recovered → notify + reset
      local incident_start; incident_start=$(_get incident_start "$now")
      local duration_min=$(( (now - incident_start) / 60 ))
      local rf; rf=$(_get rollback_from ""); local rt; rt=$(_get rollback_to "")
      local body="Site recovered after ~${duration_min} min unhealthy."
      [ -n "$rt" ] && body+=$'\n'"Auto-rollback fired: $rf → $rt"
      log "RECOVERED after ${duration_min}min (was fail_count=$fail_count)"
      notify_all "✅ cloudless.gr recovered" "$body" low
    fi
    _set fail_count 0; _set notified 0; _set rollback_from ""; _set rollback_to ""; _set incident_start ""
    return 0
  fi

  # UNHEALTHY — increment counter
  fail_count=$((fail_count+1))
  _set fail_count "$fail_count"
  [ "$fail_count" = "1" ] && _set incident_start "$now"
  local code; code=$(_get last_http_code "?")
  log "UNHEALTHY tick=$fail_count http=$code"

  # First alert at NOTIFY_THRESHOLD (only once per incident)
  if [ "$fail_count" -ge "$NOTIFY_THRESHOLD" ] && [ "$(_get notified 0)" = "0" ]; then
    local body="cloudless.gr health check has failed ${fail_count} times in a row (~$((fail_count*2)) min). Last HTTP=${code}."$'\n\n'"Rollback candidate: run 'scripts/rollback.sh previous' from a workstation.\n\nAuto-rollback will fire after ${ROLLBACK_THRESHOLD} consecutive failures (~$((ROLLBACK_THRESHOLD*2)) min total) if still unhealthy."
    log "NOTIFY sent (threshold=$NOTIFY_THRESHOLD reached)"
    notify_all "⚠️ cloudless.gr unhealthy" "$body" high
    _set notified 1
  fi

  # Auto-rollback at ROLLBACK_THRESHOLD (with safeguards)
  if [ "$fail_count" -ge "$ROLLBACK_THRESHOLD" ]; then
    # Safeguard 1: cooldown since last auto-rollback
    local last_rb; last_rb=$(_get last_rollback_ts 0)
    if [ "$last_rb" != "0" ] && [ $((now - last_rb)) -lt "$ROLLBACK_COOLDOWN" ]; then
      log "SKIP rollback: cooldown ($(( (ROLLBACK_COOLDOWN - (now - last_rb))/60 )) min remaining)"
      return 0
    fi
    # Safeguard 2: don't rollback a release younger than MIN_RELEASE_AGE
    local link_age
    link_age=$(( now - $(stat -c %Y "$CURRENT" 2>/dev/null || echo "$now") ))
    if [ "$link_age" -lt "$MIN_RELEASE_AGE" ]; then
      log "SKIP rollback: current release age=${link_age}s < ${MIN_RELEASE_AGE}s (deploy-time rollback likely already fired)"
      return 0
    fi
    if do_rollback; then
      local rf; rf=$(_get rollback_from "?"); local rt; rt=$(_get rollback_to "?")
      notify_all "🔁 cloudless.gr auto-rolled-back" "Auto-flipped $rf → $rt after $fail_count consecutive failures. Verifying…" high
    else
      notify_all "🚨 cloudless.gr rollback FAILED" "Wanted to auto-rollback but couldn't (no previous release?). Manual intervention needed." urgent
    fi
  fi
}

main "$@"
