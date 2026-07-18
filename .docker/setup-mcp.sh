#!/bin/bash
# Docker MCP Setup Script for Cloudless.gr
# Run this script when Docker Desktop is available

set -e

echo "🔧 Setting up Docker MCP profile for cloudless.gr..."

# Import the profile
docker mcp profile import .docker/mcp-profile.json

# Configure secrets (you'll be prompted for each)
echo "🔐 Configuring secrets (you'll be prompted for each)..."
docker mcp secret set GITHUB_PERSONAL_ACCESS_TOKEN || echo "⚠️  GITHUB_PERSONAL_ACCESS_TOKEN not set"
docker mcp secret set CLOUDFLARE_API_TOKEN || echo "⚠️  CLOUDFLARE_API_TOKEN not set"
docker mcp secret set CLOUDFLARE_ACCOUNT_ID || echo "⚠️  CLOUDFLARE_ACCOUNT_ID not set"
docker mcp secret set BRAVE_API_KEY || echo "⚠️  BRAVE_API_KEY not set"

echo "✅ Setup complete!"
echo ""
echo "📋 To run the gateway: docker mcp gateway run --profile cloudless-dev"
echo "📋 To connect VS Code: docker mcp client connect vscode --profile cloudless-dev"
echo "📋 To list servers: docker mcp profile server ls --filter profile=cloudless-dev"
