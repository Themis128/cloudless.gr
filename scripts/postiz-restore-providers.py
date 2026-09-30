#!/usr/bin/env python3
"""Recreate k8s secret postiz-providers from AWS SSM (or
already-exported env). Never prints secret values. Does not read
.env.local.

Usage:
  python3 scripts/postiz-restore-providers.py
  FACEBOOK_APP_ID=… python3 scripts/postiz-restore-providers.py

Maps SSM aliases → Postiz env names:
  TIKTOK_APP_ID / tiktok-client-key       → TIKTOK_CLIENT_ID
  TIKTOK_APP_SECRET / tiktok-client-secret → TIKTOK_CLIENT_SECRET"""

import base64
import os
import shutil
import subprocess
import sys

NAMESPACE = os.environ.get("NAMESPACE", "postiz")
SECRET_NAME = os.environ.get("SECRET_NAME", "postiz-providers")
SSM_PREFIX = os.environ.get("SSM_PREFIX", "/cloudless/production")


def read_ssm(name: str) -> str:
    r = subprocess.run(
        ["aws", "ssm", "get-parameter",
         "--name", f"{SSM_PREFIX}/{name}", "--with-decryption",
         "--query", "Parameter.Value", "--output", "text"],
        capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else ""


def resolve(dest: str, *candidates: str) -> str:
    cur = os.environ.get(dest, "")
    if cur and cur != "None":
        return cur
    for c in candidates:
        v = read_ssm(c)
        if v and v != "None":
            return v
    return ""


if not shutil.which("aws") or subprocess.run(
        ["aws", "sts", "get-caller-identity"],
        capture_output=True).returncode:
    print("ERROR: AWS CLI not authenticated — export keys manually or "
          "fix AWS creds.", file=sys.stderr)
    sys.exit(1)
if not shutil.which("kubectl"):
    print("ERROR: kubectl not found.", file=sys.stderr)
    sys.exit(1)

keys = {
    "FACEBOOK_APP_ID": resolve("FACEBOOK_APP_ID", "FACEBOOK_APP_ID"),
    "FACEBOOK_APP_SECRET": resolve("FACEBOOK_APP_SECRET",
                                   "FACEBOOK_APP_SECRET"),
    "LINKEDIN_CLIENT_ID": resolve("LINKEDIN_CLIENT_ID",
                                  "LINKEDIN_CLIENT_ID"),
    "LINKEDIN_CLIENT_SECRET": resolve("LINKEDIN_CLIENT_SECRET",
                                      "LINKEDIN_CLIENT_SECRET"),
    "X_API_KEY": resolve("X_API_KEY", "X_API_KEY"),
    "X_API_SECRET": resolve("X_API_SECRET", "X_API_SECRET"),
    "TIKTOK_CLIENT_ID": resolve(
        "TIKTOK_CLIENT_ID", "TIKTOK_CLIENT_ID", "TIKTOK_APP_ID",
        "tiktok-client-key"),
    "TIKTOK_CLIENT_SECRET": resolve(
        "TIKTOK_CLIENT_SECRET", "TIKTOK_CLIENT_SECRET",
        "TIKTOK_APP_SECRET", "tiktok-client-secret"),
    "POSTIZ_API_KEY": resolve("POSTIZ_API_KEY", "POSTIZ_API_KEY"),
}

# Preserve existing POSTIZ_API_KEY from the live secret if SSM/env
# missing.
if not keys["POSTIZ_API_KEY"]:
    r = subprocess.run(
        ["kubectl", "-n", NAMESPACE, "get", "secret", SECRET_NAME,
         "-o", "jsonpath={.data.POSTIZ_API_KEY}"],
        capture_output=True, text=True)
    try:
        keys["POSTIZ_API_KEY"] = base64.b64decode(
            r.stdout.strip()).decode()
    except Exception:
        pass

found = [k for k, v in keys.items() if v]
missing = [k for k, v in keys.items() if not v]

if not found:
    print("ERROR: no provider keys resolved.", file=sys.stderr)
    sys.exit(1)

print(f"Will upsert secret/{SECRET_NAME} in ns/{NAMESPACE} with: "
      f"{' '.join(found)}")
if missing:
    print(f"Missing (channel connect for these will fail until set): "
          f"{' '.join(missing)}")


def kubectl(*args: str) -> None:
    subprocess.run(["kubectl", *args], check=True)


kubectl("-n", NAMESPACE, "delete", "secret", SECRET_NAME,
        "--ignore-not-found")
kubectl("-n", NAMESPACE, "create", "secret", "generic", SECRET_NAME,
        *[f"--from-literal={k}={keys[k]}" for k in found])
kubectl("-n", NAMESPACE, "rollout", "restart", "deploy/postiz")
kubectl("-n", NAMESPACE, "rollout", "status", "deploy/postiz",
        "--timeout=180s")

print("Verify env keys present in pod (names only):")
check = "; ".join(
    f'if [ -n "$(printenv {k})" ]; then echo "  OK {k}"; '
    f'else echo "  MISSING {k}"; fi' for k in keys)
subprocess.run(["kubectl", "-n", NAMESPACE, "exec", "deploy/postiz",
                "--", "sh", "-c", check])

print("""
Next: connect channels in https://postiz.cloudless.gr
  Redirect URI: https://postiz.cloudless.gr/integrations/social/<provider>
  P0: linkedin (page), x, facebook+instagram, bluesky (no env)""")
