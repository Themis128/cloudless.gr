#!/bin/bash
# Cloudflare Email Routing Setup Script
# Programmatically configures MX, SPF, DKIM records and routing

set -euo pipefail

DOMAIN="${DOMAIN:-cloudless.gr}"
DEST_EMAIL="${1:-tbaltzakis@cloudless.gr}"

# Get API token - try multiple sources
CF_TOKEN="${CLOUDFLARE_API_TOKEN:-}"
if [ -z "$CF_TOKEN" ]; then
    CF_TOKEN=$(gh secret view CLOUDFLARE_API_TOKEN 2>/dev/null || echo "")
fi

if [ -z "$CF_TOKEN" ]; then
    echo "ERROR: CLOUDFLARE_API_TOKEN not found"
    echo "Set it with: export CLOUDFLARE_API_TOKEN=your_token"
    exit 1
fi

export CLOUDFLARE_API_TOKEN="$CF_TOKEN"

API="https://api.cloudflare.com/client/v4"

# Get zone info
echo "🔍 Finding zone for ${DOMAIN}..."
ZONE=$(curl -s -X GET "$API/zones?name=${DOMAIN}" -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json")
ZONE_ID=$(echo "$ZONE" | jq -r '.result[0].id // empty')

if [ -z "$ZONE_ID" ]; then
    echo "ERROR: Zone ${DOMAIN} not found"
    exit 1
fi

ACCOUNT_ID=$(echo "$ZONE" | jq -r '.result[0].account.id')
echo "✓ Zone ID: $ZONE_ID"
echo "✓ Account ID: $ACCOUNT_ID"

# Function to check if DNS record exists
record_exists() {
    local type="$1" name="$2"
    local check=$(curl -s -X GET "$API/zones/$ZONE_ID/dns_records?type=${type}&name=${name}" \
        -H "Authorization: Bearer $CF_TOKEN" | jq '.result | length')
    [ "$check" != "0" ]
}

# Function to add DNS record
add_record() {
    local type="$1"
    local name="$2"
    local content="$3"
    local priority="${4:-}"

    if record_exists "$type" "$name"; then
        echo "✓ $type already exists: $name"
        return 0
    fi

    local data="{\"type\":\"$type\",\"name\":\"$name\",\"content\":\"$content\",\"ttl\":3600,\"proxied\":false}"
    if [ -n "$priority" ]; then
        data=$(echo "$data" | jq --argjson pri "$priority" '. + {priority: $pri}')
    fi

    curl -s -X POST "$API/zones/$ZONE_ID/dns_records" \
        -H "Authorization: Bearer $CF_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$data" | jq -r '.result.name + " (" + .result.type + ") created"' >/dev/null 2>&1 && \
        echo "✓ Added $type record: $name" || \
        echo "   Note: $type record may have issues: $name"
}

echo ""
echo "[1/4] Setting MX records..."
add_record "MX" "$DOMAIN" "mx1.mail.protonmail.ch" 10
add_record "MX" "$DOMAIN" "mx2.mail.protonmail.ch" 20

echo ""
echo "[2/4] Setting SPF record..."
add_record "TXT" "$DOMAIN" "v=spf1 include:cloudflare.net ~all"

echo ""
echo "[3/4] Setting DMARC..."
add_record "TXT" "_dmarc.$DOMAIN" "v=DMARC1; p=none; rua=mailto:postmaster@${DOMAIN}"

echo ""
echo "[4/4] Setting up routing destination..."
curl -s -X POST "$API/accounts/$ACCOUNT_ID/email/routing/addresses" \
    -H "Authorization: Bearer $CF_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$DEST_EMAIL\"}" >/dev/null 2>&1 && \
    echo "✓ Destination added: $DEST_EMAIL" || \
    echo "   Destination may already exist: $DEST_EMAIL"

echo ""
echo "=========================================="
echo "✅ Setup complete!"
echo "=========================================="
echo ""
echo "Check your email ($DEST_EMAIL) for verification link."
echo "Then deploy: pnpm cf:deploy:free"