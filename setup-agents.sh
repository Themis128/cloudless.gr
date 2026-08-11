#!/bin/bash
# Setup script for cloudless.gr agentic workflows
# Run this once to initialize the Python environment

set -euo pipefail

echo "=== Setting up agentic workflows ==="

# Step 1: Create virtual environment if needed
if [ ! -d ".venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv .venv
fi

# Step 2: Install Python dependencies
echo "Installing Python dependencies..."
.venv/bin/pip install -r agents/requirements.txt

# Step 3: Create .agent-memory directory if needed
mkdir -p .agent-memory/memories

# Step 4: Check for .env.local
if [ ! -f ".env.local" ]; then
    echo ""
    echo "=== IMPORTANT: .env.local not found ==="
    echo "Copy the following to .env.local and fill in your API keys:"
    echo ""
    cat << 'ENVHELP'
# Required for agent workflows
TAVILY_API_KEY=""

# OpenAI-compatible local model (vLLM)
OPENAI_BASE_URL="http://127.0.0.1:8001/v1"
OPENAI_API_KEY="dummy"
LOCAL_MODEL_NAME="Qwen/Qwen2.5-Coder-3B-Instruct-AWQ"

# Optional: GitHub PAT for GitHub MCP
# GITHUB_PERSONAL_ACCESS_TOKEN=""
ENVHELP
    echo ""
    echo "Then run: echo 'TAVILY_API_KEY=your_key_here' >> .env.local"
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "Usage:"
echo "  source .venv/bin/activate"
echo "  PYTHONPATH=. python agents/run_cloudless_agent.py 'Your question'"
echo "  PYTHONPATH=. python agents/run_langchain_docs_research.py 'How does memory work?'"
echo "  PYTHONPATH=. python agents/test_memory.py"