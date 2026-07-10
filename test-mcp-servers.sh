#!/bin/bash
# Test script for Kiro IDE MCP servers
# Run this to verify MCP server configurations

set -euo pipefail

echo "🧪 Testing Kiro IDE MCP Server Configurations"
echo "=============================================="

# Check if jq is available
if ! command -v jq &>/dev/null; then
  echo "❌ jq not found - please install jq"
  exit 1
fi

# Validate JSON configuration files
echo ""
echo "📋 Validating mcp.json files..."

for file in mcp.json .kiro/settings/mcp.json; do
  if [ -f "$file" ]; then
    if jq . "$file" > /dev/null 2>&1; then
      echo "✅ $file - Valid JSON"
    else
      echo "❌ $file - Invalid JSON"
    fi
  fi
done

# Check package availability
echo ""
echo "📦 Checking MCP server packages..."

# npm packages
packages=(
  "@modelcontextprotocol/server-github"
  "kubernetes-mcp-server"
  "terraform-mcp-server"
  "@turbot/steampipe-mcp"
  "@modelcontextprotocol/server-puppeteer"
  "gemdex-mcp"
)

for pkg in "${packages[@]}"; do
  if npm view "$pkg" version &>/dev/null; then
    version=$(npm view "$pkg" version 2>/dev/null)
    echo "✅ $pkg (v$version) - Available on npm"
  else
    echo "❌ $pkg - Not found on npm"
  fi
done

# GitHub-only packages
echo ""
echo "📦 GitHub packages (run via npx github:...):"
echo "⚠️  aws-finops-mcp-server - Available via GitHub: ravikiranvm/aws-finops-mcp-server"

echo ""
echo "📝 Required Environment Variables:"
echo "  - GITHUB_TOKEN - For GitHub MCP server"
echo "  - TF_API_TOKEN - For Terraform MCP server (optional)"
echo "  - AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY - For AWS FinOps"
echo "  - CLOUDFLARE_API_TOKEN - For Cloudflare MCP servers"
echo "  - TAILSCALE_API_KEY - For Tailscale MCP server"

echo ""
echo "🚀 To use with Kiro IDE, ensure these variables are set in your environment"
echo "   or in the .env.local file (they're referenced via \${VAR_NAME})"