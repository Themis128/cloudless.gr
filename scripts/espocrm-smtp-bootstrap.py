#!/usr/bin/env python3
"""espocrm-smtp-bootstrap.py — DEPRECATED 2026-09-20

EspoCRM mail now runs entirely on the omv-ha stack — inbound IMAPS
993 + outbound postfix 587 via the InboundEmail entity's smtp*
fields (see infrastructure/espocrm/README.md and
docs/EMAIL-INFRASTRUCTURE.md). This script still pulls SES_SMTP_*
from AWS SSM — a path that no longer exists. Kept for history only;
do not run.

Original purpose: configured EspoCRM outbound SMTP via the API (PHP
config, not env vars)."""

import base64
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

REGION = os.environ.get("AWS_REGION", "us-east-1")
ESPOCRM_BASE_URL = os.environ.get("ESPOCRM_BASE_URL", "https://espocrm.cloudless.gr")


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

admin_user = os.environ.get("ESPOCRM_ADMIN_USER", "tbaltzakis")
admin_pass = os.environ.get("ESPOCRM_ADMIN_PASSWORD") or ssm_get("ESPOCRM_ADMIN_PASSWORD")

for name, val in (("USER", user), ("PASS", password), ("ADMIN_PASS", admin_pass)):
    if not val:
        print(f"✗ Missing required value: {name}")
        if name in ("USER", "PASS"):
            print("  Run `pnpm ses:provision` first to populate SES_SMTP_USER/PASSWORD.")
        else:
            print("  Set ESPOCRM_ADMIN_PASSWORD env var OR put it in SSM at")
            print("  /cloudless/production/ESPOCRM_ADMIN_PASSWORD")
        sys.exit(1)

print(f"→ PATCHing EspoCRM SMTP settings at {ESPOCRM_BASE_URL}")
print(f"  as admin: {admin_user}  via HTTP basic")


auth = base64.b64encode(f"{admin_user}:{admin_pass}".encode()).decode()


def call(method: str, path: str, body: dict) -> tuple[int, bytes]:
    req = urllib.request.Request(
        f"{ESPOCRM_BASE_URL}{path}",
        data=json.dumps(body).encode(),
        method=method,
        headers={"Authorization": f"Basic {auth}", "Content-Type": "application/json"},
    )
    try:
        r = urllib.request.urlopen(req, timeout=20)
        return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as e:
        return 0, str(e).encode()


code, resp = call(
    "PUT",
    "/api/v1/Settings",
    {
        "outboundEmailFromAddress": from_email,
        "outboundEmailFromName": "Cloudless",
        "smtpServer": host,
        "smtpPort": 587,
        "smtpAuth": True,
        "smtpSecurity": "TLS",
        "smtpUsername": user,
        "smtpPassword": password,
    },
)

if 200 <= code < 300:
    print(f"  ✓ EspoCRM SMTP configured (HTTP {code})")
else:
    print(f"  ✗ HTTP {code}")
    print(resp.decode(errors="replace"))
    sys.exit(1)

print("→ Sending test email to tbaltzakis@cloudless.gr")
code, resp = call(
    "POST",
    "/api/v1/Email/sendTest",
    {
        "server": host,
        "port": 587,
        "auth": True,
        "security": "TLS",
        "username": user,
        "password": password,
        "fromAddress": from_email,
        "emailAddress": "tbaltzakis@cloudless.gr",
    },
)
print(f"  test HTTP {code}")
print(resp.decode(errors="replace"))
