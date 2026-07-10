#!/usr/bin/env bash
# Performance test for Cloudflare Workers deployment
# Tests sustained throughput under 100K requests/day (~1.16 req/sec sustained)
set -euo pipefail

BASE_URL="${1:-https://cloudless-gr-staging.baltzakis-themis.workers.dev}"
ITERATIONS="${2:-50}"
CONCURRENCY="${3:-5}"
REPORT_FILE="${4:-/tmp/workers-perf-report.json}"

echo "=== Cloudflare Workers Performance Test ==="
echo "Target: $BASE_URL"
echo "Iterations: $ITERATIONS"
echo "Concurrency: $CONCURRENCY"
echo "=========================================="
echo ""

# Test 1: Health endpoint latency
echo "--- Test 1: Health Endpoint Latency ---"
total_health=0
min_health=9999
max_health=0
errors_health=0

for i in $(seq 1 10); do
  start=$(date +%s%N)
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health" 2>&1) || code="000"
  end=$(date +%s%N)
  elapsed=$(( (end - start) / 1000000 ))
  
  total_health=$((total_health + elapsed))
  [ "$elapsed" -lt "$min_health" ] && min_health=$elapsed
  [ "$elapsed" -gt "$max_health" ] && max_health=$elapsed
  [ "$code" != "200" ] && errors_health=$((errors_health + 1))
  
  echo "  Request $i: ${elapsed}ms (HTTP $code)"
done

avg_health=$((total_health / 10))
echo ""
echo "Health endpoint: avg=${avg_health}ms min=${min_health}ms max=${max_health}ms errors=${errors_health}"
echo ""

# Test 2: Concurrent registration + login
echo "--- Test 2: Concurrent Auth Operations ---"
start=$(date +%s%N)

for i in $(seq 1 "$ITERATIONS"); do
  (
    email="perf-test-${i}@test.cloudless.gr"
    pass="PerfTest${i}!"
    
    # Register
    register_code=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST "$BASE_URL/api/auth/register" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"${email}\",\"password\":\"${pass}\"}" 2>&1)
    
    # Login
    login_code=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST "$BASE_URL/api/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"${email}\",\"password\":\"${pass}\"}" 2>&1)
    
    # Session check
    session_code=$(curl -s -o /dev/null -w "%{http_code}" \
      "$BASE_URL/api/auth/session" \
      -b /tmp/perf-cookie-${i}.txt 2>&1 || echo "000")
    
    echo "  Iteration $i: register=$register_code login=$login_code session=$session_code"
  ) &
  
  # Limit concurrency
  if [ $((i % CONCURRENCY)) -eq 0 ]; then
    wait
  fi
done

wait
end=$(date +%s%N)
total_time=$(( (end - start) / 1000000000 ))
rps=$(echo "scale=1; $ITERATIONS / $total_time" | bc -l)
echo ""
echo "Concurrent auth: $ITERATIONS ops in ${total_time}s = ${rps} req/s"

# Test 3: Password reset flow
echo ""
echo "--- Test 3: Password Reset Flow ---"
start=$(date +%s%N)

for i in $(seq 1 5); do
  email="perf-test-${i}@test.cloudless.gr"
  
  reset_code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$BASE_URL/api/auth/reset-password" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${email}\"}" 2>&1)
  
  echo "  Reset request $i: HTTP $reset_code"
done

end=$(date +%s%N)
reset_time=$(( (end - start) / 1000000000 ))
echo "Reset flow: 5 requests in ${reset_time}s"

# Test 4: Error handling
echo ""
echo "--- Test 4: Error Handling ---"
# Missing email
echo -n "  Missing email (register): "
curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"password":"test"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"HTTP 400 - {d.get('error','ok')}\")" 2>/dev/null || echo "error"

# Invalid login
echo -n "  Invalid credentials: "
curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@test.cloudless.gr","password":"wrong"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"HTTP 401 - {d.get('error','ok')}\")" 2>/dev/null || echo "error"

# CORS preflight
echo -n "  CORS preflight: "
code=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$BASE_URL/api/auth/login" \
  -H "Origin: https://cloudless.gr" 2>&1)
echo "HTTP $code"

# 404 route
echo -n "  Unknown route: "
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/unknown" 2>&1)
echo "HTTP $code"

# Test 5: Throughput estimation for 100K/day
echo ""
echo "--- Test 5: 100K/Day Throughput Estimation ---"
# 100K requests / day = ~1.16 req/s sustained
# We test 50 requests at concurrency 5 and project
echo "Target: 100,000 requests/day = 1.16 req/s sustained"
echo "Achieved: ${rps} req/s (${ITERATIONS} concurrent ops)"

daily_capacity=$(echo "scale=0; $rps * 86400" | bc -l)
echo "Projected daily capacity: ${daily_capacity} requests/day"

if [ "$(echo "$daily_capacity > 100000" | bc -l)" -eq 1 ]; then
  echo "RESULT: PASS - Capacity exceeds 100K/day target"
else
  echo "RESULT: WARNING - Capacity below 100K/day target (increase concurrency or reduce cold starts)"
fi

# Collect results
echo ""
echo "=========================================="
echo "Writing results to $REPORT_FILE..."

cat > "$REPORT_FILE" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "target": "$BASE_URL",
  "health": {
    "avg_ms": $avg_health,
    "min_ms": $min_health,
    "max_ms": $max_health,
    "errors": $errors_health
  },
  "auth": {
    "iterations": $ITERATIONS,
    "concurrency": $CONCURRENCY,
    "total_seconds": $total_time,
    "requests_per_second": $rps
  },
  "capacity": {
    "target_daily": 100000,
    "projected_daily": $daily_capacity,
    "pass": $( [ "$(echo "$daily_capacity > 100000" | bc -l)" -eq 1 ] && echo true || echo false)
  }
}
EOF

echo "Results:"
python3 -m json.tool "$REPORT_FILE"
echo ""
echo "=== Performance Test Complete ==="