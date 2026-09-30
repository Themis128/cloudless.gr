#!/usr/bin/env python3
"""Setup script for cloudless.gr agentic workflows.

Port of setup-agents.sh. Run once to initialize the Python environment.

Usage: python3 setup-agents.py
"""

import subprocess
import sys
from pathlib import Path

ENVHELP = """\
# Required for agent workflows
TAVILY_API_KEY=""

# OpenAI-compatible local model (vLLM)
OPENAI_BASE_URL="http://127.0.0.1:8001/v1"
OPENAI_API_KEY="dummy"
LOCAL_MODEL_NAME="Qwen/Qwen2.5-Coder-3B-Instruct-AWQ"

# Optional: GitHub PAT for GitHub MCP
# GITHUB_PERSONAL_ACCESS_TOKEN=""
"""

print("=== Setting up agentic workflows ===")

# Step 1: Create virtual environment if needed
venv = Path(".venv")
if not venv.is_dir():
    print("Creating Python virtual environment...")
    subprocess.run([sys.executable, "-m", "venv", ".venv"], check=True)

# Step 2: Install Python dependencies
print("Installing Python dependencies...")
pip = venv / "bin" / "pip"
subprocess.run([str(pip), "install", "-r", "requirements.txt"], check=True)

# Step 3: Create .agent-memory directory if needed
Path(".agent-memory/memories").mkdir(parents=True, exist_ok=True)

# Step 4: Check for .env.local
if not Path(".env.local").is_file():
    print("\n=== IMPORTANT: .env.local not found ===")
    print("Copy the following to .env.local and fill in your API keys:\n")
    print(ENVHELP)
    print("Then run: echo 'TAVILY_API_KEY=your_key_here' >> .env.local")

print("\n=== Setup complete ===\n")
print("Usage:")
print("  source .venv/bin/activate")
print("  PYTHONPATH=. python agents/run_cloudless_agent.py 'Your question'")
print("  PYTHONPATH=. python agents/run_langchain_docs_research.py 'How does memory work?'")
print("  PYTHONPATH=. python agents/test_memory.py")
