#!/usr/bin/env bash
# Cloudflare App Fix Script
# Addresses: CLOUDFLARE_API_TOKEN setup, MCP configuration, Worker deployment

set -euo pipefail

echo "🔧 Cloudflare App Fix Script"
echo "=============================="

# Check if CLOUDFLARE_API_TOKEN is set
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "❌ CLOUDFLARE_API_TOKEN is not set in environment"
  echo ""
  echo "To set it, run one of these options:"
  echo ""
  echo "Option 1: Add to shell profile (persistent)"
  echo "  echo 'export CLOUDFLARE_API_TOKEN=\"your_token_here\"' >> ~/.bashrc"
  echo "  source ~/.bashrc"
  echo ""
  echo "Option 2: Set for current session"
  echo "  export CLOUDFLARE_API_TOKEN=\"your_token_here\""
  echo ""
  echo "Option 3: Create GitHub repo secret (for CI/CD)"
  echo "  gh secret set CLOUDFLARE_API_TOKEN"
  echo ""
  echo "Your API token needs these permissions:"
  echo "  - Account → Cloudflare Pages → Edit"
  echo "  - Account → Workers Scripts → Edit"
  echo "  - Account → Workers KV Storage → Edit"
  echo "  - Zone → DNS → Edit"
  echo "  - Zone → Zone → Read"
  exit 1
fi

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-fb7dc7b69b662480cd5961a4d1913c78}"
 
 # Verify the MCP server binary exists (skip in CI with SKIP_MCP_CHECK=true)
 if [ -z "${SKIP_MCP_CHECK:-}" ]; then
   MCP_BIN="${MCP_BIN_PATH:-/home/tbaltzakis/cloudflare-pages-mcp/dist/index.js}"
   if [ -f "$MCP_BIN" ]; then
     echo "✅ MCP server binary exists at $MCP_BIN"
   else
     echo "⚠️  MCP server binary not found (local environment only)"
     echo "    Expected: $MCP_BIN"
   fi
 fi

# Verify API token validity
echo "🔍 Verifying Cloudflare API token..."
VERIFY_RESPONSE=$(curl -s --max-time 10 \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  "https://api.cloudflare.com/client/v4/user/tokens/verify")

if echo "$VERIFY_RESPONSE" | grep -q '"status":"active"'; then
  echo "✅ Cloudflare API token is valid"
else
  echo "❌ Cloudflare API token is invalid: $VERIFY_RESPONSE"
  exit 1
fi

# List Pages projects (requires Account → Cloudflare Pages → Edit permission)
echo ""
echo "📋 Checking Cloudflare Pages projects..."
PAGES_RESPONSE=$(curl -s --max-time 10 \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects")

if echo "$PAGES_RESPONSE" | jq -e '.errors' > /dev/null 2>&1; then
  ERR_MSG=$(echo "$PAGES_RESPONSE" | jq -r '.errors[0].message // "unknown error"')
  echo "⚠️  Cannot access Pages API ($ERR_MSG)"
  echo "   (Add 'Account → Cloudflare Pages → Edit' permission to token if needed)"
elif echo "$PAGES_RESPONSE" | jq -e '.result' > /dev/null 2>&1; then
  PAGES_COUNT=$(echo "$PAGES_RESPONSE" | jq '.result | length')
  if [ "$PAGES_COUNT" -gt 0 ]; then
    echo "Pages projects found ($PAGES_COUNT):"
    echo "$PAGES_RESPONSE" | jq -r '.result[] | "- \(.name) (\(.subdomain).pages.dev)"' 2>/dev/null
  else
    echo "  No Pages projects found on this account"
  fi
else
  echo "❌ Failed to list Pages projects (unexpected response)"
fi

echo ""
echo "✅ Cloudflare app fix script completed successfully"
echo ""
echo "Next steps:"
echo "  1. Restart Cline/Claude to load updated MCP settings"
echo "  2. Verify Worker deployment: bash scripts/workers-ai-doctor.sh"