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
# Extended coverage (added 2026-09-25):
#   • satellite HTTP probes   — social/webmail/postiz/espocrm/grafana/n8n/
#                               pi-origin/postiz-ai-proxy (alert-only; optional
#                               `k3s:<ns>:<deploy>` remediation via rollout restart)
#   • worker-error watcher    — Cloudflare GraphQL workersInvocationsAdaptive
#                               per-script errors >= WORKER_ERROR_THRESHOLD;
#                               alert embeds the exception text from Workers
#                               Observability, and allowlisted scripts
#                               auto-rollback to the previous deployment
#                               when errors persist on a fresh deploy
#   • infra checks            — k3s node NotReady, k3s SSD >85%, data SSD >90%
#   • deadman ping            — optional healthchecks.io URL pinged each tick so
#                               a dead watchdog/omv host still alerts externally
#
set -euo pipefail

# --- config ------------------------------------------------------------------
STATE_DIR=/var/lib/safedeploy-watchdog
CURRENT=/home/tbaltzakis/cloudless-standalone
RELEASES=/home/tbaltzakis/cloudless-releases
NS=cloudless
DEPLOY=cloudless-app
HEALTH_URL_LOCAL="${HEALTH_URL_LOCAL:-http://127.0.0.1:30300/api/health}"
HEALTH_URL_LAN="${HEALTH_URL_LAN:-http://192.168.1.128:30300/api/health}"
HEALTH_URL_PUBLIC="${HEALTH_URL_PUBLIC:-https://cloudless.gr/api/health}"
NOTIFY_THRESHOLD=3        # consecutive failures to send first alert
ROLLBACK_THRESHOLD=8      # consecutive failures to auto-rollback
ROLLBACK_COOLDOWN=3600    # min seconds between auto-rollbacks
MIN_RELEASE_AGE=900       # skip rollback if symlink younger than this (seconds)

# Satellite probes: "name|url|expect|remediation"
#   expect      = "ok" (any 2xx/3xx — Cloudflare Access 302 counts as up)
#                 or an exact status like "200"
#   remediation = "none" (alert only) or "k3s:<ns>:<deploy>" → rollout restart
#                 at ROLLBACK_THRESHOLD consecutive failures
# k3s deploy names verified against infrastructure/*/k8s manifests.
# External coverage note: selfhosted-healthchecks.yml already pings
# healthchecks.io per app every 5min from CI runners — these probes add
# omv-side detection (works when CI/GitHub is down) + remediation.
WATCH_TARGETS=(
  "pi-origin|https://pi-origin.cloudless.gr/api/health|200|none"
  "social|https://social.cloudless.gr/|ok|none"
  "postiz|https://postiz.cloudless.gr/|ok|k3s:postiz:postiz"
  "espocrm|https://espocrm.cloudless.gr/|ok|k3s:espocrm:espocrm"
  "n8n|https://n8n.cloudless.gr/healthz|200|k3s:n8n:n8n"
  "grafana|https://grafana.cloudless.gr/api/health|200|k3s:monitoring:kube-prom-grafana"
  "appflowy|https://appflowy.cloudless.gr/api/health|200|k3s:appflowy:appflowy-cloud"
  "ntfy|https://ntfy.cloudless.gr/|ok|k3s:ntfy:ntfy"
  "uptime-kuma|https://kuma.cloudless.gr/|ok|k3s:uptime-kuma:uptime-kuma"
  "webmail|https://webmail.cloudless.gr/|ok|none"
  "postiz-ai-proxy|https://postiz-ai-proxy.baltzakis-themis.workers.dev/v1/models|200|none"
)
WORKER_ERROR_THRESHOLD=3    # per-script errors in the window below → alert
WORKER_ERROR_WINDOW_MIN=30  # GraphQL lookback window
WORKER_CHECK_EVERY=5        # run the GraphQL check every Nth tick (~10 min)
# Worker auto-rollback (mirrors the app rollback safeguards):
# only scripts in the allowlist, only while errors stay >= threshold for
# WORKER_ROLLBACK_AFTER consecutive checks, and only when the current
# deployment is fresh (deploy-age between MIN and MAX) — older deploys'
# errors aren't deploy-correlated, so those stay alert-only.
WORKER_ROLLBACK_SCRIPTS="postiz-ai-proxy"
WORKER_ROLLBACK_AFTER=2     # consecutive error checks before rollback
WORKER_ROLLBACK_MIN_AGE=900 # skip rollback for deploys <15min old (verify window)
WORKER_ROLLBACK_MAX_AGE=7200 # skip rollback for deploys >2h old (not deploy-correlated)
DISK_K3S_PCT=85             # alert when the k3s SSD (sda1) exceeds this
DISK_DATA_PCT=90            # alert when the data SSD (sdb1) exceeds this

# --- credentials (from env file, never printed) ------------------------------
# shellcheck disable=SC1091
[ -f /etc/safedeploy-watchdog.env ] && . /etc/safedeploy-watchdog.env
: "${NTFY_BASE_URL:=}" "${NTFY_TOPIC:=}" "${NTFY_TOKEN:=}"
: "${SLACK_BOT_TOKEN:=}" "${SLACK_CHANNEL:=#general}"
: "${RESEND_API_KEY:=}" "${ALERT_EMAIL:=tbaltzakis@cloudless.gr}"
: "${CF_API_TOKEN:=}" "${CF_ACCOUNT_ID:=}" "${HEALTHCHECK_PING_URL:=}"

# --- state helpers -----------------------------------------------------------
mkdir -p "$STATE_DIR"
_get() { local v; v=$(cat "$STATE_DIR/$1" 2>/dev/null); [ -n "$v" ] && printf '%s' "$v" || printf '%s' "$2"; }
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

# --- satellite HTTP probes ---------------------------------------------------
# One probe per WATCH_TARGETS entry. Per-target consecutive-fail state lives in
# fail_count_<name> / notified_<name>. Remediation "k3s:<ns>:<deploy>" restarts
# the deployment at ROLLBACK_THRESHOLD; "none" is alert-only.
check_targets() {
  local entry name url expect remed code fc prev now
  now=$(_now)
  for entry in "${WATCH_TARGETS[@]}"; do
    IFS='|' read -r name url expect remed <<<"$entry"
    code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 -L "$url" 2>/dev/null); code=${code:-000}
    local ok=0
    if [ "$expect" = "ok" ]; then
      [[ "$code" =~ ^[23] ]] && ok=1
    else
      [ "$code" = "$expect" ] && ok=1
    fi

    fc=$(_get "fail_count_$name" 0)
    if [ "$ok" = "1" ]; then
      if [ "$fc" -gt 0 ] || [ "$(_get "notified_$name" 0)" = "1" ]; then
        log "TARGET RECOVERED: $name (was fail_count=$fc)"
        notify_all "✅ $name recovered" "$url healthy again after ~$((fc*2)) min." low
      fi
      _set "fail_count_$name" 0; _set "notified_$name" 0
      continue
    fi

    fc=$((fc+1)); _set "fail_count_$name" "$fc"
    log "TARGET UNHEALTHY: $name http=$code tick=$fc"
    if [ "$fc" -ge "$NOTIFY_THRESHOLD" ] && [ "$(_get "notified_$name" 0)" = "0" ]; then
      notify_all "⚠️ $name unhealthy" "$url failing ~$((fc*2)) min. Last HTTP=$code." high
      _set "notified_$name" 1
    fi
    if [ "$fc" -ge "$ROLLBACK_THRESHOLD" ] && [[ "$remed" == k3s:* ]]; then
      local ns dep; IFS=':' read -r _ ns dep <<<"$remed"
      prev=$(_get "remed_ts_$name" 0)
      if [ $((now - prev)) -ge "$ROLLBACK_COOLDOWN" ]; then
        log "REMEDIATION: k3s rollout restart $ns/$dep for $name"
        if k3s kubectl -n "$ns" rollout restart "deploy/$dep" >/dev/null 2>&1; then
          _set "remed_ts_$name" "$now"
          notify_all "🔁 $name restarted" "k3s rollout restart deploy/$dep in ns $ns after $fc consecutive failures." high
        else
          notify_all "🚨 $name remediation failed" "rollout restart deploy/$dep in ns $ns failed. Manual check needed." urgent
        fi
      fi
    fi
  done
}

# --- worker error watcher ----------------------------------------------------
# Cloudflare GraphQL workersInvocationsAdaptive — count invocation exceptions
# across all scripts in the last WORKER_ERROR_WINDOW_MIN. A script only counts
# toward an alert when its errors reach WORKER_ERROR_THRESHOLD — single
# stream-abort blips (clientDisconnected mid-SSE, upstream abort) show up as
# scriptThrewException=1 and are noise, not incidents.
#
# When an alert fires the watchdog auto-fetches the exception text from
# Workers Observability (workers/observability/telemetry/query) and embeds it
# in the notification — no manual `wrangler tail` step. Requires Workers Logs
# enabled on the script (wrangler `observability.enabled = true`); degrades
# to the plain count when logs aren't collected yet.
#
# Auto-rollback: scripts in WORKER_ROLLBACK_SCRIPTS that keep exceeding the
# threshold for WORKER_ROLLBACK_AFTER consecutive checks get rolled back to
# the previous deployment's version — but only when the current deployment
# is fresh (errors on a fresh deploy are deploy-correlated). Same cooldown
# and "don't thrash a just-deployed version" safeguards as the app rollback.
check_worker_errors() {
  [ -n "$CF_API_TOKEN" ] && [ -n "$CF_ACCOUNT_ID" ] || return 0
  local tick; tick=$(( $(_get tick_count 0) + 1 )); _set tick_count "$tick"
  [ $((tick % WORKER_CHECK_EVERY)) -eq 0 ] || return 0

  local since now_iso resp err_json
  since=$(date -u -d "-${WORKER_ERROR_WINDOW_MIN} min" +%Y-%m-%dT%H:%M:%SZ)
  now_iso=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  resp=$(curl -fsSm 15 -X POST https://api.cloudflare.com/client/v4/graphql \
    -H "Authorization: Bearer $CF_API_TOKEN" -H 'Content-Type: application/json' \
    -d "{\"query\":\"query(\$a:String!,\$s:Time!,\$e:Time!){viewer{accounts(filter:{accountTag:\$a}){workersInvocationsAdaptive(limit:200,filter:{datetime_geq:\$s,datetime_leq:\$e}){sum{errors}dimensions{scriptName}}}}}\",\"variables\":{\"a\":\"$CF_ACCOUNT_ID\",\"s\":\"$since\",\"e\":\"$now_iso\"}}" 2>/dev/null) || return 0

  # Per-script error counts → "script=count" lines, split into over-threshold
  # (actionable) and under-threshold (logged for context only).
  err_json=$(printf '%s' "$resp" | python3 -c "
import json,sys
try:
  rows=json.load(sys.stdin)['data']['viewer']['accounts'][0]['workersInvocationsAdaptive']
except Exception:
  sys.exit(0)
for r in rows:
    s=r['dimensions']['scriptName']; e=r['sum']['errors']
    if e: print(f'{s} {e}')" 2>/dev/null)

  local over="" under="" name count
  while read -r name count; do
    [ -n "$name" ] || continue
    if [ "$count" -ge "$WORKER_ERROR_THRESHOLD" ]; then over+="$name=$count "; else under+="$name=$count "; fi
  done <<<"$err_json"

  # Per-script sustained-error counters → drive auto-rollback eligibility.
  # Counters only accumulate on CONSECUTIVE over-threshold windows: a script
  # absent from err_json this window gets its counter reset too.
  local sustained name count wl
  for wl in $WORKER_ROLLBACK_SCRIPTS; do
    case "$err_json" in *"$wl "*) ;; *) _set "werr_count_$wl" 0 ;; esac
  done
  while read -r name count; do
    [ -n "$name" ] || continue
    if [ "$count" -ge "$WORKER_ERROR_THRESHOLD" ]; then
      sustained=$(( $(_get "werr_count_$name" 0) + 1 )); _set "werr_count_$name" "$sustained"
      case " $WORKER_ROLLBACK_SCRIPTS " in
        *" $name "*) [ "$sustained" -ge "$WORKER_ROLLBACK_AFTER" ] && worker_auto_rollback "$name" ;;
      esac
    else
      _set "werr_count_$name" 0
    fi
  done <<<"$err_json"

  local prev; prev=$(_get worker_alert_active 0)
  if [ -n "$over" ]; then
    if [ "$prev" = "0" ]; then
      log "WORKER ERRORS over threshold: $over (below: ${under:-none})"
      local details; details=$(worker_error_details "$over")
      local body="Cloudflare worker errors in last ${WORKER_ERROR_WINDOW_MIN}min (≥${WORKER_ERROR_THRESHOLD}): $over"
      [ -n "$under" ] && body+=$'\n'"Below threshold: $under"
      [ -n "$details" ] && body+=$'\n\n'"Latest exceptions:"$'\n'"$details"
      [ -z "$details" ] && body+=$'\n'"Check wrangler tail / recent deploys."
      notify_all "⚠️ worker exceptions" "$body" high
      _set worker_alert_active 1
    fi
  elif [ "$prev" = "1" ]; then
    log "WORKER ERRORS cleared"
    notify_all "✅ worker errors cleared" "No worker exceptions ≥${WORKER_ERROR_THRESHOLD} in the last ${WORKER_ERROR_WINDOW_MIN}min.${under:+ Under threshold: $under}" low
    _set worker_alert_active 0
  fi
}

# Fetch the most recent exception texts for the errored scripts via Workers
# Observability (workers/observability/telemetry/query, view=events).
# Arg: space-separated "script=N" tokens. Queries per script with an `eq`
# filter (the telemetry filter grammar doesn't document `in`), merges
# results, prints up to 3 "script: message" lines; empty when Workers Logs
# isn't enabled or no events match.
worker_error_details() {
  local since_ms now_ms; now_ms=$(( $(date +%s) * 1000 )); since_ms=$(( now_ms - WORKER_ERROR_WINDOW_MIN * 60000 ))
  local tok script
  for tok in $1; do
    script="${tok%%=*}"
    curl -fsSm 15 -X POST "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/workers/observability/telemetry/query" \
      -H "Authorization: Bearer $CF_API_TOKEN" -H 'Content-Type: application/json' \
      -d "{\"queryId\":\"adhoc\",\"timeframe\":{\"from\":$since_ms,\"to\":$now_ms},\"view\":\"events\",\"parameters\":{\"filters\":[{\"key\":\"\$metadata.service\",\"operation\":\"eq\",\"type\":\"string\",\"value\":\"$script\"}],\"limit\":20}}" 2>/dev/null
    echo ""
  done | python3 -c "
import json,sys
evs=[]
for line in sys.stdin:
    line=line.strip()
    if not line: continue
    try:
        evs += (json.loads(line).get('result',{}).get('events',{}) or {}).get('events',[]) or []
    except Exception:
        continue
out=[]
for e in evs:
    w=e.get('\$workers') or e.get('\$cloudflare',{}).get('\$workers') or {}
    outcome=w.get('outcome','')
    excs=e.get('exceptions') or w.get('exceptions') or []
    if outcome=='success' and not excs:
        continue
    msg=''
    if excs and isinstance(excs,list):
        msg=str(excs[0].get('message') or excs[0].get('name') or '')
    if not msg:
        logs=e.get('logs') or []
        for l in reversed(logs):
            if l.get('level') in ('error','fatal'):
                msg=str(l.get('message') or ''); break
    if not msg: msg=str(w.get('eventMessage') or outcome or 'exception')
    script=w.get('scriptName') or e.get('\$metadata',{}).get('service') or '?'
    out.append(f'{script}: {msg[:160]}')
    if len(out)>=3: break
print('\n'.join(out))" 2>/dev/null
}

# Roll an allowlisted worker back to the previous deployment's version.
# Guards mirror do_rollback: cooldown, no <15min deploys, no >2h deploys,
# need >=2 deployments. Posts its own alert on success/failure.
worker_auto_rollback() {
  local script="$1" now; now=$(_now)
  local last; last=$(_get "worker_rb_ts_$script" 0)
  if [ "$last" != "0" ] && [ $((now - last)) -lt "$ROLLBACK_COOLDOWN" ]; then
    log "SKIP worker rollback $script: cooldown ($(( (ROLLBACK_COOLDOWN - (now - last))/60 ))min left)"
    return 0
  fi

  local api="https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/workers/scripts/$script"
  local deploys
  deploys=$(curl -fsSm 15 "$api/deployments" -H "Authorization: Bearer $CF_API_TOKEN" 2>/dev/null) || return 0

  local prev_vid cur_age
  read -r prev_vid cur_age <<<"$(printf '%s' "$deploys" | python3 -c "
import json,sys,datetime
ds=(json.load(sys.stdin).get('result') or {}).get('deployments') or []
ds=[d for d in ds if d.get('versions') and d['versions'][0].get('percentage')==100]
ds.sort(key=lambda d:d.get('created_on',''), reverse=True)
if len(ds)<2: sys.exit(0)
def age(d):
    ts=d['created_on'].replace('Z','+00:00')
    return int(datetime.datetime.now(datetime.timezone.utc).timestamp()-datetime.datetime.fromisoformat(ts).timestamp())
print(ds[1]['versions'][0]['version_id'], age(ds[0]))" 2>/dev/null)"
  [ -n "$prev_vid" ] || { log "SKIP worker rollback $script: <2 deployments"; return 0; }

  if [ "${cur_age:-0}" -lt "$WORKER_ROLLBACK_MIN_AGE" ]; then
    log "SKIP worker rollback $script: current deploy age=${cur_age}s < ${WORKER_ROLLBACK_MIN_AGE}s"
    return 0
  fi
  if [ "${cur_age:-0}" -gt "$WORKER_ROLLBACK_MAX_AGE" ]; then
    log "SKIP worker rollback $script: deploy age=${cur_age}s > ${WORKER_ROLLBACK_MAX_AGE}s — errors not deploy-correlated"
    return 0
  fi

  log "WORKER ROLLBACK: $script → version $prev_vid (deploy age ${cur_age}s)"
  local out
  out=$(curl -fsSm 15 -X POST "$api/deployments" \
    -H "Authorization: Bearer $CF_API_TOKEN" -H 'Content-Type: application/json' \
    -d "{\"strategy\":\"percentage\",\"versions\":[{\"version_id\":\"$prev_vid\",\"percentage\":100}],\"annotations\":{\"workers/message\":\"safedeploy-watchdog auto-rollback after sustained errors\"}}" 2>&1)
  if [ $? -eq 0 ]; then
    _set "worker_rb_ts_$script" "$now"; _set "werr_count_$script" 0
    notify_all "🔁 $script auto-rolled-back" "Pinned previous version ${prev_vid:0:8} after ≥${WORKER_ROLLBACK_AFTER} checks ≥${WORKER_ERROR_THRESHOLD} errors/${WORKER_ERROR_WINDOW_MIN}min." high
  else
    notify_all "🚨 $script rollback FAILED" "Auto-rollback to ${prev_vid:0:8} failed: ${out:0:200}" urgent
  fi
}

# --- infra checks -------------------------------------------------------------
# k3s node NotReady + the two SSD thresholds from CLAUDE.md's storage rules.
check_infra() {
  local notready
  notready=$(k3s kubectl get nodes --no-headers 2>/dev/null | awk '$2!="Ready"{print $1}' | paste -sd, -)
  if [ -n "$notready" ]; then
    if [ "$(_get infra_node_alert 0)" = "0" ]; then
      log "INFRA: node(s) NotReady: $notready"
      notify_all "🚨 k3s node NotReady" "Node(s) not Ready: $notready" urgent
      _set infra_node_alert 1
    fi
  elif [ "$(_get infra_node_alert 0)" = "1" ]; then
    _set infra_node_alert 0
    notify_all "✅ k3s nodes Ready" "All nodes back to Ready." low
  fi

  local dev thresh tag pct
  for spec in "/var/lib/rancher/k3s:$DISK_K3S_PCT:k3s-ssd" "/srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7:$DISK_DATA_PCT:data-ssd"; do
    IFS=':' read -r dev thresh tag <<<"$spec"
    pct=$(df --output=pcent "$dev" 2>/dev/null | tail -1 | tr -dc '0-9')
    [ -n "$pct" ] || continue
    if [ "$pct" -ge "$thresh" ]; then
      if [ "$(_get "infra_disk_$tag" 0)" = "0" ]; then
        log "INFRA: $tag at ${pct}% (threshold ${thresh}%)"
        notify_all "⚠️ disk pressure: $tag" "$dev at ${pct}% (alert at ${thresh}%). For k3s-ssd: crictl rmi --prune first." high
        _set "infra_disk_$tag" 1
      fi
    elif [ "$(_get "infra_disk_$tag" 0)" = "1" ] && [ "$pct" -lt $((thresh-5)) ]; then
      _set "infra_disk_$tag" 0
      notify_all "✅ disk recovered: $tag" "$dev back to ${pct}%." low
    fi
  done
}

# --- deadman ping --------------------------------------------------------------
# If HEALTHCHECK_PING_URL is set (healthchecks.io or compatible), ping it every
# tick — the external service alerts when pings stop (watchdog/omv dead).
deadman_ping() {
  [ -n "$HEALTHCHECK_PING_URL" ] || return 0
  curl -fsSm 8 "$HEALTHCHECK_PING_URL" >/dev/null 2>&1 || true
}

# --- main tick ---------------------------------------------------------------
main() {
  local fail_count now
  fail_count=$(_get fail_count 0)
  now=$(_now)

  # Extended checks run every tick regardless of main-site state (the main
  # path below has early returns that must not starve them).
  check_targets
  check_worker_errors
  check_infra
  deadman_ping

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
