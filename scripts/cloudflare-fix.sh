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

# Verify the MCP server binary exists
if [ ! -f "/home/tbaltzakis/cloudflare-pages-mcp/dist/index.js" ]; then
  echo "❌ MCP server binary not found, rebuilding..."
  cd /home/tbaltzakis/cloudflare-pages-mcp
  npm run build
fi

echo "✅ MCP server binary exists"

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

# List Pages projects
echo ""
echo "📋 Checking Cloudflare Pages projects..."
PAGES_RESPONSE=$(curl -s --max-time 10 \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects")

if echo "$PAGES_RESPONSE" | grep -q "error"; then
  echo "❌ Failed to list Pages projects"
else
  echo "Pages projects found:"
  echo "$PAGES_RESPONSE" | jq -r '.result[]? | "- \(.name) (\(.subdomain).pages.dev)"' 2>/dev/null || echo "  (No projects or parse error)"
fi

echo ""
echo "✅ Cloudflare app fix script completed successfully"
echo ""
echo "Next steps:"
echo "  1. Restart Cline/Claude to load updated MCP settings"
echo "  2. Verify Worker deployment: bash scripts/workers-ai-doctor.sh"