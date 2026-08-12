#!/usr/bin/env bash
# pi-release-pull.sh — load-guarded pull of Next standalone from R2.
#
# Reads desired.json via the orchestrator Worker (or R2 S3 API), downloads the
# tarball when load is low, promotes hostPath symlink, restarts cloudless-app.
#
# Env file: /etc/cloudless/pi-release-pull.env (mode 600)
#   DEPLOY_ORCHESTRATOR_URL   e.g. https://pi-deploy-orchestrator.<acct>.workers.dev
#   DEPLOY_ORCHESTRATOR_TOKEN
#   LOAD1_MAX                 default 6
#   IOWAIT_MAX_PCT            default 40 (0 disables iowait check)
# Optional S3 fallback (only if orchestrator /artifact is unavailable):
#   CF_ACCOUNT_ID CF_R2_ACCESS_KEY_ID CF_R2_SECRET_ACCESS_KEY R2_BUCKET
#
# Tracking: every line is key=value; also POST /agent-event when URL is set.
set -euo pipefail

ENV_FILE="${ENV_FILE:-/etc/cloudless/pi-release-pull.env}"
# shellcheck disable=SC1090
[[ -f "$ENV_FILE" ]] && . "$ENV_FILE"

LOG_TAG="pi-release-pull"
STANDALONE="${STANDALONE_HOSTPATH:-/home/tbaltzakis/cloudless-standalone}"
RELEASES="$(dirname "$STANDALONE")/cloudless-releases"
OWNER="${OMV_OWNER:-tbaltzakis}"
NS="${K3S_NAMESPACE:-cloudless}"
DEP="${K3S_DEPLOYMENT:-cloudless-app}"
BUCKET="${R2_BUCKET:-cloudless-pi-releases}"
LOAD1_MAX="${LOAD1_MAX:-6}"
IOWAIT_MAX_PCT="${IOWAIT_MAX_PCT:-40}"
ENDPOINT="${R2_ENDPOINT:-https://${CF_ACCOUNT_ID:-}.r2.cloudflarestorage.com}"

log() {
  local msg="$*"
  echo "[$LOG_TAG] $msg"
  logger -t "$LOG_TAG" "$msg" 2>/dev/null || true
}

track() {
  # track key=val key=val ...
  local line="ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  local kv
  for kv in "$@"; do
    line="$line $kv"
  done
  log "$line"
  if [[ -n "${DEPLOY_ORCHESTRATOR_URL:-}" && -n "${DEPLOY_ORCHESTRATOR_TOKEN:-}" ]] && command -v jq >/dev/null 2>&1; then
    local json="{}"
    for kv in "$@"; do
      json="$(jq -cn --argjson o "$json" --arg k "${kv%%=*}" --arg v "${kv#*=}" '$o + {($k):$v}')"
    done
    curl -fsS --max-time 8 \
      -H "Authorization: Bearer ${DEPLOY_ORCHESTRATOR_TOKEN}" \
      -H "content-type: application/json" \
      -d "$json" \
      "${DEPLOY_ORCHESTRATOR_URL%/}/agent-event" >/dev/null 2>&1 || true
  fi
}

need() {
  local k="$1"
  [[ -n "${!k:-}" ]] || { log "missing env $k"; exit 1; }
}

need DEPLOY_ORCHESTRATOR_URL
need DEPLOY_ORCHESTRATOR_TOKEN

load1="$(cut -d' ' -f1 /proc/loadavg)"
iowait_pct="0"
if [[ "$IOWAIT_MAX_PCT" != "0" ]] && command -v mpstat >/dev/null 2>&1; then
  iowait_pct="$(mpstat 1 1 | awk '/Average:/ && $NF ~ /[0-9]/ {print $(NF-1); exit}')"
  iowait_pct="${iowait_pct%.*}"
  iowait_pct="${iowait_pct:-0}"
fi

# Compare floats via awk
load_high="$(awk -v l="$load1" -v m="$LOAD1_MAX" 'BEGIN{print (l+0 > m+0) ? 1 : 0}')"
io_high="$(awk -v i="$iowait_pct" -v m="$IOWAIT_MAX_PCT" 'BEGIN{print (m+0>0 && i+0 > m+0) ? 1 : 0}')"

DESIRED_HTTP="$(curl -sS -o /tmp/pi-desired.json -w '%{http_code}' --max-time 15 \
  -H "Authorization: Bearer ${DEPLOY_ORCHESTRATOR_TOKEN}" \
  "${DEPLOY_ORCHESTRATOR_URL%/}/desired" || true)"
if [[ "$DESIRED_HTTP" == "404" ]]; then
  track event=noop_no_desired
  exit 0
fi
if [[ "$DESIRED_HTTP" != "200" ]]; then
  track event=error reason=desired_http http="$DESIRED_HTTP"
  exit 1
fi
DESIRED_JSON="$(cat /tmp/pi-desired.json)"
rm -f /tmp/pi-desired.json

SHA="$(printf '%s' "$DESIRED_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('sha',''))")"
ARTIFACT_KEY="$(printf '%s' "$DESIRED_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('artifactKey',''))")"
WF_ID="$(printf '%s' "$DESIRED_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('workflowInstanceId') or '')")"
SHA12="${SHA:0:12}"

[[ -n "$SHA" && -n "$ARTIFACT_KEY" ]] || {
  track event=error reason=bad_desired
  exit 1
}

CURRENT="$(readlink "$STANDALONE" 2>/dev/null | sed 's|.*/||' || true)"
if [[ "$CURRENT" == "$SHA12" ]]; then
  track event=noop_already_live sha12="$SHA12" workflowInstanceId="$WF_ID"
  exit 0
fi

if [[ "$load_high" == "1" || "$io_high" == "1" ]]; then
  track event=skip_load_high sha12="$SHA12" load1="$load1" iowait_pct="$iowait_pct" want="$SHA12" current="${CURRENT:-none}" workflowInstanceId="$WF_ID"
  exit 0
fi

track event=pull_start sha12="$SHA12" artifactKey="$ARTIFACT_KEY" workflowInstanceId="$WF_ID" githubRunId="$(printf '%s' "$DESIRED_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('githubRunId') or '')")"

TMP="/tmp/cloudless-pull-${SHA12}"
TAR="$TMP/release.tar.zst"
rm -rf "$TMP"
mkdir -p "$TMP"

# Prefer authenticated orchestrator download (no R2 keys on omv).
if curl -fsS --max-time 600 \
  -H "Authorization: Bearer ${DEPLOY_ORCHESTRATOR_TOKEN}" \
  -o "$TAR" \
  "${DEPLOY_ORCHESTRATOR_URL%/}/artifact?key=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe='/'))" "$ARTIFACT_KEY")"; then
  track event=download_via_orchestrator sha12="$SHA12" artifactKey="$ARTIFACT_KEY"
elif [[ -n "${CF_R2_ACCESS_KEY_ID:-}" && -n "${CF_R2_SECRET_ACCESS_KEY:-}" && -n "${CF_ACCOUNT_ID:-}" ]]; then
  if ! command -v aws >/dev/null 2>&1; then
    track event=error reason=aws_cli_missing sha12="$SHA12"
    exit 1
  fi
  export AWS_ACCESS_KEY_ID="$CF_R2_ACCESS_KEY_ID"
  export AWS_SECRET_ACCESS_KEY="$CF_R2_SECRET_ACCESS_KEY"
  export AWS_DEFAULT_REGION="auto"
  nice -n 10 ionice -c2 -n7 aws s3 cp \
    "s3://${BUCKET}/${ARTIFACT_KEY}" "$TAR" \
    --endpoint-url "$ENDPOINT"
  track event=download_via_r2_s3 sha12="$SHA12" artifactKey="$ARTIFACT_KEY"
else
  track event=error reason=download_failed sha12="$SHA12" artifactKey="$ARTIFACT_KEY"
  exit 1
fi

NEW_REL="$RELEASES/$SHA12"
PREV="$(readlink "$STANDALONE" 2>/dev/null || true)"

sudo mkdir -p "$RELEASES"
sudo rm -rf "$NEW_REL"
sudo mkdir -p "$NEW_REL"
# Unpack with low priority onto SSD-backed home
nice -n 10 ionice -c2 -n7 sudo tar --zstd -xf "$TAR" -C "$NEW_REL"

# Tarball layout: top-level standalone/ static/ public/ BUILD_ID (from pack OUT)
if [[ -d "$NEW_REL/standalone" ]]; then
  # Flatten: move standalone contents up
  # dash has no shopt — must use bash for dotglob flatten
  sudo bash -c "shopt -s dotglob && mv '$NEW_REL'/standalone/* '$NEW_REL'/ && rmdir '$NEW_REL'/standalone"
fi
if [[ -d "$NEW_REL/static" ]]; then
  sudo mkdir -p "$NEW_REL/.next/static"
  sudo rsync -a "$NEW_REL/static/" "$NEW_REL/.next/static/"
  sudo rm -rf "$NEW_REL/static"
fi
if [[ -f "$NEW_REL/BUILD_ID" && ! -s "$NEW_REL/.next/BUILD_ID" ]]; then
  sudo mkdir -p "$NEW_REL/.next"
  sudo cp -a "$NEW_REL/BUILD_ID" "$NEW_REL/.next/BUILD_ID"
fi

if [[ ! -s "$NEW_REL/.next/BUILD_ID" || ! -f "$NEW_REL/server.js" ]]; then
  track event=error reason=missing_build_id_or_server sha12="$SHA12"
  sudo rm -rf "$NEW_REL"
  rm -rf "$TMP"
  exit 1
fi

NEXT_FILES="$(find "$NEW_REL/.next" -type f | wc -l)"
if [[ "$NEXT_FILES" -lt 10 ]]; then
  track event=error reason=empty_next sha12="$SHA12" next_files="$NEXT_FILES"
  sudo rm -rf "$NEW_REL"
  rm -rf "$TMP"
  exit 1
fi

sudo chmod -R a+rX "$NEW_REL"
sudo ln -sfn "cloudless-releases/$SHA12" "$STANDALONE"
sudo chown -h "$OWNER:users" "$STANDALONE"

KUBECTL="sudo k3s kubectl"
$KUBECTL set env "deployment/${DEP}" -n "$NS" \
  "APP_VERSION=${SHA}" \
  "NEXT_PUBLIC_APP_VERSION=${SHA}" \
  "NEXT_PUBLIC_AUTH_PROVIDER=d1" \
  "SSM_DISABLED=1"
$KUBECTL rollout restart "deployment/${DEP}" -n "$NS"
$KUBECTL rollout status "deployment/${DEP}" -n "$NS" --timeout=300s

HEALTH_OK=0
for _ in 1 2 3 4 5 6 7 8; do
  BODY="$(curl -sS --max-time 8 http://127.0.0.1:30300/api/health 2>/dev/null || true)"
  if echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); v=str(d.get('version','')); sys.exit(0 if d.get('status')=='ok' and (v.startswith('$SHA12') or v=='$SHA') else 1)" 2>/dev/null; then
    HEALTH_OK=1
    break
  fi
  sleep 5
done

rm -rf "$TMP"

if [[ "$HEALTH_OK" == "1" ]]; then
  track event=promote_ok sha12="$SHA12" workflowInstanceId="$WF_ID" next_files="$NEXT_FILES"
  # prune old releases (keep 5)
  cd "$RELEASES"
  ls -1t | tail -n +6 | while read -r old; do
    [[ "cloudless-releases/$old" == "$(readlink "$STANDALONE")" ]] && continue
    sudo rm -rf "$old"
  done
  exit 0
fi

# rollback
track event=rollback sha12="$SHA12" prev="${PREV:-none}" workflowInstanceId="$WF_ID"
if [[ -n "$PREV" ]]; then
  sudo ln -sfn "$PREV" "$STANDALONE"
  sudo chown -h "$OWNER:users" "$STANDALONE"
  PREV_SHA="$(basename "$PREV")"
  $KUBECTL set env "deployment/${DEP}" -n "$NS" \
    "APP_VERSION=${PREV_SHA}" "NEXT_PUBLIC_APP_VERSION=${PREV_SHA}"
  $KUBECTL rollout restart "deployment/${DEP}" -n "$NS"
  $KUBECTL rollout status "deployment/${DEP}" -n "$NS" --timeout=180s || true
fi
exit 1
