#!/usr/bin/env python3
"""Docker MCP Setup Script for Cloudless.gr.

Port of setup-mcp.sh. Run this when Docker Desktop is available.

Usage: python3 .docker/setup-mcp.py
"""

import subprocess

print("🔧 Setting up Docker MCP profile for cloudless.gr...")

subprocess.run(["docker", "mcp", "profile", "import", ".docker/mcp-profile.json"], check=True)

# Configure secrets (you'll be prompted for each)
print("🔐 Configuring secrets (you'll be prompted for each)...")
for secret in (
    "GITHUB_PERSONAL_ACCESS_TOKEN",
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "BRAVE_API_KEY",
):
    r = subprocess.run(["docker", "mcp", "secret", "set", secret], check=False)
    if r.returncode != 0:
        print(f"⚠️  {secret} not set")

print("✅ Setup complete!\n")
print("📋 To run the gateway: docker mcp gateway run --profile cloudless-dev")
print("📋 To connect VS Code: docker mcp client connect vscode --profile cloudless-dev")
print("📋 To list servers: docker mcp profile server ls --filter profile=cloudless-dev")
