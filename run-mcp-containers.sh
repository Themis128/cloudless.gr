#!/bin/bash
# run-mcp-containers.sh - Helper script to run MCP containers with proper stdio handling
#
# IMPORTANT: MCP servers use stdio transport and MUST be run with -i --rm flags
# This is for testing purposes - for production use, configure via cline_mcp_settings.json

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for API token
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo -e "${RED}Error: CLOUDFLARE_API_TOKEN environment variable is required${NC}"
    echo "Set it with: export CLOUDFLARE_API_TOKEN=your_token_here"
    exit 1
fi

if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
    echo -e "${RED}Error: CLOUDFLARE_ACCOUNT_ID environment variable is required${NC}"
    echo "Set it with: export CLOUDFLARE_ACCOUNT_ID=your_account_id"
    exit 1
fi

echo -e "${GREEN}Starting MCP containers with stdio transport...${NC}"
echo "API Token: ${CLOUDFLARE_API_TOKEN:0:10}..."
echo "Account ID: $CLOUDFLARE_ACCOUNT_ID"
echo ""

# Function to run container interactively
run_mcp_container() {
    local container_name=$1
    local image=$2
    
    echo -e "${YELLOW}Starting $container_name...${NC}"
    echo "Run command: docker run -i --rm $container_name"
    echo ""
    
    # Note: Running interactively would block, so we just show the command
    # In practice, configure via cline_mcp_settings.json instead
}

# Build the cloudflare-pages-mcp image first
echo -e "${YELLOW}Building cloudflare-pages-mcp image...${NC}"
docker build -t cloudless-pages-mcp:latest -f cloudflare-pages-mcp/Dockerfile cloudflare-pages-mcp/

# Show proper docker run commands
echo -e "${GREEN}Build complete!${NC}"
echo ""
echo "To run these containers with proper stdio handling, use:"
echo ""
echo -e "${YELLOW}Cloudflare Pages MCP:${NC}"
echo "  docker run -i --rm \\"
echo "    -e CLOUDFLARE_API_TOKEN=\$CLOUDFLARE_API_TOKEN \\"
echo "    -e CLOUDFLARE_ACCOUNT_ID=\$CLOUDFLARE_ACCOUNT_ID \\"
echo "    -v /home/tbaltzakis/cloudless.gr:/workspace \\"
echo "    cloudless-pages-mcp:latest"
echo ""
echo -e "${YELLOW}Playwright MCP:${NC}"
echo "  docker run -i --rm \\"
echo "    -e PLAYWRIGHT_HEADLESS=true \\"
echo "    -e PLAYWRIGHT_BASE_URL=http://host.docker.internal:4000 \\"
echo "    -v /home/tbaltzakis/cloudless.gr:/workspace \\"
echo "    -v playwright-cache:/ms-playwright \\"
echo "    mcr.microsoft.com/playwright/mcp:latest"
echo ""
echo -e "${GREEN}For production use, configure MCP servers in cline_mcp_settings.json${NC}"