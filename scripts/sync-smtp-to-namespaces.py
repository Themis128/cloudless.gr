#!/usr/bin/env python3
"""sync-smtp-to-namespaces.py — pulls SES SMTP creds from SSM and
writes a `smtp-credentials` Secret into every namespace hosting a
self-hosted app needing transactional email:

  appflowy   — GoTrue magic links
  espocrm    — outbound notifications + IMAP sync replies
  postiz     — password reset, invites
  n8n        — password reset, workflow-failure alerts
  monitoring — Grafana alert emails

Source SSM keys:
  /cloudless/production/SES_SMTP_USER, SES_SMTP_PASSWORD,
  SES_FROM_EMAIL (default noreply@cloudless.gr),
  SES_SMTP_HOST (default email-smtp.<region>.amazonaws.com)

Usage:
  python3 scripts/sync-smtp-to-namespaces.py           # all 5 ns
  python3 scripts/sync-smtp-to-namespaces.py appflowy  # one ns"""

import os
import subprocess
import sys

REGION = os.environ.get("AWS_REGION", "us-east-1")
NAMESPACES = sys.argv[1:] or ["appflowy", "espocrm", "postiz", "n8n", "monitoring"]


def ssm_get(key: str, default: str = "") -> str:
    r = subprocess.run(
        [
            "aws",
            "ssm",
            "get-parameter",
            "--region",
            REGION,
            "--name",
            f"/cloudless/production/{key}",
            "--with-decryption",
            "--query",
            "Parameter.Value",
            "--output",
            "text",
        ],
        capture_output=True,
        text=True,
    )
    v = r.stdout.strip()
    return default if not v or v == "None" else v


user = ssm_get("SES_SMTP_USER")
password = ssm_get("SES_SMTP_PASSWORD")
from_email = ssm_get("SES_FROM_EMAIL", "noreply@cloudless.gr")
host = ssm_get("SES_SMTP_HOST", f"email-smtp.{REGION}.amazonaws.com")
port = "587"

if not user or not password:
    sys.exit(
        "✗ SES_SMTP_USER and/or SES_SMTP_PASSWORD missing from "
        "SSM.\n  Provision them once with:  pnpm ses:provision"
    )

print(f"→ Syncing smtp-credentials Secret to {len(NAMESPACES)} namespace(s)")
print(f"  host={host} port={port} from={from_email} user={user[:6]}…\n")

for ns in NAMESPACES:
    if (
        subprocess.call(
            ["kubectl", "get", "ns", ns], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
        != 0
    ):
        print(f"  ⚠  namespace {ns} not found — skipping")
        continue

    r = subprocess.run(
        [
            "kubectl",
            "create",
            "secret",
            "generic",
            "smtp-credentials",
            f"--namespace={ns}",
            f"--from-literal=SMTP_HOST={host}",
            f"--from-literal=SMTP_PORT={port}",
            f"--from-literal=SMTP_USER={user}",
            f"--from-literal=SMTP_PASSWORD={password}",
            f"--from-literal=SMTP_FROM={from_email}",
            "--dry-run=client",
            "-o",
            "yaml",
        ],
        capture_output=True,
        text=True,
    )
    apply = subprocess.run(
        ["kubectl", "apply", "-f", "-"], input=r.stdout, text=True, capture_output=True
    )
    if apply.returncode != 0:
        print(f"  ✗ {ns} apply failed: {apply.stderr.strip()}")
        continue
    print(f"  ✓ {ns}/smtp-credentials applied")

    # IMPORTANT — DELETE the pod, don't `rollout restart`.
    # secretKeyRef.optional=true env vars resolve ONCE at pod-start;
    # if the Secret didn't exist then, kubelet silently omits the
    # env var and a rollout restart is a no-op. Deleting the pod
    # forces fresh env resolution. (Bug surfaced 2026-06-21.)
    deps = subprocess.run(
        ["kubectl", "-n", ns, "get", "deploy", "-o", "name"], capture_output=True, text=True
    ).stdout.split()
    for dep in deps:
        y = subprocess.run(
            ["kubectl", "-n", ns, "get", dep, "-o", "yaml"], capture_output=True, text=True
        ).stdout
        if "secretKeyRef" not in y or "smtp-credentials" not in y:
            continue
        dep_name = dep.split("/", 1)[-1]
        pods = []
        for sel in (f"app={dep_name}", f"app.kubernetes.io/name={dep_name}"):
            pods += subprocess.run(
                ["kubectl", "-n", ns, "get", "pod", "-l", sel, "-o", "name"],
                capture_output=True,
                text=True,
            ).stdout.split()
        for pod in set(pods):
            subprocess.run(
                ["kubectl", "-n", ns, "delete", pod, "--wait=false"], capture_output=True
            )
            print(f"    ↻ deleted {pod} (forces fresh env resolution)")

print("\nDone. To verify, send a test email from each app's admin UI.")
