#!/bin/bash

# Playwright MCP Docker - Quick Commands for cloudless.gr
# Location: /home/tbaltzakis/cloudless.gr

echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Playwright MCP Docker - Quick Command Reference       ║"
echo "║           cloudless.gr Fine-Tuning                      ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Start Services
echo "START SERVICES:"
echo "  docker compose -f playwright-mcp-docker-compose.yml --profile playwright up -d"
echo ""

# Check Status
echo "CHECK STATUS:"
echo "  docker compose -f playwright-mcp-docker-compose.yml ps"
echo "  docker ps | grep playwright"
echo ""

# View Logs
echo "VIEW LOGS:"
echo "  docker compose -f playwright-mcp-docker-compose.yml logs -f playwright-mcp"
echo "  docker compose -f playwright-mcp-docker-compose.yml logs mcp-playwright-advanced"
echo ""

# Run Tests
echo "RUN TESTS:"
echo "  # Basic test"
echo "  npx playwright test --project=chromium"
echo ""
echo "  # With MCP server"
echo "  PLAYWRIGHT_MCP_SERVER=ws://localhost:8888 npm test"
echo ""
echo "  # With enhanced config"
echo "  npx playwright test --config=playwright-mcp.config.ts"
echo ""
echo "  # Debug mode"
echo "  npx playwright test --debug --config=playwright-mcp.config.ts"
echo ""

# Test Projects
echo "TEST PROJECTS:"
echo "  npx playwright test --project=chromium       # Chrome"
echo "  npx playwright test --project=firefox         # Firefox"
echo "  npx playwright test --project=webkit          # Safari"
echo "  npx playwright test --project=mobile-chrome   # Mobile Chrome"
echo "  npx playwright test --project=mobile-safari   # iPhone 12"
echo ""

# Reports
echo "REPORTS:"
echo "  npx playwright show-report              # HTML report"
echo "  npx playwright test --trace=on           # With trace"
echo "  npx playwright test --video=retain-on-failure"
echo ""

# Stop Services
echo "STOP SERVICES:"
echo "  docker compose -f playwright-mcp-docker-compose.yml down"
echo ""

# Clean Up
echo "CLEAN UP:"
echo "  docker compose -f playwright-mcp-docker-compose.yml down -v  # Remove volumes"
echo "  docker system prune                                          # Remove unused images"
echo ""

# Docker Images
echo "DOCKER IMAGES:"
echo "  docker pull mcp/playwright:latest                # Official"
echo "  docker pull mcp/mcp-playwright:latest            # Advanced"
echo "  docker pull mcr.microsoft.com/playwright:latest  # Environment"
echo ""

# Environment
echo "ENVIRONMENT VARIABLES:"
echo "  PLAYWRIGHT_MCP_SERVER=ws://localhost:8888"
echo "  PLAYWRIGHT_BASE_URL=http://localhost:4000"
echo "  PLAYWRIGHT_HEADLESS=true"
echo ""

# Cline Integration
echo "CLINE INTEGRATION:"
echo "  1. Open Cline in VS Code"
echo "  2. Request: Analyze [component] and suggest optimizations"
echo "  3. Cline uses 32 MCP tools to test your app"
echo ""

echo "MCP TOOLS AVAILABLE:"
echo "  Browser: navigate, click, fill, select, drag, upload, screenshot"
echo "  Analysis: get_visible_html, console_logs, evaluate"
echo "  HTTP: get, post, patch, put, delete, assert_response"
echo "  Advanced: start_codegen_session, save_as_pdf"
echo ""

