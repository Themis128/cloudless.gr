#!/usr/bin/env python3
"""Performance test for Cloudflare Workers deployment — sustained
throughput check for the ~100K requests/day (~1.16 req/s) target.

Usage:
  python3 scripts/perf-test-workers.py [BASE_URL] [ITERATIONS]
      [CONCURRENCY] [REPORT_FILE]"""

import json
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path

BASE_URL = (
    sys.argv[1]
    if len(sys.argv) > 1
    else "https://cloudless-gr-staging.baltzakis-themis.workers.dev"
)
ITERATIONS = int(sys.argv[2]) if len(sys.argv) > 2 else 50
CONCURRENCY = int(sys.argv[3]) if len(sys.argv) > 3 else 5
REPORT_FILE = sys.argv[4] if len(sys.argv) > 4 else "/tmp/workers-perf-report.json"

print("=== Cloudflare Workers Performance Test ===")
print(f"Target: {BASE_URL}")
print(f"Iterations: {ITERATIONS}")
print(f"Concurrency: {CONCURRENCY}")
print("==========================================\n")


def timed_get(url: str) -> tuple[int, int]:
    """Return (status, elapsed_ms)."""
    t0 = time.monotonic()
    try:
        code = urllib.request.urlopen(url, timeout=15).status
    except urllib.error.HTTPError as e:
        code = e.code
    except Exception:
        code = 0
    return code, int((time.monotonic() - t0) * 1000)


def post(url: str, body: dict) -> tuple[int, str]:
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}
    )
    try:
        r = urllib.request.urlopen(req, timeout=15)
        return r.status, r.read().decode(errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")
    except Exception:
        return 0, ""


# Test 1: Health endpoint latency
print("--- Test 1: Health Endpoint Latency ---")
times, errors = [], 0
for i in range(1, 11):
    code, ms = timed_get(f"{BASE_URL}/api/health")
    times.append(ms)
    if code != 200:
        errors += 1
    print(f"  Request {i}: {ms}ms (HTTP {code})")
avg_h = sum(times) // 10
print(f"\nHealth endpoint: avg={avg_h}ms min={min(times)}ms max={max(times)}ms errors={errors}\n")

# Test 2: Concurrent auth ops
print("--- Test 2: Concurrent Auth Operations ---")
t0 = time.monotonic()


def auth_cycle(i: int) -> str:
    email = f"perf-test-{i}@test.cloudless.gr"
    pwd = f"PerfTest{i}!"
    rc, _ = post(f"{BASE_URL}/api/auth/register", {"email": email, "password": pwd})
    lc, _ = post(f"{BASE_URL}/api/auth/login", {"email": email, "password": pwd})
    try:
        sc = urllib.request.urlopen(f"{BASE_URL}/api/auth/session", timeout=15).status
    except Exception:
        sc = 0
    return f"  Iteration {i}: register={rc} login={lc} session={sc}"


with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
    for line in pool.map(auth_cycle, range(1, ITERATIONS + 1)):
        print(line)

total_time = max(int(time.monotonic() - t0), 1)
rps = round(ITERATIONS / total_time, 1)
print(f"\nConcurrent auth: {ITERATIONS} ops in {total_time}s = {rps} req/s")

# Test 3: password reset
print("\n--- Test 3: Password Reset Flow ---")
t0 = time.monotonic()
for i in range(1, 6):
    code, _ = post(
        f"{BASE_URL}/api/auth/reset-password", {"email": f"perf-test-{i}@test.cloudless.gr"}
    )
    print(f"  Reset request {i}: HTTP {code}")
reset_time = int(time.monotonic() - t0)
print(f"Reset flow: 5 requests in {reset_time}s")

# Test 4: error handling
print("\n--- Test 4: Error Handling ---")
print("  Missing email (register): ", end="")
code, body = post(f"{BASE_URL}/api/auth/register", {"password": "test"})
try:
    print(f"HTTP {code} - {json.loads(body).get('error', 'ok')}")
except Exception:
    print("error")

print("  Invalid credentials: ", end="")
code, body = post(
    f"{BASE_URL}/api/auth/login", {"email": "nonexistent@test.cloudless.gr", "password": "wrong"}
)
try:
    print(f"HTTP {code} - {json.loads(body).get('error', 'ok')}")
except Exception:
    print("error")

print("  CORS preflight: ", end="")
req = urllib.request.Request(
    f"{BASE_URL}/api/auth/login", method="OPTIONS", headers={"Origin": "https://cloudless.gr"}
)
try:
    code = urllib.request.urlopen(req, timeout=15).status
except urllib.error.HTTPError as e:
    code = e.code
except Exception:
    code = 0
print(f"HTTP {code}")

print("  Unknown route: ", end="")
code, ms_unk = timed_get(f"{BASE_URL}/api/unknown")
print(f"HTTP {code}")

# Test 5: projection
print("\n--- Test 5: 100K/Day Throughput Estimation ---")
print("Target: 100,000 requests/day = 1.16 req/s sustained")
print(f"Achieved: {rps} req/s ({ITERATIONS} concurrent ops)")
daily = int(rps * 86400)
print(f"Projected daily capacity: {daily} requests/day")
passed = daily > 100000
print(
    "RESULT: "
    + (
        "PASS - Capacity exceeds 100K/day target"
        if passed
        else "WARNING - Capacity below 100K/day target (increase concurrency or reduce cold starts)"
    )
)

print(f"\n{'=' * 42}\nWriting results to {REPORT_FILE}...")
report = {
    "timestamp": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "target": BASE_URL,
    "health": {"avg_ms": avg_h, "min_ms": min(times), "max_ms": max(times), "errors": errors},
    "auth": {
        "iterations": ITERATIONS,
        "concurrency": CONCURRENCY,
        "total_seconds": total_time,
        "requests_per_second": rps,
    },
    "capacity": {"target_daily": 100000, "projected_daily": daily, "pass": passed},
}
Path(REPORT_FILE).write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
print("\n=== Performance Test Complete ===")
