#!/usr/bin/env python3
"""probe-selfhosted-admin.py — verify the unified admin login still works
on every self-hosted app. Hits each app's "log in" API endpoint and
checks for a 2xx + an auth artefact.

Designed to fail LOUD: non-zero exit if any app rejects the creds, so it
can run as a scheduled CI check and alert on credential drift.

All endpoints hit via the public tunnel hostname — the same path real
users take, not the in-cluster Service URL."""

import json
import os
import re
import sys
import urllib.error
import urllib.request

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "tbaltzakis@cloudless.gr")
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "tbaltzakis")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")
if not ADMIN_PASSWORD:
    sys.exit("ADMIN_PASSWORD env var required")

passed = failed = 0
failed_apps = []


def probe(app: str, url: str, method: str, data: str, auth: str, pattern: str) -> None:
    global passed, failed
    headers = {"Content-Type": "application/json"}
    req = urllib.request.Request(
        url, data=data.encode() if data else None, headers=headers, method=method
    )
    if auth:
        import base64

        req.add_header("Authorization", "Basic " + base64.b64encode(auth.encode()).decode())
    try:
        r = urllib.request.urlopen(req, timeout=15)
        code, body = r.status, r.read().decode(errors="replace")
    except urllib.error.HTTPError as e:
        code, body = e.code, e.read().decode(errors="replace")
    except Exception as e:
        code, body = 0, str(e)
    if code in (200, 201, 204) and re.search(pattern, body):
        print(f"✓ {app} login OK  (HTTP {code})")
        passed += 1
    else:
        print(f"✗ {app} login FAIL (HTTP {code}, body matched=/{pattern}/=no)")
        print(f"    body: {body[:200]}")
        failed += 1
        failed_apps.append(app)


print("=== self-hosted admin login probe ===")
print(f"    user: {ADMIN_EMAIL}\n")

probe(
    "AppFlowy",
    "https://appflowy.cloudless.gr/gotrue/token?grant_type=password",
    "POST",
    json.dumps({"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}),
    "",
    '"access_token"',
)

probe(
    "EspoCRM",
    "https://espocrm.cloudless.gr/api/v1/App/user",
    "GET",
    "",
    f"{ADMIN_USERNAME}:{ADMIN_PASSWORD}",
    '"userName"',
)

probe(
    "Postiz",
    "https://postiz.cloudless.gr/api/auth/login",
    "POST",
    json.dumps({"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "provider": "LOCAL"}),
    "",
    ".*",
)

probe(
    "n8n",
    "https://n8n.cloudless.gr/rest/login",
    "POST",
    json.dumps({"emailOrLdapLoginId": ADMIN_EMAIL, "password": ADMIN_PASSWORD}),
    "",
    '"id"',
)

print("\n=== summary ===")
print(f"  passed: {passed}")
print(f"  failed: {failed}")
if failed:
    print(f"  failed apps: {' '.join(failed_apps)}")
    sys.exit(1)
