#!/bin/bash
# Test script for Cloudflare MCP and Playwright MCP servers

set -e

echo "🔍 Testing MCP Server Configuration..."
echo ""

# Check if required files exist
echo "📁 Checking file structure..."
FILES_OK=true

if [ -f "cloudflare-pages-mcp/src/index.ts" ]; then
  echo "✓ cloudflare-pages-mcp/src/index.ts exists"
else
  echo "✗ cloudflare-pages-mcp/src/index.ts missing"
  FILES_OK=false
fi

if [ -d "cloudflare-pages-mcp/public" ]; then
  echo "✓ cloudflare-pages-mcp/public directory exists"
else
  echo "✗ cloudflare-pages-mcp/public directory missing"
  FILES_OK=false
fi

if [ -f "cloudflare-pages-mcp/public/index.html" ]; then
  echo "✓ cloudflare-pages-mcp/public/index.html exists"
else
  echo "✗ cloudflare-pages-mcp/public/index.html missing"
  FILES_OK=false
fi

if [ -f "mcp.json" ]; then
  echo "✓ mcp.json exists"
else
  echo "✗ mcp.json missing"
  FILES_OK=false
fi

echo ""

# Test MCP config syntax
echo "🔧 Validating MCP configuration..."
if command -v jq &> /dev/null; then
  if jq empty cloudflare-pages-mcp/package.json 2>/dev/null; then
    echo "✓ cloudflare-pages-mcp/package.json is valid JSON"
  else
    echo "✗ cloudflare-pages-mcp/package.json has JSON errors"
  fi

  if jq empty mcp.json 2>/dev/null; then
    echo "✓ mcp.json is valid JSON"
  else
    echo "✗ mcp.json has JSON errors"
  fi

  if jq empty .cline/data/settings/cline_mcp_settings.json 2>/dev/null; then
    echo "✓ cline_mcp_settings.json is valid JSON"
  else
    echo "✗ cline_mcp_settings.json has JSON errors"
  fi
else
  echo "⚠ jq not installed - skipping JSON validation"
fi

echo ""

# Check environment variables
echo "🔐 Checking environment variables..."
if [ -n "$CLOUDFLARE_API_TOKEN" ]; then
  echo "✓ CLOUDFLARE_API_TOKEN is set"
else
  echo "⚠ CLOUDFLARE_API_TOKEN not set (required for cloudflare-pages-mcp)"
fi

if [ -n "$CLOUDFLARE_ACCOUNT_ID" ]; then
  echo "✓ CLOUDFLARE_ACCOUNT_ID is set"
else
  echo "⚠ CLOUDFLARE_ACCOUNT_ID not set (will use default if available)"
fi

echo ""

# Summary
echo "📊 Summary:"
if [ "$FILES_OK" = true ]; then
  echo "✓ All required files are in place"
  echo ""
  echo "To run the MCP servers:"
  echo "  npx tsx cloudflare-pages-mcp/src/index.ts  # Cloudflare Pages MCP"
  echo "  npx -y @playwright/mcp                    # Playwright MCP"
  echo ""
  echo "To run via Docker:"
  echo "  docker-compose --profile mcp up             # Start MCP containers"
else
  echo "✗ Some files are missing - please check the output above"
  exit 1
fi