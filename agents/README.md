# Cloudless.gr Agentic Workflows

Python-based agent workflows for research, documentation, and local experimentation.

## Setup

```bash
# 1. Create virtual environment and install dependencies
./setup-agents.sh

# Or manually:
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# 2. Create .env.local with your API keys
cp .env.example .env.local
# Edit .env.local to add your TAVILY_API_KEY
```

## Required Environment Variables

```bash
# Tavily Search API (for internet_search)
TAVILY_API_KEY="your_key_here"

# Local vLLM endpoint
OPENAI_BASE_URL="http://127.0.0.1:8001/v1"
OPENAI_API_KEY="dummy"
LOCAL_MODEL_NAME="Qwen/Qwen2.5-Coder-3B-Instruct-AWQ"
```

## Usage

Run from the repository root with `PYTHONPATH=.`:

```bash
# Main research agent (Tavily search + Deep Agents)
.venv/bin/python agents/run_cloudless_agent.py "What is LangGraph?"

# LangChain documentation research
.venv/bin/python agents/run_langchain_docs_research.py "How does memory work?"

# Positioning research
.venv/bin/python agents/run_positioning_research.py

# Memory test
.venv/bin/python agents/test_memory.py
```

## Experiments

Experimental LangChain v1 patterns (require local vLLM server):

```bash
# Test create_agent with local vLLM
.venv/bin/python agents/experiments/langchain_v1_create_agent_local_vllm.py

# Test middleware
.venv/bin/python agents/experiments/langchain_v1_modelrequest_middleware_local_vllm.py

# Test structured output
.venv/bin/python agents/experiments/langchain_v1_structured_output_local_vllm.py
```

## Architecture

- **cloudless_research_agent.py**: Main Deep Agents agent with Tavily search + filesystem memory
- **tools/**: Shared tools for search and documentation
  - `search.py`: Tavily-powered internet search
  - `langchain_docs.py`: LangChain documentation index and fetching
- **run_*.py**: CLI runners for various workflows
- **experiments/**: LangChain v1 experimental patterns

## Memory

The agent uses filesystem-backed memory at `.agent-memory/memories/AGENTS.md`. Use the remember tool to store preferences:

```bash
.venv/bin/python agents/remember.py "Your preference here"
```

## LangGraph Development

A `langgraph.json` is configured for local development with `langgraph dev`:

```bash
# Install LangGraph CLI
npm install -g @langchain/cli

# Start development server
uv run langgraph dev
