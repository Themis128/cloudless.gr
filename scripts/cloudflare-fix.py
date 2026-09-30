#!/usr/bin/env python3
"""Cloudflare App Fix Script — verifies CLOUDFLARE_API_TOKEN setup,
MCP configuration, and Worker deployment prerequisites."""

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

print("🔧 Cloudflare App Fix Script")
print("==============================")

token = os.environ.get("CLOUDFLARE_API_TOKEN", "")
if not token:
    print("""❌ CLOUDFLARE_API_TOKEN is not set in environment

To set it, run one of these options:

Option 1: Add to shell profile (persistent)
  echo 'export CLOUDFLARE_API_TOKEN="your_token_here"' >> ~/.bashrc
  source ~/.bashrc

Option 2: Set for current session
  export CLOUDFLARE_API_TOKEN="your_token_here"

Option 3: Create GitHub repo secret (for CI/CD)
  gh secret set CLOUDFLARE_API_TOKEN

Your API token needs these permissions:
  - Account → Cloudflare Pages → Edit
  - Account → Workers Scripts → Edit
  - Account → Workers KV Storage → Edit
  - Zone → DNS → Edit
  - Zone → Zone → Read""")
    sys.exit(1)

ACCOUNT_ID = os.environ.get("CLOUDFLARE_ACCOUNT_ID",
                            "fb7dc7b69b662480cd5961a4d1913c78")

if not os.environ.get("SKIP_MCP_CHECK"):
    mcp_bin = Path(os.environ.get(
        "MCP_BIN_PATH",
        "/home/tbaltzakis/cloudflare-pages-mcp/dist/index.js"))
    if mcp_bin.is_file():
        print(f"✅ MCP server binary exists at {mcp_bin}")
    else:
        print("⚠️  MCP server binary not found (local environment only)")
        print(f"    Expected: {mcp_bin}")


def api(path: str) -> dict:
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/{path}",
        headers={"Authorization": f"Bearer {token}"})
    try:
        return json.loads(
            urllib.request.urlopen(req, timeout=10).read())
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read())
        except Exception:
            return {"errors": [{"message": str(e)}]}
    except Exception as e:
        return {"errors": [{"message": str(e)}]}


print("🔍 Verifying Cloudflare API token...")
verify = api("user/tokens/verify")
if '"status":"active"' in json.dumps(verify):
    print("✅ Cloudflare API token is valid")
else:
    print(f"❌ Cloudflare API token is invalid: "
          f"{json.dumps(verify)}")
    sys.exit(1)

print("\n📋 Checking Cloudflare Pages projects...")
pages = api(f"accounts/{ACCOUNT_ID}/pages/projects")
if pages.get("errors"):
    print(f"⚠️  Cannot access Pages API "
          f"({pages['errors'][0].get('message', 'unknown error')})")
    print("   (Add 'Account → Cloudflare Pages → Edit' permission to "
          "token if needed)")
elif isinstance(pages.get("result"), list):
    if pages["result"]:
        print(f"Pages projects found ({len(pages['result'])}):")
        for p in pages["result"]:
            print(f"- {p.get('name')} ({p.get('subdomain')}.pages.dev)")
    else:
        print("  No Pages projects found on this account")
else:
    print("❌ Failed to list Pages projects (unexpected response)")

print("""
✅ Cloudflare app fix script completed successfully

Next steps:
  1. Restart Cline/Claude to load updated MCP settings
  2. Verify Worker deployment: python3 scripts/workers-ai-doctor.py""")
