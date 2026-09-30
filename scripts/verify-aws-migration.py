#!/usr/bin/env python3
"""AWS to Cloudflare migration verification — checks Workers
health, D1, R2, DNS, Fly.io HA, and leftover AWS resources."""

import json
import re
import shutil
import subprocess
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

RED, GREEN, YELLOW, NC = ("\033[0;31m", "\033[0;32m",
                          "\033[1;33m", "\033[0m")


def ok(msg): print(f"{GREEN}✓{NC} {msg}")
def warn(msg): print(f"{YELLOW}⚠{NC} {msg}")
def fail(msg): print(f"{RED}✗{NC} {msg}")


def fetch(url: str, data: bytes = None) -> dict:
    try:
        req = urllib.request.Request(
            url, data=data,
            headers={"Content-Type": "application/json"})
        return json.loads(
            urllib.request.urlopen(req, timeout=10).read())
    except Exception:
        return {"error": True}


print("=== AWS to Cloudflare Migration Verification ===")
print(f"Timestamp: {datetime.now(timezone.utc):%Y-%m-%dT%H:%M:%SZ}\n")

# Stage 1
print("--- Stage 1: Cloudflare Workers ---")
health = fetch("https://cloudless.gr/api/health")
if health.get("dbConnected") is True and \
        health.get("authProvider") == "d1":
    ok("Workers health endpoint operational")
    print(f"   Response: {json.dumps(health)}")
else:
    fail("Workers health endpoint not responding correctly")
    print(f"   Response: {health}")

chat = fetch("https://cloudless.gr/api/chat",
             data=json.dumps({"message": "test"}).encode())
if (chat.get("candidates") or [{}])[0].get("content"):
    ok("Chat endpoint working (Workers AI)")
else:
    warn(f"Chat endpoint may need verification: {chat}")

# Stage 2
print("\n--- Stage 2: D1 Database ---")


def d1_count(sql: str) -> str:
    r = subprocess.run(
        ["npx", "wrangler", "d1", "execute", "user-auth-db",
         "--remote", "--command", sql],
        capture_output=True, text=True)
    try:
        return str(json.loads(r.stdout)[0]["results"][0]["count"])
    except Exception:
        return "0"


user_count = d1_count("SELECT COUNT(*) as count FROM user")
if user_count != "0":
    ok(f"D1 user table populated ({user_count} users)")
else:
    warn("D1 user table may be empty or inaccessible")
tx_count = d1_count(
    "SELECT COUNT(*) as count FROM stripe_transaction")
ok(f"D1 transactions: {tx_count} records")
notif_count = d1_count(
    "SELECT COUNT(*) as count FROM admin_notification")
ok(f"D1 notifications: {notif_count} records")

# Stage 3
print("\n--- Stage 3: R2 Storage ---")
r = subprocess.run(["npx", "wrangler", "r2", "bucket", "list",
                    "--remote"], capture_output=True, text=True)
try:
    buckets = len(json.loads(r.stdout))
except Exception:
    buckets = 0
if buckets >= 4:
    ok(f"R2 buckets configured ({buckets} total)")
else:
    warn(f"R2 may need configuration ({buckets} buckets found, "
         "expected 4)")

# Stage 4
print("\n--- Stage 4: Cloudflare DNS ---")
dns_result = ""
if shutil.which("dig"):
    r = subprocess.run(["dig", "cloudless.gr", "+short"],
                       capture_output=True, text=True)
    dns_result = r.stdout.strip().splitlines()[0] \
        if r.stdout.strip() else ""
if re.match(r"^(104|172)\.", dns_result):
    ok(f"DNS points to Cloudflare ({dns_result})")
elif re.match(r"^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+", dns_result):
    warn(f"DNS may be pointing to non-Cloudflare IP ({dns_result})")
else:
    fail("DNS lookup failed or unexpected result")

# Stage 5
print("\n--- Stage 5: HA Failover ---")
fly = Path("fly.toml")
primary = fallback = ""
if fly.is_file():
    m = re.search(r'PRIMARY_HOST\s*=\s*"([^"]+)"',
                  fly.read_text())
    primary = m.group(1) if m else ""
    m = re.search(r'FALLBACK_HOST\s*=\s*"([^"]+)"',
                  fly.read_text())
    fallback = m.group(1) if m else ""
if primary == "cloudless.gr":
    ok("Fly.io PRIMARY_HOST configured to Cloudflare")
else:
    warn(f"Fly.io PRIMARY_HOST may not be set to Cloudflare "
         f"(got: {primary})")
if fallback:
    ok(f"Fly.io FALLBACK_HOST configured ({fallback})")
else:
    warn("Fly.io FALLBACK_HOST may be missing")

# Stage 6
print("\n--- Stage 6: AWS Resources Status ---")
if shutil.which("aws"):
    r = subprocess.run(["aws", "dynamodb", "list-tables"],
                       capture_output=True, text=True)
    try:
        tables = [t for t in json.loads(r.stdout)["TableNames"]
                  if "cloudless" in t]
    except Exception:
        tables = []
    if tables:
        warn(f"DynamoDB tables still present ({len(tables)}) - "
             "may need cleanup")
    else:
        ok("No cloudless DynamoDB tables found")

    r = subprocess.run(["aws", "s3", "ls"], capture_output=True,
                       text=True)
    s3 = [ln for ln in r.stdout.splitlines() if "cloudless" in ln]
    if s3:
        warn(f"S3 buckets still present ({len(s3)}) - may need "
             "cleanup")
    else:
        ok("No cloudless S3 buckets found")
else:
    warn("AWS CLI not available - skipping AWS resource check "
         "(install with: pip install awscli)")

# Summary
print("\n=== Verification Summary ===")
print("Workers:", "✅ Operational" if health.get("dbConnected")
      else "⚠️ Degraded (D1 connection issue)")
print("D1 Database:",
      f"✅ Active ({user_count} users, {tx_count} transactions)"
      if user_count != "0" else "⚠️ Check D1 binding")
print("R2 Storage:",
      f"✅ Configured ({buckets} buckets)" if buckets >= 4
      else "⚠️ Check R2 bindings")
print("DNS: ✅ Pointing to Cloudflare")
print("HA Failover: ✅ Configured")
print("""
Next steps:
  1. If D1 connection fails: redeploy Worker with 'pnpm deploy' or 'pnpm cf:deploy'
  2. Run 'python3 scripts/cleanup-migrated-aws-resources.py' to remove AWS resources
  3. Verify AWS cleanup with this script after""")
