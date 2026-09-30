#!/usr/bin/env python3
"""pi-rollout-from-artifact.py — SafeDeploy hostPath sync + k3s rollout
over SSH.

Runs on the deploy-proxy host (omv-ha). Expects a local artifact dir:
  ARTIFACT_DIR/standalone/   (.next/standalone, must contain server.js)
  ARTIFACT_DIR/static/       (optional)
  ARTIFACT_DIR/public/       (optional)

Env:
  ARTIFACT_DIR (or argv[1]), OMV_SSH_HOST, OMV_SSH_USER,
  OMV_SSH_IDENTITY, STANDALONE_HOSTPATH, K3S_NAMESPACE,
  K3S_DEPLOYMENT, APP_VERSION (required), RELEASE_SHA12."""

import os
import shlex
import subprocess
import sys
import time
from pathlib import Path

ARTIFACT_DIR = (sys.argv[1] if len(sys.argv) > 1
                else os.environ.get("ARTIFACT_DIR", ""))
OMV_SSH_HOST = os.environ.get("OMV_SSH_HOST", "192.168.1.128")
OMV_SSH_USER = os.environ.get("OMV_SSH_USER", "tbaltzakis")
STANDALONE_HOSTPATH = os.environ.get(
    "STANDALONE_HOSTPATH",
    "/home/tbaltzakis/cloudless-standalone")
K3S_NAMESPACE = os.environ.get("K3S_NAMESPACE", "cloudless")
K3S_DEPLOYMENT = os.environ.get("K3S_DEPLOYMENT", "cloudless-app")
APP_VERSION = os.environ.get("APP_VERSION", "")
if not APP_VERSION:
    sys.exit("APP_VERSION (full git SHA) is required")
RELEASE_SHA12 = os.environ.get("RELEASE_SHA12", APP_VERSION[:12])

if not ARTIFACT_DIR or not Path(ARTIFACT_DIR).is_dir():
    print(f"::error::ARTIFACT_DIR missing or not a directory: "
          f"{ARTIFACT_DIR or '<empty>'}", file=sys.stderr)
    sys.exit(1)
SRC = Path(ARTIFACT_DIR) / "standalone"
if not (SRC / "server.js").is_file():
    print(f"::error::Standalone build not found at {SRC}/server.js",
          file=sys.stderr)
    sys.exit(1)

SSH_OPTS = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=15",
            "-o", "StrictHostKeyChecking=accept-new"]
identity = os.environ.get("OMV_SSH_IDENTITY") or \
    (str(Path.home() / ".ssh/omv_ha")
     if (Path.home() / ".ssh/omv_ha").exists() else "")
if identity:
    SSH_OPTS += ["-i", identity]

TARGET = f"{OMV_SSH_USER}@{OMV_SSH_HOST}"


def remote(cmd: str, check: bool = True) -> str:
    r = subprocess.run(["ssh", *SSH_OPTS, TARGET, cmd],
                       capture_output=True, text=True)
    if check and r.returncode:
        print(r.stdout + r.stderr)
        sys.exit(r.returncode)
    return r.stdout.strip()


def remote_bash(script: str) -> int:
    r = subprocess.run(["ssh", *SSH_OPTS, TARGET, "bash", "-s"],
                       input=script, text=True)
    return r.returncode


def rsync_to(src: str, dest: str) -> None:
    rc = subprocess.call(
        ["rsync", "-a", "--delete", "-e", " ".join(["ssh", *SSH_OPTS]),
         src, f"{TARGET}:{dest}"])
    if rc:
        sys.exit(rc)


print(f"==> Deploy proxy → {TARGET}")
print(f"    release={RELEASE_SHA12} app_version={APP_VERSION}")
remote(f"hostname; test -d "
       f"{shlex.quote(str(Path(STANDALONE_HOSTPATH).parent))} "
       "&& echo HOSTPATH_PARENT_OK")

CURRENT = STANDALONE_HOSTPATH
RELEASES = f"{Path(CURRENT).parent}/cloudless-releases"
NEW_REL = f"{RELEASES}/{RELEASE_SHA12}"
USER_STAGE = f"/tmp/cloudless-stage-{RELEASE_SHA12}"

print(f"==> Rsync artifact → omv {USER_STAGE}")
remote(f"rm -rf {shlex.quote(USER_STAGE)} && "
       f"mkdir -p {shlex.quote(USER_STAGE)}")
rsync_to(f"{SRC}/", f"{USER_STAGE}/")
if (Path(ARTIFACT_DIR) / "static").is_dir():
    remote(f"mkdir -p {shlex.quote(USER_STAGE + '/.next/static')}")
    rsync_to(f"{ARTIFACT_DIR}/static/", f"{USER_STAGE}/.next/static/")
if (Path(ARTIFACT_DIR) / "public").is_dir():
    remote(f"mkdir -p {shlex.quote(USER_STAGE + '/public')}")
    rsync_to(f"{ARTIFACT_DIR}/public/", f"{USER_STAGE}/public/")
bid = Path(ARTIFACT_DIR) / "BUILD_ID"
if bid.is_file() and bid.stat().st_size:
    rsync_to(f"{ARTIFACT_DIR}/BUILD_ID", f"{USER_STAGE}/BUILD_ID")
remote(f"test -f {shlex.quote(USER_STAGE + '/server.js')}")

STAGE_CHECK = f"""\
set -euo pipefail
USER_STAGE={shlex.quote(USER_STAGE)}
test -f "${{USER_STAGE}}/server.js"
if [ ! -s "${{USER_STAGE}}/.next/BUILD_ID" ]; then
  for cand in "${{USER_STAGE}}/BUILD_ID"; do
    if [ -s "$cand" ]; then
      mkdir -p "${{USER_STAGE}}/.next"
      cp -a "$cand" "${{USER_STAGE}}/.next/BUILD_ID"
      echo "Restored .next/BUILD_ID from $cand"
      break
    fi
  done
fi
if [ ! -s "${{USER_STAGE}}/.next/BUILD_ID" ]; then
  echo "::error::Staged release missing .next/BUILD_ID (pack/upload incomplete — check include-hidden-files on upload-artifact)" >&2
  echo "stage size: $(du -sh "${{USER_STAGE}}" | cut -f1)"
  ls -la "${{USER_STAGE}}/.next" 2>/dev/null || true
  ls -la "${{USER_STAGE}}" | head -20
  exit 1
fi
NEXT_FILES=$(find "${{USER_STAGE}}/.next" -type f | wc -l)
echo "stage BUILD_ID=$(cat "${{USER_STAGE}}/.next/BUILD_ID") .next_files=${{NEXT_FILES}}"
if [ "$NEXT_FILES" -lt 10 ]; then
  echo "::error::standalone/.next looks empty (${{NEXT_FILES}} files) — artifact likely dropped hidden paths" >&2
  exit 1
fi
"""
if remote_bash(STAGE_CHECK):
    sys.exit(1)

print(f"==> Promote → releases/{RELEASE_SHA12} + flip symlink")
PREV = remote(f"readlink {shlex.quote(CURRENT)} 2>/dev/null || true",
              check=False).replace("\r", "")

PROMOTE = f"""\
set -euo pipefail
CURRENT={shlex.quote(CURRENT)}
RELEASES={shlex.quote(RELEASES)}
NEW_REL={shlex.quote(NEW_REL)}
USER_STAGE={shlex.quote(USER_STAGE)}
SHA12={shlex.quote(RELEASE_SHA12)}
OWNER={shlex.quote(OMV_SSH_USER)}
sudo mkdir -p "$RELEASES"
sudo rm -rf "$NEW_REL"
sudo mv "$USER_STAGE" "$NEW_REL"
sudo chmod -R a+rX "$NEW_REL"
if [ ! -s "$NEW_REL/.next/BUILD_ID" ] || [ ! -f "$NEW_REL/server.js" ]; then
  echo "::error::Promoted release missing server.js or .next/BUILD_ID — refusing symlink flip" >&2
  sudo rm -rf "$NEW_REL"
  exit 1
fi
sudo ln -sfn "cloudless-releases/$SHA12" "$CURRENT"
sudo chown -h "$OWNER:users" "$CURRENT"
echo "Symlink now: $CURRENT → $(readlink "$CURRENT")"
cd "$RELEASES"
ls -1t | tail -n +6 | while read -r old; do
  [ "cloudless-releases/$old" = "$(readlink "$CURRENT")" ] && continue
  echo "  pruning old release: $old"
  sudo rm -rf "$old"
done
echo "Prepared release: $NEW_REL ($(sudo du -sh "$NEW_REL" | cut -f1))"
"""
if remote_bash(PROMOTE):
    sys.exit(1)

print(f"previous_release={PREV}")

print("==> kubectl set env + rollout restart")
ROLLOUT = f"""\
set -euo pipefail
NS={shlex.quote(K3S_NAMESPACE)}
DEP={shlex.quote(K3S_DEPLOYMENT)}
FULL_SHA={shlex.quote(APP_VERSION)}
KUBECTL=""
for attempt in $(seq 1 6); do
  if command -v kubectl >/dev/null 2>&1 && kubectl get --raw /readyz --request-timeout=15s >/dev/null 2>&1; then
    KUBECTL="kubectl"; break
  elif sudo kubectl get --raw /readyz --request-timeout=15s >/dev/null 2>&1; then
    KUBECTL="sudo kubectl"; break
  elif sudo k3s kubectl get --raw /readyz --request-timeout=15s >/dev/null 2>&1; then
    KUBECTL="sudo k3s kubectl"; break
  fi
  echo "kubectl not ready (attempt ${{attempt}}/6) — waiting 10s…"
  sleep 10
done
if [ -z "$KUBECTL" ]; then
  echo "::error::kubectl cannot reach the cluster after 6 attempts" >&2
  exit 1
fi
echo "Using: $KUBECTL"
$KUBECTL set env "deployment/${{DEP}}" -n "$NS" \
  "APP_VERSION=${{FULL_SHA}}" \
  "NEXT_PUBLIC_APP_VERSION=${{FULL_SHA}}" \
  "NEXT_PUBLIC_AUTH_PROVIDER=d1" \
  "SSM_DISABLED=1" \
  "CLOUDFLARE_ACCOUNT_ID=fb7dc7b69b662480cd5961a4d1913c78"
$KUBECTL rollout restart "deployment/${{DEP}}" -n "$NS"
$KUBECTL rollout status "deployment/${{DEP}}" -n "$NS" --timeout=600s
sleep 15
$KUBECTL get pods -n "$NS" -l app=cloudless-app -o wide
$KUBECTL get endpoints -n "$NS" cloudless-app || true
if systemctl is-active --quiet cloudflared.service 2>/dev/null; then
  echo "host cloudflared.service: active"
else
  echo "::warning::host cloudflared.service not active — public edge may 502"
  systemctl is-active cloudflared.service 2>&1 || true
fi
TUNNEL_SPEC=$($KUBECTL get deploy cloudflare-tunnel -n "$NS" -o jsonpath='{{.spec.replicas}}' 2>/dev/null || echo missing)
echo "k8s cloudflare-tunnel replicas=${{TUNNEL_SPEC:-missing}} (host cloudflared is canonical; 0 is OK)"
curl -sS --max-time 5 http://127.0.0.1:30300/api/health || true
echo
"""
if remote_bash(ROLLOUT):
    sys.exit(1)

print("==> Verify health (auto-rollback on failure)")
HEALTH_OK = False
for attempt in range(1, 7):
    rc = remote_bash(
        'BODY=$(curl -sS --max-time 10 '
        'http://127.0.0.1:30300/api/health 2>/dev/null || true); '
        'echo "$BODY" | jq -e .version >/dev/null 2>&1 && echo "$BODY"')
    if rc == 0:
        HEALTH_OK = True
        print(f"✅ health OK (attempt {attempt})")
        break
    print(f"  health not ready (attempt {attempt}/6) — waiting 10s…")
    time.sleep(10)

if HEALTH_OK:
    print("Rollout verification successful.")
    sys.exit(0)

print("::warning::New release failed health checks — auto-rolling back "
      "to previous.")
if not PREV:
    print("::error::No previous release recorded. Cannot "
          "auto-rollback.", file=sys.stderr)
    remote(f"sudo kubectl logs -n {K3S_NAMESPACE} -l app=cloudless-app "
           "--tail=80 2>/dev/null || sudo k3s kubectl logs -n "
           f"{K3S_NAMESPACE} -l app=cloudless-app --tail=80",
           check=False)
    sys.exit(1)

ROLLBACK = f"""\
set -euo pipefail
CURRENT={shlex.quote(CURRENT)}
PREV_RELEASE={shlex.quote(PREV)}
OWNER={shlex.quote(OMV_SSH_USER)}
NS={shlex.quote(K3S_NAMESPACE)}
DEP={shlex.quote(K3S_DEPLOYMENT)}
sudo ln -sfn "$PREV_RELEASE" "$CURRENT"
sudo chown -h "$OWNER:users" "$CURRENT"
KUBECTL="sudo kubectl"
sudo kubectl get --raw /readyz --request-timeout=10s >/dev/null 2>&1 || KUBECTL="sudo k3s kubectl"
$KUBECTL rollout restart "deployment/$DEP" -n "$NS"
$KUBECTL rollout status "deployment/$DEP" -n "$NS" --timeout=180s
sleep 8
RESP=$(curl -sS --max-time 10 http://127.0.0.1:30300/api/health 2>/dev/null || true)
if echo "$RESP" | jq -e .version >/dev/null 2>&1; then
  echo "::error::Deploy failed; auto-rollback SUCCEEDED — site on $PREV_RELEASE"
  exit 1
fi
echo "::error::Deploy failed AND auto-rollback health-check also failed."
$KUBECTL logs -n "$NS" -l app=cloudless-app --tail=80 || true
exit 1
"""
sys.exit(1 if remote_bash(ROLLBACK) else 1)
