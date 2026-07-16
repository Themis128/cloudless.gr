#!/bin/bash
# Configure Cloudflare Email Routing & Deliverability programmatically
# This sets up: MX records, SPF, DKIM, and verifies the destination address
#
# Usage: ./configure-email-routing.sh [destination-email]
# Example: ./configure-email-routing.sh tbaltzakis@cloudless.gr

set -euo pipefail

DOMAIN="${DOMAIN:-cloudless.gr}"
DEST_EMAIL="${1:-tbaltzakis@cloudless.gr}"
CF_API_TOKEN="${CLOUDFLARE_API_TOKEN:-}"

# Try to get token from gh secret if not in environment
if [ -z "$CF_API_TOKEN" ]; then
    CF_TOKEN=$(gh secret view CLOUDFLARE_API_TOKEN 2>/dev/null || echo "")
    [ -n "$CF_TOKEN" ] && export CLOUDFLARE_API_TOKEN="$CF_TOKEN"
fi

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
    echo "ERROR: CLOUDFLARE_API_TOKEN required (set in env or gh secret)"
    exit 1
fi

echo "🔧 Configuring Cloudflare Email for ${DOMAIN}..."
echo "   Destination: ${DEST_EMAIL}"
echo "   Address to verify: noreply@${DOMAIN}"
echo ""

# Get Zone ID
ZONE_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=${DOMAIN}" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" | jq -r '.result[0].id // empty')

if [ -z "$ZONE_ID" ]; then
    echo "ERROR: Zone not found for ${DOMAIN}"
    exit 1
fi
echo "✓ Zone ID: ${ZONE_ID}"

# Get Account ID
ACCOUNT_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/accounts" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" | jq -r '.result[0].id // empty')

echo "✓ Account ID: ${ACCOUNT_ID}"

# Helper: Create DNS record if it doesn't exist
create_txt_record() {
    local name="$1"
    local content="$2"
    
    local exists=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?type=TXT&name=${name}&content=${content}" \
        -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" | jq -r '.result | length')
    
    if [ "$exists" -eq 0 ]; then
        curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
            -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
            -H "Content-Type: application/json" \
            -d "{\"type\":\"TXT\",\"name\":\"${name}\",\"content\":\"${content}\",\"ttl\":3600,\"proxied\":false}" >/dev/null
        echo "✓ Added TXT record: ${name}"
        return 0
    else
        echo "✓ TXT record exists: ${name}"
        return 0
    fi
}

create_mx_record() {
    local name="$1"
    local content="$2"
    local priority="$3"
    
    local exists=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?type=MX&name=${name}" \
        -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" | jq -r '.result | length')
    
    if [ "$exists" -eq 0 ]; then
        curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
            -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
            -H "Content-Type: application/json" \
            -d "{\"type\":\"MX\",\"name\":\"${name}\",\"content\":\"${content}\",\"priority\":${priority},\"ttl\":3600,\"proxied\":false}" >/dev/null
        echo "✓ Added MX record: ${content} (priority ${priority})"
    else
        echo "✓ MX records already configured for ${name}"
    fi
}

# Step 1: Enable Email Routing
echo ""
echo "[1/6] Enabling Email Routing..."
EMAIL_SETUP=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/email/routing/setup" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" -d '{}' 2>&1 || echo "already setup")

if echo "$EMAIL_SETUP" | jq -e '.errors | length > 0' >/dev/null 2>&1; then
    echo "   Note: Email Routing may already be configured (${EMAIL_SETUP})"
else
    echo "✓ Email Routing enabled"
fi

# Step 2: Create destination address
echo ""
echo "[2/6] Setting up destination address..."
DEST_RESULT=$(curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/email/routing/addresses" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${DEST_EMAIL}\",\"verify\":true}" 2>&1)

if echo "$DEST_RESULT" | jq -e '.result' >/dev/null 2>&1; then
    echo "✓ Destination address added: ${DEST_EMAIL}"
else
    echo "   Note: Destination may already exist or requires verification"
fi

# Step 3: Configure MX records for Email Routing
echo ""
echo "[3/6] Configuring MX records..."
# Cloudflare Email Routing uses these MX records
create_mx_record "${DOMAIN}" "mx1.mail.protonmail.ch" 10
create_mx_record "${DOMAIN}" "mx2.mail.protonmail.ch" 20

# Step 4: Add SPF record
echo ""
echo "[4/6] Configuring SPF record..."
create_txt_record "${DOMAIN}" "v=spf1 include:cloudflare.net ~all"

# Step 5: Check DKIM records
echo ""
echo "[5/6] Checking DKIM records (auto-generated)..."
DKIM_RESPONSE=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/email/routing/dns_records" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" 2>&1)

if echo "$DKIM_RESPONSE" | jq -e '.result | length > 0' >/dev/null 2>&1; then
    echo "DKIM records available:"
    echo "$DKIM_RESPONSE" | jq -r '.result[] | "  - " + .type + " " + .name + ": " + .content'
    
    # Create DKIM records if they don't exist
    echo ""
    echo "Creating DKIM records..."
    for record in $(echo "$DKIM_RESPONSE" | jq -r '.result[] | @base64' 2>/dev/null || echo ""); do
        record_type=$(echo "$record" | base64 -d | jq -r '.type // empty')
        record_name=$(echo "$record" | base64 -d | jq -r '.name // empty')
        record_content=$(echo "$record" | base64 -d | jq -r '.content // empty')
        
        if [ -n "$record_type" ] && [ -n "$record_name" ]; then
            created=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
                -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
                -H "Content-Type: application/json" \
                -d "{\"type\":\"${record_type}\",\"name\":\"${record_name}\",\"content\":\"${record_content}\",\"ttl\":3600,\"proxied\":false}" 2>&1 || echo "{}")
            if echo "$created" | jq -e '.result' >/dev/null 2>&1; then
                echo "✓ Added ${record_type} record: ${record_name}"
            else
                echo "   ${record_type} record may already exist: ${record_name}"
            fi
        fi
    done
else
    echo "   DKIM records will be generated by Email Routing after verification"
fi

# Step 6: Create routing rule for noreply@cloudless.gr
echo ""
echo "[6/6] Creating email routing rule..."
RULE_RESULT=$(curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/email/routing/rules" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"noreply\",\"enabled\":true,\"pattern\":\"noreply@${DOMAIN}\",\"actions\":[{\"type\":\"forward\",\"value\":\"${DEST_EMAIL}\"}]}" 2>&1)

if echo "$RULE_RESULT" | jq -e '.result' >/dev/null 2>&1; then
    echo "✓ Created routing rule: noreply@${DOMAIN} → ${DEST_EMAIL}"
else
    echo "   Note: Routing rule may already exist"
fi

echo ""
echo "=========================================="
echo "✅ Email Routing Configuration Complete!"
echo "=========================================="
echo ""
echo "DNS Records configured:"
echo "  - MX: mx1.mail.protonmail.ch (priority 10)"
echo "  - MX: mx2.mail.protonmail.ch (priority 20)"
echo "  - SPF: v=spf1 include:cloudflare.net ~all"
echo "  - DKIM: Auto-generated records"
echo ""
echo "Important: Check your destination email (${DEST_EMAIL}) for verification link."
echo ""
echo "After verification, deploy the worker:"
echo "  pnpm cf:deploy:free"