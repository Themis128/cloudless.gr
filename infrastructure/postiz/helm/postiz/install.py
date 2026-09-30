#!/usr/bin/env python3
"""Idempotent Postiz installer for the omv-main k3s cluster.

Port of install.sh.

Run from the repo root, with KUBECONFIG already set.

What this does, in order:
  1. Create namespace `postiz` if missing.
  2. Bootstrap the `postiz-secrets` Secret if missing (JWT_SECRET +
     POSTGRES_PASSWORD generated via secrets module).
  3. Bootstrap the `postiz-providers` Secret from environment variables
     (FACEBOOK_APP_ID/SECRET, LINKEDIN_*, X_API_KEY/SECRET, TIKTOK_*).
     Skipped quietly if none are set — the Deployment marks it optional.
  4. helm upgrade --install postiz ./helm/postiz -n postiz -f values-prod.yaml
  5. Smoke check — wait for pod readiness and probe the in-cluster Service.

Re-run any time — secrets are only created once; helm upgrade is a no-op
when nothing changed.
"""

import os
import secrets
import shutil
import subprocess
import sys
from pathlib import Path

NAMESPACE = os.environ.get("NAMESPACE", "postiz")
RELEASE = os.environ.get("RELEASE", "postiz")
CHART_DIR = Path(__file__).resolve().parent
VALUES_FILE = CHART_DIR / "values-prod.yaml"


def bold(msg: str) -> None:
    print(f"\033[1m{msg}\033[0m")


def warn(msg: str) -> None:
    print(f"\033[33mWARN: {msg}\033[0m", file=sys.stderr)


def die(msg: str) -> None:
    print(f"\033[31mERR: {msg}\033[0m", file=sys.stderr)
    sys.exit(1)


def run(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(list(args), capture_output=True, text=True, check=check)


def kubectl(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return run("kubectl", *args, check=check)


for tool in ("kubectl", "helm", "openssl"):
    if not shutil.which(tool):
        die(f"{tool} not on PATH")

bold("==> 1. namespace")
if kubectl("get", "ns", NAMESPACE, check=False).returncode != 0:
    kubectl("create", "namespace", NAMESPACE)

bold("==> 2. postiz-secrets")
if kubectl("-n", NAMESPACE, "get", "secret", "postiz-secrets", check=False).returncode == 0:
    print("    already exists — leaving it alone (rotate via kubectl edit)")
else:
    jwt = secrets.token_hex(32)
    pgpw = secrets.token_hex(24)
    kubectl(
        "-n",
        NAMESPACE,
        "create",
        "secret",
        "generic",
        "postiz-secrets",
        f"--from-literal=JWT_SECRET={jwt}",
        f"--from-literal=POSTGRES_PASSWORD={pgpw}",
    )
    print("    created (32-byte JWT + 24-byte Postgres password)")

bold("==> 3. postiz-providers (from environment)")
# AWS SSM retired — provider keys come from the environment / Cloudflare
# secrets pipeline now. Any unset keys are skipped.
provider_keys = {
    "FACEBOOK_APP_ID": ["FACEBOOK_APP_ID"],
    "FACEBOOK_APP_SECRET": ["FACEBOOK_APP_SECRET"],
    "LINKEDIN_CLIENT_ID": ["LINKEDIN_CLIENT_ID"],
    "LINKEDIN_CLIENT_SECRET": ["LINKEDIN_CLIENT_SECRET"],
    "X_API_KEY": ["X_API_KEY"],
    "X_API_SECRET": ["X_API_SECRET"],
    "TIKTOK_CLIENT_ID": ["TIKTOK_CLIENT_ID", "TIKTOK_APP_ID"],
    "TIKTOK_CLIENT_SECRET": ["TIKTOK_CLIENT_SECRET", "TIKTOK_APP_SECRET"],
    "POSTIZ_API_KEY": ["POSTIZ_API_KEY"],
}
literals: list[str] = []
for dest, candidates in provider_keys.items():
    for cand in candidates:
        v = os.environ.get(cand, "")
        if v and v != "None":
            literals.append(f"--from-literal={dest}={v}")
            break

if literals:
    if kubectl("-n", NAMESPACE, "get", "secret", "postiz-providers", check=False).returncode == 0:
        kubectl("-n", NAMESPACE, "delete", "secret", "postiz-providers")
    kubectl("-n", NAMESPACE, "create", "secret", "generic", "postiz-providers", *literals)
    print(f"    upserted {len(literals)} provider keys")
else:
    warn("    no provider keys in environment — skipping")

bold("==> 4. helm upgrade --install")
run(
    "helm",
    "upgrade",
    "--install",
    RELEASE,
    str(CHART_DIR),
    "-n",
    NAMESPACE,
    "-f",
    str(VALUES_FILE),
    "--wait",
    "--timeout",
    "5m",
)

bold("==> 5. smoke")
kubectl("-n", NAMESPACE, "rollout", "status", "deploy/postiz", "--timeout=120s")
r = kubectl(
    "-n", NAMESPACE, "get", "pod", "-l", "app=postiz", "-o", "jsonpath={.items[0].metadata.name}"
)
pod = (r.stdout or "").strip()
print(f"    pod: {pod}")
if pod:
    if (
        kubectl(
            "-n",
            NAMESPACE,
            "exec",
            pod,
            "--",
            "wget",
            "-q",
            "-O",
            "-",
            "http://localhost:5000",
            check=False,
        ).returncode
        != 0
    ):
        warn("    in-cluster GET / failed — check pod logs")

bold("==> done")
print(f"""
  Postiz endpoint (in-cluster):  http://postiz.{NAMESPACE}.svc.cluster.local:5000
  NodePort on omv-main:          http://192.168.1.128:30500
  Public URL (Cloudflare tunnel): https://postiz.cloudless.gr

  Verify channels:  curl -H "Authorization: $POSTIZ_API_KEY" https://postiz.cloudless.gr/api/public/v1/integrations
  Tail logs:        kubectl -n {NAMESPACE} logs deploy/postiz -f --tail=100
""")
