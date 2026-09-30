#!/usr/bin/env python3
"""restore-auth.py — restore Pi D1 authentication to a known-good
working state.

SYMPTOM this fixes: /api/auth/login returns 500 and /api/debug-db shows
"D1 HTTP query failed (401): Authentication error".

ROOT CAUSE: the Pi Next app reaches Cloudflare D1 over REST and needs
(1) CLOUDFLARE_ACCOUNT_ID = the account that OWNS user-auth-db and
(2) a VALID CLOUDFLARE_API_TOKEN — as EXPLICIT deployment env vars
(env overrides envFrom: secretRef).

The known-good token is read from .env.local (never printed/committed).

USAGE:
  restore-auth.py           # diagnose; repair only if broken
  restore-auth.py --check   # diagnose only, no changes
  restore-auth.py --force   # re-pin even if currently healthy"""

import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

NAMESPACE = "cloudless"
DEPLOYMENT = "cloudless-app"
ACCOUNT_ID = "fb7dc7b69b662480cd5961a4d1913c78"
DB_ID = "7ca74513-23c3-412a-b9ca-b0c55835973d"
SITE = "https://cloudless.gr"
ENV_FILE = os.environ.get("ENV_FILE", ".env.local")

mode = "repair"
if len(sys.argv) > 1:
    if sys.argv[1] == "--check":
        mode = "check"
    elif sys.argv[1] == "--force":
        mode = "force"
    else:
        sys.exit(f"unknown arg: {sys.argv[1]} (use --check or --force)")


def log(m): print(f"\033[1m[restore-auth]\033[0m {m}")


def die(m):
    print(f"\033[31m[restore-auth] ERROR:\033[0m {m}", file=sys.stderr)
    sys.exit(1)


if not shutil.which("kubectl"):
    die("kubectl not found / cluster not reachable")
r = subprocess.run(["kubectl", "get", f"deployment/{DEPLOYMENT}",
                    "-n", NAMESPACE], capture_output=True)
if r.returncode:
    die(f"deployment/{DEPLOYMENT} not found in ns {NAMESPACE} — is "
        "kubectl pointed at the k3s cluster?")


def diagnose() -> bool:
    try:
        body = urllib.request.urlopen(
            f"{SITE}/api/debug-db", timeout=15).read()
        return b'"dbConnected":true' in body
    except Exception:
        return False


def http_code(url: str, method: str = "GET", body=None,
              token: str = "") -> int:
    req = urllib.request.Request(
        url, data=json.dumps(body).encode() if body is not None
        else None,
        headers={"Content-Type": "application/json",
                 **({"Authorization": f"Bearer {token}"}
                    if token else {})}, method=method)
    try:
        return urllib.request.urlopen(req, timeout=15).status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return 0


log(f"Checking {SITE}/api/debug-db ...")
if diagnose():
    log("D1 auth is currently HEALTHY (dbConnected:true).")
    if mode != "force":
        log("Nothing to do (use --force to re-pin anyway).")
        sys.exit(0)
    log("--force given: re-pinning anyway.")
else:
    log("D1 auth is BROKEN (dbConnected:false / 401).")
    if mode == "check":
        log("--check: no changes made.")
        sys.exit(1)
if mode == "check":
    sys.exit(0)

# --- load known-good token from .env.local ---
env_path = Path(ENV_FILE)
if "/" not in ENV_FILE:
    env_path = Path(".") / ENV_FILE
if not env_path.is_file():
    die(f"{ENV_FILE} not found (need CLOUDFLARE_API_TOKEN). Run from "
        "the repo root.")
token = ""
for line in env_path.read_text().splitlines():
    line = line.strip()
    if line.startswith("CLOUDFLARE_API_TOKEN="):
        token = line.split("=", 1)[1].strip().strip('"').strip("'")
if not token:
    die(f"CLOUDFLARE_API_TOKEN is empty/unset in {ENV_FILE}")

# --- validate against D1 before pushing ---
log(f"Validating the {ENV_FILE} token against D1 (account "
    f"{ACCOUNT_ID[:8]}…) ...")
code = http_code(
    f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/"
    f"d1/database/{DB_ID}/query",
    method="POST", body={"sql": "SELECT 1"}, token=token)
if code != 200:
    die(f"The token in {ENV_FILE} is NOT valid for D1 (HTTP {code}).\n"
        "       Mint a fresh D1-scoped token (Cloudflare dashboard → "
        "My Profile → API\n"
        "       Tokens, D1:Edit on account fb7dc7…, or the "
        "cloudflare-token-doctor\n"
        f"       skill), put it in {ENV_FILE}, then re-run this "
        "script.")
log("Token is valid (D1 query → 200).")

# --- pin account + token as explicit env ---
log(f"Pinning CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN on "
    f"deployment/{DEPLOYMENT} ...")
subprocess.run(["kubectl", "set", "env", f"deployment/{DEPLOYMENT}",
                "-n", NAMESPACE,
                f"CLOUDFLARE_ACCOUNT_ID={ACCOUNT_ID}",
                f"CLOUDFLARE_API_TOKEN={token}"],
               capture_output=True, check=True)
log("Waiting for rollout ...")
subprocess.run(["kubectl", "rollout", "status",
                f"deployment/{DEPLOYMENT}", "-n", NAMESPACE,
                "--timeout=180s"])

log("Verifying D1 connection ...")
ok = False
for _ in range(6):
    if diagnose():
        ok = True
        break
    time.sleep(5)
if not ok:
    die("debug-db still not connected after rollout.\n"
        f"       Inspect: kubectl logs -n {NAMESPACE} "
        f"deploy/{DEPLOYMENT} --tail=50")

lcode = http_code(f"{SITE}/api/auth/login", method="POST",
                  body={"email": "probe@example.com",
                        "password": "wrongpassword123"})
if lcode == 401:
    log("✅ AUTH RESTORED — dbConnected:true and /api/auth/login "
        "returns 401 for bad creds (was 500).")
else:
    die(f"dbConnected:true but /api/auth/login returned {lcode} "
        "(expected 401). Investigate.")
