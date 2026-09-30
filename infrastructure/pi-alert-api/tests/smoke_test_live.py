#!/usr/bin/env python3
"""Live end-to-end smoke test for the alert-api → Slack pipeline.

Port of smoke_test_live.sh — pure stdlib (no curl/jq dependency).

What it does:
  1. POSTs a synthetic Alertmanager-shaped payload to the live alert-api
     webhook (NodePort 30800 on omv-main).
  2. Polls the alert-api DB through /api/alerts to confirm the alert was
     persisted with the verbose multi-line message body.
  3. Resolves the synthetic alert so it doesn't linger in the active set.
  4. Asserts the verbose-rendered fields are present.

Run from a host that can reach 192.168.1.128:30800, or set ALERT_API_URL.

Usage:
  python3 smoke_test_live.py
  ALERT_API_URL=http://alert-api.alert-manager:8080 python3 smoke_test_live.py

Exit codes:
  0  all assertions passed; check Slack to visually confirm the message
  1  webhook returned non-200 OR alert never reached the DB
  2  DB row missing expected fields (Value, Instance, Target/Probe, Runbook)
"""

import json
import os
import sys
import time
import urllib.request

ALERT_API_URL = os.environ.get("ALERT_API_URL", "http://192.168.1.128:30800")
SMOKE_CODE = f"SMOKETEST_{int(time.time())}"


def http(url: str, method: str = "GET", payload: dict | None = None, timeout: int = 10) -> tuple[int, str]:
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")
    except Exception as e:
        return 0, str(e)


print(f"==> Sending synthetic alert: code={SMOKE_CODE} url={ALERT_API_URL}")

payload = {
    "alerts": [{
        "status": "firing",
        "labels": {
            "alertname": SMOKE_CODE,
            "severity": "warning",
            "target": "cloudless.gr",
            "probe": "esp32-https",
            "instance": "smoke-test-cli",
        },
        "annotations": {
            "summary": f"{SMOKE_CODE} — e2e verification of alert-api v3.3 verbose rendering",
            "description": (
                "This is a synthetic alert from infrastructure/pi-alert-api/tests/smoke_test_live.py\n\n"
                "If you see this in #alerts as a multi-line message with Value, Instance, "
                "Target/Probe, Runbook, and Source fields, the alert-api → Slack pipeline is healthy.\n\n"
                "Will be auto-resolved by the smoke test within ~10 seconds."
            ),
            "runbook_url": "https://github.com/Themis128/cloudless.gr/blob/main/infrastructure/pi-alert-api/tests/smoke_test_live.py",
        },
        "generatorURL": "http://prometheus.monitoring.svc.cluster.local:9090/graph",
    }]
}

code, body = http(f"{ALERT_API_URL}/api/alertmanager/webhook", "POST", payload)
try:
    ok = json.loads(body).get("ok") is True
except json.JSONDecodeError:
    ok = False
if not ok:
    print(f"FAIL: webhook returned: {body}")
    sys.exit(1)
print(f"    webhook OK: {body}")

# ── give the alert-api a moment to persist + Slack ───────────────────────
time.sleep(3)

# ── verify DB row ────────────────────────────────────────────────────────
print("==> Verifying alert landed in DB...")
_, body = http(f"{ALERT_API_URL}/api/alerts?status=active", timeout=5)
try:
    alerts = json.loads(body)
except json.JSONDecodeError:
    alerts = []
alert_row = next((a for a in alerts if a.get("code") == SMOKE_CODE), None)

if not alert_row:
    print(f"FAIL: alert {SMOKE_CODE} not found in active alerts")
    sys.exit(1)

message = alert_row.get("message", "")

# Assert each verbose-rendering field is present.
errors = 0
for needle in (
    "e2e verification of alert-api v3.3",
    "*Instance:* `smoke-test-cli`",
    "*Target / Probe:* `cloudless.gr` / `esp32-https`",
    "📖 *Runbook:*",
    "📊 *Source:*",
):
    if needle in message:
        print(f"    ✓ {needle}")
    else:
        print(f"    ✗ MISSING: {needle}")
        errors += 1

if errors:
    print(f"\nFAIL: {errors} expected fields missing from rendered message:")
    print("--- BEGIN MESSAGE ---")
    print(message)
    print("--- END MESSAGE ---")
    sys.exit(2)

# ── resolve so it doesn't pollute the active list ────────────────────────
print("==> Resolving smoke alert")
http(f"{ALERT_API_URL}/api/alerts/{SMOKE_CODE}/resolve", "POST", {}, timeout=5)
print("    resolved")

print("\nPASS — alert-api v3.3 verbose rendering is healthy end-to-end.")
print("      Visually confirm the message landed in your #alerts channel.")
