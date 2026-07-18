#!/bin/sh
# Entrypoint script for cloudflare-pages-mcp container
# Ensures required directories exist and starts the MCP server
# IMPORTANT: MCP uses stdio transport - container must run interactively

set -e

# Ensure /workspace is available (mount point)
mkdir -p /workspace

# Set working directory
cd /app

# Check for required environment variables
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "Error: CLOUDFLARE_API_TOKEN is required" >&2
  exit 1
fi

if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
  echo "Error: CLOUDFLARE_ACCOUNT_ID is required" >&2
  exit 1
fi

echo "Starting Cloudflare Pages MCP server..." >&2
echo "Account: $CLOUDFLARE_ACCOUNT_ID" >&2

# Start the server using tsx (TypeScript execution)
# Note: This server uses stdio transport, so run with: docker run -i --rm
exec npx tsx src/index.ts
```
