#!/usr/bin/env python3
"""probe-lead-enrich.py — dry-run the EspoCRM Lead → n8n → Apollo
enrich loop.

1. Reads NOTION_WEBHOOK_SECRET from SSM (the internal-webhook secret
   reused by the n8n trigger receiver).
2. POSTs a synthetic Lead payload to /api/webhooks/n8n/trigger with
   the lead-enrich alias.
3. Surfaces the response code + body (200 fired, 204 workflow ID not
   set in SSM, 4xx/5xx failed).
4. Optionally tails the n8n executions API if N8N creds are in SSM.

Usage:
  python3 scripts/probe-lead-enrich.py          # hits production
  BASE_URL=https://staging.cloudless.gr \
      python3 scripts/probe-lead-enrich.py"""

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

BASE_URL = os.environ.get("BASE_URL", "https://cloudless.gr")


def ssm(name: str, decrypt: bool = True) -> str:
    args = [
        "aws",
        "ssm",
        "get-parameter",
        "--name",
        f"/cloudless/production/{name}",
        "--query",
        "Parameter.Value",
        "--output",
        "text",
    ]
    if decrypt:
        args.append("--with-decryption")
    r = subprocess.run(args, capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else ""


secret = ssm("NOTION_WEBHOOK_SECRET")
if not secret:
    sys.exit("ERROR: NOTION_WEBHOOK_SECRET not in SSM — cannot authenticate the probe.")

payload = json.dumps(
    {
        "name": "lead-enrich",
        "payload": {
            "entity": "Lead",
            "action": "create",
            "record": {
                "id": f"probe-lead-{int(time.time())}",
                "firstName": "Probe",
                "lastName": "Lead",
                "emailAddress": "probe+leadenrich@cloudless.gr",
                "accountName": "Probe Co",
            },
        },
    }
).encode()

print(f"=== POST {BASE_URL}/api/webhooks/n8n/trigger ===")
req = urllib.request.Request(
    f"{BASE_URL}/api/webhooks/n8n/trigger",
    data=payload,
    method="POST",
    headers={"Content-Type": "application/json", "x-n8n-trigger-secret": secret},
)
try:
    resp = urllib.request.urlopen(req, timeout=20)
    code, body = resp.status, resp.read()[:200]
except urllib.error.HTTPError as e:
    code, body = e.code, e.read()[:200]
except Exception as e:
    sys.exit(f"request failed: {e}")

print(f"HTTP {code}")
text = body.decode(errors="replace")
if code == 200:
    print(f"✅ workflow fired — {text}")
elif code == 204:
    print(
        "ℹ️  workflow ID not in SSM yet — graceful no-op; see infrastructure/n8n/workflows/README.md"
    )
elif code == 401:
    print("❌ secret rejected (NOTION_WEBHOOK_SECRET mismatch between SSM + receiver)")
elif code == 503:
    print("❌ n8n not configured (N8N_API_URL or N8N_API_KEY missing in SSM)")
elif code == 502:
    print(f"❌ n8n upstream failed — {text}")
else:
    print(f"❌ unexpected: {text}")

n8n_key = ssm("N8N_API_KEY")
n8n_url = ssm("N8N_API_URL", decrypt=False)
if n8n_key and n8n_url:
    print("\n=== Most recent n8n execution ===")
    req = urllib.request.Request(
        f"{n8n_url.rstrip('/')}/api/v1/executions?limit=1&includeData=false",
        headers={"X-N8N-API-KEY": n8n_key},
    )
    try:
        data = json.loads(urllib.request.urlopen(req, timeout=15).read())
        execs = data.get("data", [])
        if not execs:
            print("  no executions yet")
        else:
            e = execs[0]
            print(
                f"  id={e.get('id')} workflow={e.get('workflowId')} "
                f"status={e.get('status')} "
                f"started={e.get('startedAt')}"
            )
    except Exception as e:
        print(f"  executions fetch failed: {e}")
