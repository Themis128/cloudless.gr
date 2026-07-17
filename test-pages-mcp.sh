#!/bin/bash
# Test script for Cloudflare Pages MCP Server
# Usage: ./test-pages-mcp.sh

set -euo pipefail

echo "🧪 Testing Cloudflare Pages MCP Server Configuration"
echo "=================================================="

# Check if MCP server exists
if [ -f "cloudflare-pages-mcp/dist/index.js" ]; then
    echo "✅ MCP Server binary exists at cloudflare-pages-mcp/dist/index.js"
else
    echo "❌ MCP Server binary not found"
    exit 1
fi

# Check if mcp.json has the server configured
if grep -q "cloudflare-pages" mcp.json; then
    echo "✅ Cloudflare Pages MCP is configured in mcp.json"
else
    echo "❌ Cloudflare Pages MCP not found in mcp.json"
    exit 1
fi

# Check if API token is available
if [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
    echo "✅ CLOUDFLARE_API_TOKEN is set"
    
    # Test API connectivity
    ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-fb7dc7b69b662480cd5961a4d1913c78}"
    echo "🔍 Testing Cloudflare API connectivity..."
    
    if curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID" \
        | grep -q "200"; then
        echo "✅ Cloudflare API token is valid"
        
        # List existing Pages projects
        echo ""
        echo "📋 Existing Pages Projects:"
        curl -s \
            -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
            "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/pages/projects" \
            | jq -r '.result[] | "- \(.name) (\(.subdomain).pages.dev)"' 2>/dev/null || echo "   (No projects or jq not installed)"
    else
        echo "❌ Cloudflare API token is invalid or lacks permissions"
    fi
else
    echo "⚠️  CLOUDFLARE_API_TOKEN not set (required for MCP to function)"
    echo "   Set it with: export CLOUDFLARE_API_TOKEN=your_token_here"
fi

echo ""
echo "📁 Static assets ready for Pages deployment:"
ls -la out/*.html 2>/dev/null | head -5 || echo "   (Run 'pnpm build' to generate)"

echo ""
echo "🚀 To test the MCP server, ask your AI assistant:"
echo '   • "List all my Cloudflare Pages projects"'
echo '   • "Show me the cloudless-assets Pages project details"'
echo '   • "Deploy index.html to cloudless-assets"'
echo ""
echo "🔧 The cloudless-assets Pages project is configured in wrangler.pages.json"