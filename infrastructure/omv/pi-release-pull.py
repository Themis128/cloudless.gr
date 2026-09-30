#!/usr/bin/env python3
"""pi-release-pull.py — load-guarded pull of Next standalone from R2.

Port of pi-release-pull.sh.

Reads desired.json via the orchestrator Worker (or R2 S3 API), downloads the
tarball when load is low, promotes hostPath symlink, restarts cloudless-app.

Env file: /etc/cloudless/pi-release-pull.env (mode 600)
  DEPLOY_ORCHESTRATOR_URL   e.g. https://pi-deploy-orchestrator.<acct>.workers.dev
  DEPLOY_ORCHESTRATOR_TOKEN
  LOAD1_MAX                 default 6
  IOWAIT_MAX_PCT            default 40 (0 disables iowait check)
Optional S3 fallback (only if orchestrator /artifact is unavailable):
  CF_ACCOUNT_ID CF_R2_ACCESS_KEY_ID CF_R2_SECRET_ACCESS_KEY R2_BUCKET

Tracking: every line is key=value; also POST /agent-event when URL is set.
"""

import json
import os
import shutil
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

ENV_FILE = Path(os.environ.get("ENV_FILE", "/etc/cloudless/pi-release-pull.env"))


def load_env(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_env(ENV_FILE)
env = os.environ.get

LOG_TAG = "pi-release-pull"
STANDALONE = env("STANDALONE_HOSTPATH", "/home/tbaltzakis/cloudless-standalone")
RELEASES = str(Path(STANDALONE).parent / "cloudless-releases")
OWNER = env("OMV_OWNER", "tbaltzakis")
NS = env("K3S_NAMESPACE", "cloudless")
DEP = env("K3S_DEPLOYMENT", "cloudless-app")
BUCKET = env("R2_BUCKET", "cloudless-pi-releases")
LOAD1_MAX = float(env("LOAD1_MAX", "6"))
IOWAIT_MAX_PCT = int(env("IOWAIT_MAX_PCT", "40"))
ENDPOINT = env("R2_ENDPOINT", f"https://{env('CF_ACCOUNT_ID', '')}.r2.cloudflarestorage.com")

DEPLOY_ORCHESTRATOR_URL = env("DEPLOY_ORCHESTRATOR_URL", "")
DEPLOY_ORCHESTRATOR_TOKEN = env("DEPLOY_ORCHESTRATOR_TOKEN", "")


def log(msg: str) -> None:
    print(f"[{LOG_TAG}] {msg}")
    subprocess.run(["logger", "-t", LOG_TAG, msg], check=False, capture_output=True)


def track(**kvs: str) -> None:
    ts = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    log(" ".join([f"ts={ts}", *[f"{k}={v}" for k, v in kvs.items()]]))
    if DEPLOY_ORCHESTRATOR_URL and DEPLOY_ORCHESTRATOR_TOKEN:
        try:
            req = urllib.request.Request(
                f"{DEPLOY_ORCHESTRATOR_URL.rstrip('/')}/agent-event",
                data=json.dumps(kvs).encode(),
                headers={
                    "Authorization": f"Bearer {DEPLOY_ORCHESTRATOR_TOKEN}",
                    "content-type": "application/json",
                },
                method="POST",
            )
            urllib.request.urlopen(req, timeout=8)
        except Exception:
            pass


def need(key: str) -> str:
    val = env(key, "")
    if not val:
        log(f"missing env {key}")
        sys.exit(1)
    return val


def run(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(list(args), capture_output=True, text=True, check=False)


def http_get(url: str, timeout: int, auth: bool = False) -> tuple[str, bytes]:
    headers = {}
    if auth:
        headers["Authorization"] = f"Bearer {DEPLOY_ORCHESTRATOR_TOKEN}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return str(resp.status), resp.read()
    except urllib.error.HTTPError as e:
        return str(e.code), e.read()
    except Exception:
        return "000", b""


need("DEPLOY_ORCHESTRATOR_URL")
need("DEPLOY_ORCHESTRATOR_TOKEN")

load1 = float(Path("/proc/loadavg").read_text().split()[0])
iowait_pct = 0
if IOWAIT_MAX_PCT != 0 and shutil.which("mpstat"):
    r = run("mpstat", "1", "1")
    for line in (r.stdout or "").splitlines():
        if "Average:" in line:
            cols = line.split()
            if cols[-1].replace(".", "").isdigit():
                iowait_pct = int(float(cols[-2]))

load_high = load1 > LOAD1_MAX
io_high = IOWAIT_MAX_PCT > 0 and iowait_pct > IOWAIT_MAX_PCT

code, body = http_get(f"{DEPLOY_ORCHESTRATOR_URL.rstrip('/')}/desired", 15, auth=True)
if code == "404":
    track(event="noop_no_desired")
    sys.exit(0)
if code != "200":
    track(event="error", reason="desired_http", http=code)
    sys.exit(1)

try:
    desired = json.loads(body)
except json.JSONDecodeError:
    track(event="error", reason="bad_desired")
    sys.exit(1)

SHA = desired.get("sha", "")
ARTIFACT_KEY = desired.get("artifactKey", "")
WF_ID = desired.get("workflowInstanceId") or ""
SHA12 = SHA[:12]

if not SHA or not ARTIFACT_KEY:
    track(event="error", reason="bad_desired")
    sys.exit(1)

standalone_path = Path(STANDALONE)
CURRENT = standalone_path.resolve().name if standalone_path.is_symlink() else ""
if CURRENT == SHA12:
    track(event="noop_already_live", sha12=SHA12, workflowInstanceId=WF_ID)
    sys.exit(0)

if load_high or io_high:
    track(
        event="skip_load_high", sha12=SHA12, load1=str(load1),
        iowait_pct=str(iowait_pct), want=SHA12,
        current=CURRENT or "none", workflowInstanceId=WF_ID,
    )
    sys.exit(0)

track(
    event="pull_start", sha12=SHA12, artifactKey=ARTIFACT_KEY,
    workflowInstanceId=WF_ID, githubRunId=str(desired.get("githubRunId") or ""),
)

TMP = Path(f"/tmp/cloudless-pull-{SHA12}")
TAR = TMP / "release.tar.zst"
shutil.rmtree(TMP, ignore_errors=True)
TMP.mkdir(parents=True)

# Prefer authenticated orchestrator download (no R2 keys on omv).
key_q = urllib.parse.quote(ARTIFACT_KEY, safe="/")
code, data = http_get(
    f"{DEPLOY_ORCHESTRATOR_URL.rstrip('/')}/artifact?key={key_q}", 600, auth=True
)
if code.startswith("2") and data:
    TAR.write_bytes(data)
    track(event="download_via_orchestrator", sha12=SHA12, artifactKey=ARTIFACT_KEY)
elif env("CF_R2_ACCESS_KEY_ID") and env("CF_R2_SECRET_ACCESS_KEY") and env("CF_ACCOUNT_ID"):
    if not shutil.which("rclone"):
        track(event="error", reason="rclone_missing", sha12=SHA12)
        sys.exit(1)
    r = run(
        "nice", "-n", "10", "ionice", "-c2", "-n7", "rclone", "copyto",
        f":s3:{BUCKET}/{ARTIFACT_KEY}", str(TAR),
        "--s3-provider", "Cloudflare",
        "--s3-access-key-id", env("CF_R2_ACCESS_KEY_ID", ""),
        "--s3-secret-access-key", env("CF_R2_SECRET_ACCESS_KEY", ""),
        "--s3-endpoint", ENDPOINT, "--s3-region", "auto", "--s3-no-check-bucket",
    )
    if r.returncode != 0:
        track(event="error", reason="download_failed", sha12=SHA12, artifactKey=ARTIFACT_KEY)
        sys.exit(1)
    track(event="download_via_r2_s3", sha12=SHA12, artifactKey=ARTIFACT_KEY)
else:
    track(event="error", reason="download_failed", sha12=SHA12, artifactKey=ARTIFACT_KEY)
    sys.exit(1)

NEW_REL = Path(RELEASES) / SHA12
PREV = os.readlink(STANDALONE) if standalone_path.is_symlink() else ""

run("sudo", "mkdir", "-p", RELEASES)
shutil.rmtree(NEW_REL, ignore_errors=True)
run("sudo", "rm", "-rf", str(NEW_REL))
run("sudo", "mkdir", "-p", str(NEW_REL))
# Unpack with low priority onto SSD-backed home
run("nice", "-n", "10", "ionice", "-c2", "-n7", "sudo", "tar", "--zstd", "-xf", str(TAR), "-C", str(NEW_REL))

# Tarball layout: top-level standalone/ static/ public/ BUILD_ID (from pack OUT).
# Never rsync standalone/ into its parent (NEW_REL) — that is a classic infinite
# recursion footgun (dest contains source). Merge via a sibling temp dir instead.
if (NEW_REL / "standalone").is_dir():
    import tempfile
    merge = Path(tempfile.mkdtemp(prefix=f".merge-{SHA12}.", dir=RELEASES))
    run("sudo", "rsync", "-a", f"{NEW_REL}/standalone/", f"{merge}/")
    run("sudo", "rsync", "-a", "--exclude", "standalone", f"{NEW_REL}/", f"{merge}/")
    run("sudo", "rm", "-rf", str(NEW_REL))
    run("sudo", "mv", str(merge), str(NEW_REL))
if (NEW_REL / "static").is_dir():
    run("sudo", "mkdir", "-p", str(NEW_REL / ".next" / "static"))
    # static/ is a sibling of the app root, not a child of itself — safe.
    run("sudo", "rsync", "-a", f"{NEW_REL}/static/", f"{NEW_REL}/.next/static/")
    run("sudo", "rm", "-rf", str(NEW_REL / "static"))
build_id = NEW_REL / "BUILD_ID"
next_build_id = NEW_REL / ".next" / "BUILD_ID"
if build_id.is_file() and not next_build_id.is_file():
    run("sudo", "mkdir", "-p", str(NEW_REL / ".next"))
    run("sudo", "cp", "-a", str(build_id), str(next_build_id))

if not next_build_id.is_file() or next_build_id.stat().st_size == 0 or not (NEW_REL / "server.js").is_file():
    track(event="error", reason="missing_build_id_or_server", sha12=SHA12)
    run("sudo", "rm", "-rf", str(NEW_REL))
    shutil.rmtree(TMP, ignore_errors=True)
    sys.exit(1)

next_files = sum(1 for _ in (NEW_REL / ".next").rglob("*") if _.is_file()) if (NEW_REL / ".next").is_dir() else 0
if next_files < 10:
    track(event="error", reason="empty_next", sha12=SHA12, next_files=str(next_files))
    run("sudo", "rm", "-rf", str(NEW_REL))
    shutil.rmtree(TMP, ignore_errors=True)
    sys.exit(1)

run("sudo", "chmod", "-R", "a+rX", str(NEW_REL))
run("sudo", "ln", "-sfn", f"cloudless-releases/{SHA12}", STANDALONE)
run("sudo", "chown", "-h", f"{OWNER}:users", STANDALONE)

KUBECTL = ["sudo", "k3s", "kubectl"]
run(*KUBECTL, "set", "env", f"deployment/{DEP}", "-n", NS,
    f"APP_VERSION={SHA}", f"NEXT_PUBLIC_APP_VERSION={SHA}",
    "NEXT_PUBLIC_AUTH_PROVIDER=d1", "SSM_DISABLED=1")
run(*KUBECTL, "rollout", "restart", f"deployment/{DEP}", "-n", NS)
run(*KUBECTL, "rollout", "status", f"deployment/{DEP}", "-n", NS, "--timeout=300s")

health_ok = False
for _ in range(8):
    code, resp_body = http_get("http://127.0.0.1:30300/api/health", 8)
    try:
        d = json.loads(resp_body)
        v = str(d.get("version", ""))
        if d.get("status") == "ok" and (v.startswith(SHA12) or v == SHA):
            health_ok = True
            break
    except json.JSONDecodeError:
        pass
    time.sleep(5)

shutil.rmtree(TMP, ignore_errors=True)

if health_ok:
    track(event="promote_ok", sha12=SHA12, workflowInstanceId=WF_ID, next_files=str(next_files))
    # prune old releases (keep 5)
    releases = sorted(
        (p for p in Path(RELEASES).iterdir() if p.is_dir() and not p.name.startswith(".merge-")),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    for old in releases[5:]:
        if f"cloudless-releases/{old.name}" == (os.readlink(STANDALONE) if standalone_path.is_symlink() else ""):
            continue
        run("sudo", "rm", "-rf", str(old))
    sys.exit(0)

# rollback
track(event="rollback", sha12=SHA12, prev=PREV or "none", workflowInstanceId=WF_ID)
if PREV:
    run("sudo", "ln", "-sfn", PREV, STANDALONE)
    run("sudo", "chown", "-h", f"{OWNER}:users", STANDALONE)
    prev_sha = Path(PREV).name
    run(*KUBECTL, "set", "env", f"deployment/{DEP}", "-n", NS,
        f"APP_VERSION={prev_sha}", f"NEXT_PUBLIC_APP_VERSION={prev_sha}")
    run(*KUBECTL, "rollout", "restart", f"deployment/{DEP}", "-n", NS)
    run(*KUBECTL, "rollout", "status", f"deployment/{DEP}", "-n", NS, "--timeout=180s")
sys.exit(1)
