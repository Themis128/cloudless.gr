#!/usr/bin/env python3
"""Patch k8s cloudless-secrets on omv with GSC + Sentry keys, then
restart cloudless-app. cloudless2 is proxy-only — secrets must live
on the Pi pod.

Usage (operator machine; do NOT commit secret values):
  export the needed env vars, then
  python3 scripts/sync-gsc-sentry-to-pi.py

Required env: GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY,
  GOOGLE_CALENDAR_ID, GSC_SITE_URL, SENTRY_AUTH_TOKEN
Optional: SENTRY_ORG (default baltzakisthemiscom),
  SENTRY_PROJECT (default cloudless-gr), SSH_HOST (default omv)"""

import base64
import json
import os
import re
import subprocess
import sys

SSH_HOST = os.environ.get("SSH_HOST", "omv")
NS, SECRET = "cloudless", "cloudless-secrets"

NEED = ["GOOGLE_CLIENT_EMAIL", "GOOGLE_PRIVATE_KEY",
        "GOOGLE_CALENDAR_ID", "GSC_SITE_URL", "SENTRY_AUTH_TOKEN",
        "SENTRY_ORG", "SENTRY_PROJECT"]

for k in NEED[:5]:
    if not os.environ.get(k):
        sys.exit(f"missing env: {k}")
os.environ.setdefault("SENTRY_ORG", "baltzakisthemiscom")
os.environ.setdefault("SENTRY_PROJECT", "cloudless-gr")

placeholder = re.compile(
    r"^(your[_-]?value|your[_-]?service|changeme|todo|xxx|"
    r"placeholder)", re.I)

data = {}
for k in NEED:
    v = (os.environ.get(k) or "").strip()
    if not v:
        sys.exit(f"missing {k}")
    if placeholder.match(v):
        sys.exit(f"{k} looks like a placeholder; refuse to sync")
    if k == "GOOGLE_PRIVATE_KEY":
        pem = v.replace("\\n", "\n")
        if "BEGIN" not in pem or len(pem) < 200:
            sys.exit("GOOGLE_PRIVATE_KEY must be a PEM private key "
                     "(BEGIN…, length>=200)")
        v = pem
    data[k] = base64.b64encode(v.encode()).decode()

patch = json.dumps({"data": data})
print(f"Patching {NS}/{SECRET} on {SSH_HOST} (key names only)…")
r = subprocess.run(
    ["ssh", SSH_HOST,
     f"sudo k3s kubectl -n {NS} patch secret {SECRET} "
     f"--type merge -p '{patch}'"])
if r.returncode != 0:
    sys.exit(r.returncode)
r = subprocess.run(
    ["ssh", SSH_HOST,
     f"sudo k3s kubectl -n {NS} rollout restart "
     "deploy/cloudless-app"])
if r.returncode != 0:
    sys.exit(r.returncode)
subprocess.run(
    ["ssh", SSH_HOST,
     f"sudo k3s kubectl -n {NS} rollout status "
     "deploy/cloudless-app --timeout=180s"])

print("Verify key presence:")
r = subprocess.run(
    ["ssh", SSH_HOST,
     f"sudo k3s kubectl -n {NS} get secret {SECRET} -o json"],
    capture_output=True, text=True)
keys = set(json.loads(r.stdout).get("data", {}))
print("present:", ", ".join(k for k in NEED if k in keys))
missing = [k for k in NEED if k not in keys]
if missing:
    sys.exit("MISSING: " + ", ".join(missing))
print("ok")
