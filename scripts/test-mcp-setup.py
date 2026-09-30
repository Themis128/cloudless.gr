#!/usr/bin/env python3
"""Test Cloudflare MCP and Playwright MCP server configuration —
file structure, JSON validity, env vars."""

import json
import os
import sys
from pathlib import Path

print("🔍 Testing MCP Server Configuration...\n")

print("📁 Checking file structure...")
files_ok = True
for path in ("cloudflare-pages-mcp/src/index.ts",
             "cloudflare-pages-mcp/public",
             "cloudflare-pages-mcp/public/index.html",
             "mcp.json"):
    if Path(path).exists():
        print(f"✓ {path} exists")
    else:
        print(f"✗ {path} missing")
        files_ok = False

print("\n🔧 Validating MCP configuration...")
for f in ("cloudflare-pages-mcp/package.json", "mcp.json",
          ".cline/data/settings/cline_mcp_settings.json"):
    try:
        json.loads(Path(f).read_text())
        print(f"✓ {f} is valid JSON")
    except FileNotFoundError:
        print(f"✗ {f} missing")
    except json.JSONDecodeError:
        print(f"✗ {f} has JSON errors")

print("\n🔐 Checking environment variables...")
for var in ("CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"):
    if os.environ.get(var):
        print(f"✓ {var} is set")
    else:
        hint = ("required for cloudflare-pages-mcp"
                if var == "CLOUDFLARE_API_TOKEN"
                else "will use default if available")
        print(f"⚠ {var} not set ({hint})")

print("\n📊 Summary:")
if files_ok:
    print("""✓ All required files are in place

To run the MCP servers:
  npx tsx cloudflare-pages-mcp/src/index.ts  # Cloudflare Pages MCP
  npx -y @playwright/mcp                    # Playwright MCP

To run via Docker:
  docker-compose --profile mcp up             # Start MCP containers""")
else:
    sys.exit("✗ Some files are missing - please check the "
             "output above")
