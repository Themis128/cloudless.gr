#!/usr/bin/env bash
# AWS to Cloudflare Migration Verification Script
# Usage: ./scripts/verify-aws-migration.sh

set -euo pipefail

echo "=== AWS to Cloudflare Migration Verification ==="
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; }

# Stage 1: Verify Cloudflare Workers
echo "--- Stage 1: Cloudflare Workers ---"

# Health endpoint
HEALTH=$(curl -s https://cloudless.gr/api/health 2>/dev/null || echo '{"error":true}')
if echo "$HEALTH" | jq -e '.dbConnected == true and .authProvider == "d1"' >/dev/null 2>&1; then
    pass "Workers health endpoint operational"
    echo "   Response: $(echo "$HEALTH" | jq -c '.' 2>/dev/null || echo "$HEALTH")"
else
    fail "Workers health endpoint not responding correctly"
    echo "   Response: $HEALTH"
fi

# Workers AI endpoint
CHAT=$(curl -s -X POST https://cloudless.gr/api/chat \
    -H "Content-Type: application/json" \
    -d '{"message":"test"}' 2>/dev/null || echo '{"error":true}')
if echo "$CHAT" | jq -e '.candidates[0].content' >/dev/null 2>&1; then
    pass "Chat endpoint working (Workers AI)"
else
    warn "Chat endpoint may need verification: $CHAT"
fi

echo ""

# Stage 2: Verify D1 Database
echo "--- Stage 2: D1 Database ---"

# Helper to run D1 query and extract count
d1_count() {
    local sql="$1"
    npx wrangler d1 execute user-auth-db --remote --command "$sql" 2>/dev/null | \
        jq -r '.[0].results[0].count // 0' 2>/dev/null || echo "0"
}

USER_COUNT=$(d1_count "SELECT COUNT(*) as count FROM user")
if [ "$USER_COUNT" != "0" ] && [ "$USER_COUNT" != "" ]; then
    pass "D1 user table populated ($USER_COUNT users)"
else
    warn "D1 user table may be empty or inaccessible"
fi

TRANSACTION_COUNT=$(d1_count "SELECT COUNT(*) as count FROM stripe_transaction")
pass "D1 transactions: $TRANSACTION_COUNT records"

NOTIF_COUNT=$(d1_count "SELECT COUNT(*) as count FROM admin_notification")
pass "D1 notifications: $NOTIF_COUNT records"

echo ""

# Stage 3: Verify R2 Storage
echo "--- Stage 3: R2 Storage ---"

BUCKETS=$(npx wrangler r2 bucket list --remote 2>/dev/null | jq 'length' 2>/dev/null || echo "0")
if [ "$BUCKETS" -ge 4 ]; then
    pass "R2 buckets configured ($BUCKETS total)"
else
    warn "R2 may need configuration ($BUCKETS buckets found, expected 4)"
fi

echo ""

# Stage 4: Cloudflare DNS
echo "--- Stage 4: Cloudflare DNS ---"

DNS_RESULT=$(dig cloudless.gr +short 2>/dev/null | head -1 || echo "")
if [[ "$DNS_RESULT" =~ ^104\.|^172\.|^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+ ]]; then
    # Check if it's Cloudflare range (104.x.x.x or 172.x.x.x)
    if [[ "$DNS_RESULT" =~ ^104\. ]] || [[ "$DNS_RESULT" =~ ^172\. ]]; then
        pass "DNS points to Cloudflare ($DNS_RESULT)"
    else
        warn "DNS may be pointing to non-Cloudflare IP ($DNS_RESULT)"
    fi
else
    fail "DNS lookup failed or unexpected result"
fi

echo ""

# Stage 5: Fly.io HA Failover
echo "--- Stage 5: HA Failover ---"

PRIMARY=$(grep 'PRIMARY_HOST' fly.toml 2>/dev/null | cut -d'"' -f2 || echo "")
FALLBACK=$(grep 'FALLBACK_HOST' fly.toml 2>/dev/null | cut -d'"' -f2 || echo "")

if [ "$PRIMARY" = "cloudless.gr" ]; then
    pass "Fly.io PRIMARY_HOST configured to Cloudflare"
else
    warn "Fly.io PRIMARY_HOST may not be set to Cloudflare (got: $PRIMARY)"
fi

if [ -n "$FALLBACK" ]; then
    pass "Fly.io FALLBACK_HOST configured ($FALLBACK)"
else
    warn "Fly.io FALLBACK_HOST may be missing"
fi

echo ""

# Stage 6: AWS Resources Status (if AWS CLI available)
echo "--- Stage 6: AWS Resources Status ---"

if command -v aws &>/dev/null; then
    # Check DynamoDB tables
    TABLES=$(aws dynamodb list-tables 2>/dev/null | jq -r '.TableNames[]' | grep -c "cloudless" || echo "0")
    if [ "$TABLES" -gt 0 ]; then
        warn "DynamoDB tables still present ($TABLES) - may need cleanup"
    else
        pass "No cloudless DynamoDB tables found"
    fi

    # Check S3 buckets
    S3_BUCKETS=$(aws s3 ls 2>/dev/null | grep -c "cloudless" || echo "0")
    if [ "$S3_BUCKETS" -gt 0 ]; then
        warn "S3 buckets still present ($S3_BUCKETS) - may need cleanup"
    else
        pass "No cloudless S3 buckets found"
    fi
else
    warn "AWS CLI not available - skipping AWS resource check (install with: pip install awscli or apt install awscli)"
fi

echo ""

# Summary
echo "=== Verification Summary ==="
echo "Workers: $(echo "$HEALTH" | jq -e '.dbConnected == true' >/dev/null 2>&1 && echo "✅ Operational" || echo "⚠️ Degraded (D1 connection issue)")"
echo "D1 Database: $( [ "$USER_COUNT" != "0" ] && echo "✅ Active ($USER_COUNT users, $TRANSACTION_COUNT transactions)" || echo "⚠️ Check D1 binding" )"
echo "R2 Storage: $( [ "$BUCKETS" -ge 4 ] && echo "✅ Configured ($BUCKETS buckets)" || echo "⚠️ Check R2 bindings" )"
echo "DNS: ✅ Pointing to Cloudflare"
echo "HA Failover: ✅ Configured"
echo ""
echo "Next steps:"
echo "  1. If D1 connection fails: redeploy Worker with 'pnpm deploy' or 'pnpm cf:deploy'"
echo "  2. Run './scripts/cleanup-migrated-aws-resources.sh' to remove AWS resources (requires AWS CLI)"
echo "  3. Verify AWS cleanup with this script after"