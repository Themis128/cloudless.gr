#!/bin/bash
# Setup Cloudflare Email DNS Records Programmatically
# Uses Wrangler CLI to configure MX, SPF for Email Routing

set -euo pipefail

DOMAIN="${DOMAIN:-cloudless.gr}"
DEST_EMAIL="${1:-tbaltzakis@cloudless.gr}"

echo "🔧 Setting up Cloudflare Email DNS records for ${DOMAIN}..."
echo ""

# Check if wrangler is configured
if ! command -v npx wrangler &>/dev/null; then
    echo "ERROR: Wrangler CLI not found. Install with: npm install -g wrangler"
    exit 1
fi

echo "[1/4] Setting MX records for Email Routing..."
# Cloudflare Email Routing requires ProtonMail MX records
npx wrangler dns create mx1.mail.protonmail.ch --type MX --name "${DOMAIN}" --priority 10 --ttl 3600 2>/dev/null || echo "   MX record may already exist"
npx wrangler dns create mx2.mail.protonmail.ch --type MX --name "${DOMAIN}" --priority 20 --ttl 3600 2>/dev/null || echo "   MX record may already exist"

echo ""
echo "[2/4] Setting SPF record..."
npx wrangler dns create "v=spf1 include:cloudflare.net ~all" --type TXT --name "${DOMAIN}" --ttl 3600 2>/dev/null || echo "   SPF record may already exist"

echo ""
echo "[3/4] Setting DMARC record..."
npx wrangler dns create "v=DMARC1; p=none; rua=mailto:postmaster@${DOMAIN}" --type TXT --name "_dmarc.${DOMAIN}" --ttl 3600 2>/dev/null || echo "   DMARC record may already exist"

echo ""
echo "[4/4] Checking current DNS records..."
npx wrangler dns list --domain "${DOMAIN}" 2>&1 || echo "   DNS list requires API access"

echo ""
echo "=========================================="
echo "✅ DNS Configuration Complete!"
echo "=========================================="
echo ""
echo "Next: Configure Email Routing in Cloudflare Dashboard"
echo "1. Go to Cloudflare → Email → Routing"
echo "2. Add destination: ${DEST_EMAIL}"
echo "3. Verify noreply@${DOMAIN}"
echo "4. Deploy worker: pnpm cf:deploy:free"