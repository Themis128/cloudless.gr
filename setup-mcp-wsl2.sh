#!/bin/bash

# Setup script for Cloudflare MCP servers in WSL2 Ubuntu 24.04

echo "Cloudflare MCP Server Setup for WSL2"
echo "===================================="
echo ""

# Load NVM if available
if [ -s ~/.nvm/nvm.sh ]; then
    source ~/.nvm/nvm.sh
    echo "✓ Node.js  loaded via NVM"
else
    echo "⚠ NVM not found, using system Node.js"
fi

# Set Cloudflare token (read from .env or environment)
export CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-<your-cloudflare-api-token>}"
export CLOUDFLARE_ACCOUNT_ID="fb7dc7b69b662480cd5961a4d1913c78"
export WRANGLER_HOME="/home/tbaltzakis/cloudless.gr/.wrangler"

echo "✓ Environment variables set"
echo ""

# Verify components
echo "Verifying MCP Server Components:"
echo ""

echo -n "1. Node.js: "
node --version

echo -n "2. NPM: "
npm --version

echo -n "3. Wrangler: "
wrangler --version

echo -n "4. cloudflare-pages: "
test -f /home/tbaltzakis/cloudflare-pages-mcp/dist/index.js && echo "✓ Found" || echo "✗ Not found"

echo ""
echo "Ready to use Cloudflare MCP servers!"
echo ""
echo "Available commands:"
echo "  wrangler --help              # Cloudflare Workers"
echo "  wrangler deploy              # Deploy Worker"
echo "  npm install -g @wrangler/cli # Update wrangler"
echo ""
echo "MCP Servers:"
echo "  • cloudflare-pages - Full Pages/DNS/Workers API"
echo "  • cloudflare-wrangler - Workers management"
echo "  • cloudflare-r2 - R2 storage"
echo ""
