#!/usr/bin/env bash
# pi-rollout-from-artifact.sh — SafeDeploy hostPath sync + k3s rollout over SSH.
#
# Runs on the deploy-proxy host (omv-ha). Expects a local artifact directory
# produced by deploy-pi's build job:
#
#   ARTIFACT_DIR/
#     standalone/   # contents of .next/standalone (must contain server.js)
#     static/       # optional — .next/static
#     public/       # optional — public/
#
# Env:
#   ARTIFACT_DIR         Path to unpacked artifact (or pass as $1)
#   OMV_SSH_HOST         SSH target for omv (default: 192.168.1.128)
#   OMV_SSH_USER         SSH user (default: tbaltzakis)
#   OMV_SSH_IDENTITY     Optional private key (default: ~/.ssh/omv_ha if present)
#   STANDALONE_HOSTPATH  Symlink k8s mounts (default: /home/tbaltzakis/cloudless-standalone)
#   K3S_NAMESPACE        default: cloudless
#   K3S_DEPLOYMENT       default: cloudless-app
#   APP_VERSION          Full git SHA (required)
#   RELEASE_SHA12        Release dir name (default: first 12 of APP_VERSION)
set -euo pipefail

ARTIFACT_DIR="${1:-${ARTIFACT_DIR:-}}"
OMV_SSH_HOST="${OMV_SSH_HOST:-192.168.1.128}"
OMV_SSH_USER="${OMV_SSH_USER:-tbaltzakis}"
STANDALONE_HOSTPATH="${STANDALONE_HOSTPATH:-/home/tbaltzakis/cloudless-standalone}"
K3S_NAMESPACE="${K3S_NAMESPACE:-cloudless}"
K3S_DEPLOYMENT="${K3S_DEPLOYMENT:-cloudless-app}"
APP_VERSION="${APP_VERSION:?APP_VERSION (full git SHA) is required}"
RELEASE_SHA12="${RELEASE_SHA12:-${APP_VERSION:0:12}}"

if [[ -z "$ARTIFACT_DIR" || ! -d "$ARTIFACT_DIR" ]]; then
  echo "::error::ARTIFACT_DIR missing or not a directory: ${ARTIFACT_DIR:-<empty>}" >&2
  exit 1
fi
SRC="${ARTIFACT_DIR}/standalone"
if [[ ! -f "${SRC}/server.js" ]]; then
  echo "::error::Standalone build not found at ${SRC}/server.js" >&2
  exit 1
fi

SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new)
if [[ -n "${OMV_SSH_IDENTITY:-}" ]]; then
  SSH_OPTS+=(-i "$OMV_SSH_IDENTITY")
elif [[ -f "${HOME}/.ssh/omv_ha" ]]; then
  SSH_OPTS+=(-i "${HOME}/.ssh/omv_ha")
fi

remote() {
  # shellcheck disable=SC2029
  ssh "${SSH_OPTS[@]}" "${OMV_SSH_USER}@${OMV_SSH_HOST}" "$@"
}

RSYNC_RSH="ssh ${SSH_OPTS[*]}"
rsync_to() {
  local src="$1" dest="$2"
  rsync -a --delete -e "$RSYNC_RSH" "$src" "${OMV_SSH_USER}@${OMV_SSH_HOST}:${dest}"
}

echo "==> Deploy proxy → ${OMV_SSH_USER}@${OMV_SSH_HOST}"
echo "    release=${RELEASE_SHA12} app_version=${APP_VERSION}"
remote "hostname; test -d $(dirname "$STANDALONE_HOSTPATH") && echo HOSTPATH_PARENT_OK"

CURRENT="$STANDALONE_HOSTPATH"
RELEASES="$(dirname "$CURRENT")/cloudless-releases"
NEW_REL="$RELEASES/$RELEASE_SHA12"
USER_STAGE="/tmp/cloudless-stage-${RELEASE_SHA12}"

echo "==> Rsync artifact → omv ${USER_STAGE}"
remote "rm -rf '$USER_STAGE' && mkdir -p '$USER_STAGE'"
rsync_to "${SRC}/" "${USER_STAGE}/"
if [[ -d "${ARTIFACT_DIR}/static" ]]; then
  remote "mkdir -p '${USER_STAGE}/.next/static'"
  rsync_to "${ARTIFACT_DIR}/static/" "${USER_STAGE}/.next/static/"
fi
if [[ -d "${ARTIFACT_DIR}/public" ]]; then
  remote "mkdir -p '${USER_STAGE}/public'"
  rsync_to "${ARTIFACT_DIR}/public/" "${USER_STAGE}/public/"
fi
remote "test -f '${USER_STAGE}/server.js'"
remote bash -s <<REMOTE
set -euo pipefail
USER_STAGE='$USER_STAGE'
# Refuse incomplete packs before touching the live symlink (reboot mid-rsync
# previously left a release without .next/BUILD_ID → CrashLoop).
test -f "\${USER_STAGE}/server.js"
test -f "\${USER_STAGE}/.next/BUILD_ID"
test -s "\${USER_STAGE}/.next/BUILD_ID"
echo "stage BUILD_ID=\$(cat "\${USER_STAGE}/.next/BUILD_ID")"
REMOTE

echo "==> Promote → releases/${RELEASE_SHA12} + flip symlink"
PREV="$(remote "readlink '$CURRENT' 2>/dev/null || true" | tr -d '\r')"
remote bash -s <<REMOTE
set -euo pipefail
CURRENT='$CURRENT'
RELEASES='$RELEASES'
NEW_REL='$NEW_REL'
USER_STAGE='$USER_STAGE'
SHA12='$RELEASE_SHA12'
OWNER='$OMV_SSH_USER'
sudo mkdir -p "\$RELEASES"
sudo rm -rf "\$NEW_REL"
sudo mv "\$USER_STAGE" "\$NEW_REL"
# Pod may run as a different uid — keep tree world-readable/executable.
sudo chmod -R a+rX "\$NEW_REL"
# Gate again on the promoted tree (mv must not drop BUILD_ID).
if [ ! -s "\$NEW_REL/.next/BUILD_ID" ] || [ ! -f "\$NEW_REL/server.js" ]; then
  echo "::error::Promoted release missing server.js or .next/BUILD_ID — refusing symlink flip" >&2
  sudo rm -rf "\$NEW_REL"
  exit 1
fi
sudo ln -sfn "cloudless-releases/\$SHA12" "\$CURRENT"
sudo chown -h "\$OWNER:users" "\$CURRENT"
echo "Symlink now: \$CURRENT → \$(readlink "\$CURRENT")"
cd "\$RELEASES"
ls -1t | tail -n +6 | while read -r old; do
  [ "cloudless-releases/\$old" = "\$(readlink "\$CURRENT")" ] && continue
  echo "  pruning old release: \$old"
  sudo rm -rf "\$old"
done
echo "Prepared release: \$NEW_REL (\$(sudo du -sh "\$NEW_REL" | cut -f1))"
REMOTE

echo "previous_release=${PREV}"

echo "==> kubectl set env + rollout restart"
remote bash -s <<REMOTE
set -euo pipefail
NS='$K3S_NAMESPACE'
DEP='$K3S_DEPLOYMENT'
FULL_SHA='$APP_VERSION'
KUBECTL=""
for attempt in \$(seq 1 6); do
  if command -v kubectl >/dev/null 2>&1 && kubectl get --raw /readyz --request-timeout=15s >/dev/null 2>&1; then
    KUBECTL="kubectl"; break
  elif sudo kubectl get --raw /readyz --request-timeout=15s >/dev/null 2>&1; then
    KUBECTL="sudo kubectl"; break
  elif sudo k3s kubectl get --raw /readyz --request-timeout=15s >/dev/null 2>&1; then
    KUBECTL="sudo k3s kubectl"; break
  fi
  echo "kubectl not ready (attempt \${attempt}/6) — waiting 10s…"
  sleep 10
done
if [ -z "\$KUBECTL" ]; then
  echo "::error::kubectl cannot reach the cluster after 6 attempts" >&2
  exit 1
fi
echo "Using: \$KUBECTL"
\$KUBECTL set env "deployment/\${DEP}" -n "\$NS" \
  "APP_VERSION=\${FULL_SHA}" \
  "NEXT_PUBLIC_APP_VERSION=\${FULL_SHA}" \
  "NEXT_PUBLIC_AUTH_PROVIDER=d1" \
  "SSM_DISABLED=1" \
  "CLOUDFLARE_ACCOUNT_ID=fb7dc7b69b662480cd5961a4d1913c78"
\$KUBECTL rollout restart "deployment/\${DEP}" -n "\$NS"
\$KUBECTL rollout status "deployment/\${DEP}" -n "\$NS" --timeout=600s
sleep 15
\$KUBECTL get pods -n "\$NS" -l app=cloudless-app -o wide
\$KUBECTL get endpoints -n "\$NS" cloudless-app || true
# Origin path needs the named tunnel. Scale-to-zero (or CrashLoop) causes
# public 502 even when NodePort health is fine — assert replicas before OK.
TUNNEL_JSON=\$(\$KUBECTL get deploy cloudflare-tunnel -n "\$NS" -o json 2>/dev/null || true)
if [ -n "\$TUNNEL_JSON" ]; then
  TUNNEL_SPEC=\$(echo "\$TUNNEL_JSON" | jq -r '.spec.replicas // 0')
  TUNNEL_READY=\$(echo "\$TUNNEL_JSON" | jq -r '.status.readyReplicas // 0')
  echo "cloudflare-tunnel replicas spec=\${TUNNEL_SPEC} ready=\${TUNNEL_READY}"
  if [ "\$TUNNEL_SPEC" = "0" ] || [ "\$TUNNEL_SPEC" = "null" ]; then
    echo "::warning::cloudflare-tunnel scaled to 0 — restoring replicas=1"
    \$KUBECTL scale deployment/cloudflare-tunnel -n "\$NS" --replicas=1
    \$KUBECTL rollout status deployment/cloudflare-tunnel -n "\$NS" --timeout=120s || true
  fi
fi
curl -sS --max-time 5 http://127.0.0.1:30300/api/health || true
echo
REMOTE

echo "==> Verify health (auto-rollback on failure)"
HEALTH_OK=0
for attempt in 1 2 3 4 5 6; do
  # Prefer jq on omv (always present); fall back to local jq if available.
  if remote 'BODY=$(curl -sS --max-time 10 http://127.0.0.1:30300/api/health 2>/dev/null || true); echo "$BODY" | jq -e .version >/dev/null 2>&1 && echo "$BODY"'; then
    HEALTH_OK=1
    echo "✅ health OK (attempt ${attempt})"
    break
  fi
  echo "  health not ready (attempt ${attempt}/6) — waiting 10s…"
  sleep 10
done

if [[ "$HEALTH_OK" = "1" ]]; then
  echo "Rollout verification successful."
  exit 0
fi

echo "::warning::New release failed health checks — auto-rolling back to previous."
if [[ -z "$PREV" ]]; then
  echo "::error::No previous release recorded. Cannot auto-rollback." >&2
  remote "sudo kubectl logs -n ${K3S_NAMESPACE} -l app=cloudless-app --tail=80 2>/dev/null || sudo k3s kubectl logs -n ${K3S_NAMESPACE} -l app=cloudless-app --tail=80" || true
  exit 1
fi

remote bash -s <<REMOTE
set -euo pipefail
CURRENT='$CURRENT'
PREV_RELEASE='$PREV'
OWNER='$OMV_SSH_USER'
NS='$K3S_NAMESPACE'
DEP='$K3S_DEPLOYMENT'
sudo ln -sfn "\$PREV_RELEASE" "\$CURRENT"
sudo chown -h "\$OWNER:users" "\$CURRENT"
KUBECTL="sudo kubectl"
sudo kubectl get --raw /readyz --request-timeout=10s >/dev/null 2>&1 || KUBECTL="sudo k3s kubectl"
\$KUBECTL rollout restart "deployment/\$DEP" -n "\$NS"
\$KUBECTL rollout status "deployment/\$DEP" -n "\$NS" --timeout=180s
sleep 8
RESP=\$(curl -sS --max-time 10 http://127.0.0.1:30300/api/health 2>/dev/null || true)
if echo "\$RESP" | jq -e .version >/dev/null 2>&1; then
  echo "::error::Deploy failed; auto-rollback SUCCEEDED — site on \$PREV_RELEASE"
  exit 1
fi
echo "::error::Deploy failed AND auto-rollback health-check also failed."
\$KUBECTL logs -n "\$NS" -l app=cloudless-app --tail=80 || true
exit 1
REMOTE
