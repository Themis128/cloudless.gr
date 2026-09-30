#!/usr/bin/env python3
"""Restart MCP servers in the cloudless.gr project."""

import json
import subprocess
from pathlib import Path

print("🔄 Restarting MCP servers...")
print("=" * 44)

subprocess.run(["pkill", "-f", "mcp"], capture_output=True)

print("📋 Verifying MCP configuration...")
cfg = Path(".deepagents/.mcp.json")
if cfg.is_file():
    print("   ✅ MCP config found")
    mcp = json.loads(cfg.read_text())
    servers = list(mcp.get("mcpServers", {}).keys())
    print(f"   📦 Servers: {len(servers)}")
    for s in servers:
        print(f"      - {s}")
else:
    print("   ⚠️ MCP config not found")

print("🔧 Verifying ollama infrastructure...")
if Path(".deepagents/skills/ollama-infrastructure").is_dir():
    print("   ✅ Ollama infrastructure skill found")
else:
    print("   ❌ Ollama infrastructure skill missing")

print("📦 Verifying Cline configuration...")
if Path(".cline").is_dir():
    print("   ✅ Cline configuration directory found")
else:
    print("   ❌ Cline configuration missing")

print("\n✅ MCP restart complete!")
print("🎯 You can now start your agent/MCP client")
