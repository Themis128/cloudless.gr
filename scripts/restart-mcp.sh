#!/usr/bin/env bash
# Restart MCP servers in cloudless.gr project

echo "🔄 Restarting MCP servers..."
echo "============================================"

# Kill any existing MCP processes
pkill -f "mcp" 2>/dev/null || true

# Verify configuration
echo "📋 Verifying MCP configuration..."
if [ -f ".deepagents/.mcp.json" ]; then
    echo "   ✅ MCP config found"
    python3 -c "
import json
with open('.deepagents/.mcp.json') as f:
    mcp = json.load(f)
    servers = list(mcp.get('mcpServers', {}).keys())
    print(f'   📦 Servers: {len(servers)}')
    for s in servers:
        print(f'      - {s}')
"
else
    echo "   ⚠️ MCP config not found"
fi

# Verify ollama infrastructure
echo "🔧 Verifying ollama infrastructure..."
if [ -d ".deepagents/skills/ollama-infrastructure" ]; then
    echo "   ✅ Ollama infrastructure skill found"
else
    echo "   ❌ Ollama infrastructure skill missing"
fi

# Verify cline config
echo "📦 Verifying Cline configuration..."
if [ -d ".cline" ]; then
    echo "   ✅ Cline configuration directory found"
else
    echo "   ❌ Cline configuration missing"
fi

echo ""
echo "✅ MCP restart complete!"
echo "🎯 You can now start your agent/MCP client"