#!/usr/bin/env python3
"""Secret Verification Script for Cloudless.gr ETL.
Run after configuring Wrangler secrets to verify everything is in place.
Usage: python3 scripts/verify-secrets.py"""

import json
import os
import subprocess
import urllib.error
import urllib.request

print("=== Cloudless.gr ETL Secret Verification ===\n")


def run(cmd: list[str]) -> str:
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=60).stdout
    except Exception as e:
        return str(e)


# 1. Wrangler secrets
print("1. Wrangler Secrets Status:")
out = run(["npx", "wrangler", "secret", "list"])
try:
    secrets = json.loads(out)
    for s in secrets:
        print(f"  - {s.get('name')}: {s.get('type')}")
except Exception:
    print("  (No secrets configured)")

# 2. Required secrets
print("\n2. Required Secrets Check:")
required = ["ESPOCRM_API_KEY", "ESPOCRM_API_PASSWORD", "SLACK_WEBHOOK_URL", "POSTIZ_API_KEY"]
print("  Configuration Status:")
print("    [x] ESPOCRM_BASE_URL - (already in D1 app_config - NOT a secret)\n")
print("  Secrets that require interactive configuration:")
for s in required:
    print(f"    [ ] {s} - (run: npx wrangler secret put {s})")

# 3. D1 app_config
print("\n3. D1 app_config Values:")
out = run(
    [
        "npx",
        "wrangler",
        "d1",
        "execute",
        "user-auth-db",
        "--remote",
        "--command",
        "SELECT key, value FROM app_config;",
    ]
)
try:
    idx = out.index("[")
    results = json.loads(out[idx:])
    for r in results[0].get("results", []):
        print(f"  - {r.get('key')}: {r.get('value')}")
except Exception:
    print("  (Query failed or no results)")

# 4. R2 buckets
print("\n4. R2 Buckets Status:")
out = run(["npx", "wrangler", "r2", "bucket", "list"])
lines = [f"  - {ln.split(':', 1)[1].strip()}" for ln in out.splitlines() if ln.startswith("name:")]
print("\n".join(lines) if lines else "  (R2 listing unavailable)")

# 5. EspoCRM connectivity
print("\n5. Quick ETL Test (dry-run):")
print("  Running pre-flight check for ESPOCRM connectivity...")
base = os.environ.get("ESPOCRM_BASE_URL")
if base:
    try:
        req = urllib.request.Request(f"{base}/api/v1/App/user")
        code = urllib.request.urlopen(req, timeout=15).status
    except urllib.error.HTTPError as e:
        code = e.code
    except Exception:
        code = None
    print(f"  HTTP {code}" if code else "  (ESPOCRM unreachable - check tunnel)")
else:
    print("  (ESPOCRM_BASE_URL not set locally - uses Wrangler secret in production)")

print("""
=== Verification Complete ===

To configure missing secrets, run:
  npx wrangler secret put ESPOCRM_API_KEY
  npx wrangler secret put ESPOCRM_API_PASSWORD
  npx wrangler secret put SLACK_WEBHOOK_URL
  npx wrangler secret put POSTIZ_API_KEY

Note: ESPOCRM_BASE_URL is stored in D1 app_config (not a secret)""")
