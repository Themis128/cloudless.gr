#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# setup_cloudless_deepagents_memory.sh
#
# Purpose:
#   Configure a local Deep Agents research agent for cloudless.gr
#   with:
#     - Tavily pre-search
#     - local vLLM OpenAI-compatible model endpoint
#     - Chat Completions forced via use_responses_api=False
#     - filesystem-backed long-term memory
#
# Save this file at:
#   ~/code/cloudless.gr/scripts/setup_cloudless_deepagents_memory.sh
#
# Run from repo root:
#   bash scripts/setup_cloudless_deepagents_memory.sh
# ============================================================

PROJECT_ROOT="${PROJECT_ROOT:-$HOME/code/cloudless.gr}"
AGENTS_DIR="$PROJECT_ROOT/agents"
TOOLS_DIR="$AGENTS_DIR/tools"
MEMORY_DIR="$PROJECT_ROOT/.agent-memory/memories"
ENV_FILE="$PROJECT_ROOT/.env.local"
GITIGNORE="$PROJECT_ROOT/.gitignore"

MODEL_NAME="${LOCAL_MODEL_NAME:-Qwen/Qwen2.5-Coder-3B-Instruct-AWQ}"
OPENAI_BASE_URL_DEFAULT="http://127.0.0.1:8001/v1"

info() { echo "ℹ️  $*"; }
success() { echo "✅ $*"; }
warn() { echo "⚠️  $*"; }
fail() { echo "❌ $*"; exit 1; }

backup_if_exists() {
  local file="$1"
  if [ -f "$file" ]; then
    local backup="${file}.bak-$(date +%Y%m%d-%H%M%S)"
    cp "$file" "$backup"
    warn "Backed up existing file: $backup"
  fi
}

info "Project root: $PROJECT_ROOT"
[ -d "$PROJECT_ROOT" ] || fail "Project root not found: $PROJECT_ROOT"
cd "$PROJECT_ROOT"

# ------------------------------------------------------------
# 1. Ensure Python venv and dependencies
# ------------------------------------------------------------

if [ ! -d "$PROJECT_ROOT/.venv" ]; then
  info "Creating .venv..."
  python3 -m venv .venv
fi

# shellcheck disable=SC1091
source "$PROJECT_ROOT/.venv/bin/activate"

info "Installing/verifying Python dependencies..."
python -m pip install --upgrade pip setuptools wheel >/dev/null
python -m pip install --upgrade deepagents tavily-python langchain-openai python-dotenv >/dev/null
success "Python dependencies installed/verified."

# ------------------------------------------------------------
# 2. Create folders
# ------------------------------------------------------------

mkdir -p "$TOOLS_DIR" "$MEMORY_DIR" "$PROJECT_ROOT/scripts"
touch "$AGENTS_DIR/__init__.py" "$TOOLS_DIR/__init__.py"
success "Agent folders created."

# ------------------------------------------------------------
# 3. Seed long-term memory
# ------------------------------------------------------------

MEMORY_FILE="$MEMORY_DIR/AGENTS.md"
if [ ! -f "$MEMORY_FILE" ]; then
  cat > "$MEMORY_FILE" <<'EOF'
# cloudless.gr Agent Memory

## Response style
- Prefer concise, practical answers.
- Use commands and code blocks when helpful.
- For factual research, prefer source-backed answers.

## Project preferences
- Work safely on the cloudless.gr repository.
- Inspect and plan before editing files.
- Never modify secrets, .env files, deployment credentials, production workflows, or lockfiles without explicit approval.
- Prefer small diffs and validation after changes.

## Research behavior
- Use Tavily search results as source material when available.
- Do not invent sources or unsupported claims.
- Prefer official documentation when available.

## Security
- Never store API keys, tokens, passwords, private credentials, or sensitive personal data in memory.
EOF
  success "Seeded memory file: $MEMORY_FILE"
else
  success "Memory file already exists: $MEMORY_FILE"
fi

# ------------------------------------------------------------
# 4. Ensure memory and env files are ignored
# ------------------------------------------------------------

if [ ! -f "$GITIGNORE" ]; then
  touch "$GITIGNORE"
fi

# Use grep -a because this repo's .gitignore has previously been detected as binary.
grep -a -qxF ".agent-memory/" "$GITIGNORE" || echo ".agent-memory/" >> "$GITIGNORE"
grep -a -qxF ".env.local" "$GITIGNORE" || echo ".env.local" >> "$GITIGNORE"
grep -a -qxF ".env.local.bak-*" "$GITIGNORE" || echo ".env.local.bak-*" >> "$GITIGNORE"
success "Updated .gitignore rules."

# ------------------------------------------------------------
# 5. Create Tavily tool
# ------------------------------------------------------------

backup_if_exists "$TOOLS_DIR/search.py"
cat > "$TOOLS_DIR/search.py" <<'PY'
import os
from typing import Literal

from dotenv import load_dotenv
from tavily import TavilyClient

load_dotenv(".env.local")


def _get_tavily_client() -> TavilyClient:
    api_key = os.environ.get("TAVILY_API_KEY")
    if not api_key:
        raise RuntimeError(
            "TAVILY_API_KEY is not set. Add it to .env.local or export it in your shell."
        )
    return TavilyClient(api_key=api_key)


def internet_search(
    query: str,
    max_results: int = 5,
    topic: Literal["general", "news", "finance"] = "general",
    include_raw_content: bool = False,
):
    """Run a web search using Tavily."""
    return _get_tavily_client().search(
        query=query,
        max_results=max_results,
        include_raw_content=include_raw_content,
        topic=topic,
    )
PY
success "Wrote Tavily tool: $TOOLS_DIR/search.py"

# ------------------------------------------------------------
# 6. Create Deep Agent with memory backend
# ------------------------------------------------------------

backup_if_exists "$AGENTS_DIR/cloudless_research_agent.py"
cat > "$AGENTS_DIR/cloudless_research_agent.py" <<'PY'
import os
from pathlib import Path

from dotenv import load_dotenv
from deepagents import create_deep_agent
from langchain_openai import ChatOpenAI

from deepagents.backends import CompositeBackend, StateBackend
from deepagents.backends.filesystem import FilesystemBackend

from agents.tools.search import internet_search


load_dotenv(".env.local")

PROJECT_ROOT = Path(__file__).resolve().parents[1]
MEMORY_ROOT = PROJECT_ROOT / ".agent-memory"

research_instructions = """
You are an expert researcher and technical analyst for the cloudless.gr app.

Your job is to conduct thorough research, inspect relevant information, and write clear, polished reports.

You have access to an internet search tool as your primary means of gathering up-to-date information.

## internet_search

Use this to run an internet search for a given query.
You can specify:
- max_results
- topic: general, news, or finance
- whether raw content should be included

## Memory behavior

You have persistent memory available at /memories/AGENTS.md.

Use memory to remember stable, useful, non-secret preferences and project conventions.
You may update memory when the user explicitly asks you to remember something useful for future runs.
Never store secrets, API keys, tokens, passwords, private credentials, or sensitive personal data in memory.

## Research behavior

When search results are provided in the user message, use those search results as the primary source of truth.
For factual, technical, or current-information questions, do not answer from memory alone.
If search results are insufficient, say so.
Never invent organizations, ownership, URLs, dates, or unsupported claims.
"""

model = ChatOpenAI(
    model=os.getenv("LOCAL_MODEL_NAME", "Qwen/Qwen2.5-Coder-3B-Instruct-AWQ"),
    api_key=os.getenv("OPENAI_API_KEY", "dummy"),
    base_url=os.getenv("OPENAI_BASE_URL", "http://127.0.0.1:8001/v1"),
    temperature=0,
    max_tokens=1024,
    use_responses_api=False,
    stream_usage=False,
    disabled_params={
        "parallel_tool_calls": None,
    },
)

agent = create_deep_agent(
    model=model,
    tools=[internet_search],
    system_prompt=research_instructions,
    memory=["/memories/AGENTS.md"],
    backend=CompositeBackend(
        default=StateBackend(),
        routes={
            "/memories/": FilesystemBackend(root_dir=str(MEMORY_ROOT), virtual_mode=True),
        },
    ),
)
PY
success "Wrote agent: $AGENTS_DIR/cloudless_research_agent.py"

# ------------------------------------------------------------
# 7. Create deterministic research runner
# ------------------------------------------------------------

backup_if_exists "$AGENTS_DIR/run_cloudless_agent.py"
cat > "$AGENTS_DIR/run_cloudless_agent.py" <<'PY'
import sys

from dotenv import load_dotenv

from agents.cloudless_research_agent import agent
from agents.tools.search import internet_search

load_dotenv(".env.local")

query = " ".join(sys.argv[1:]) or "What is LangGraph?"

search_response = internet_search(
    query=query,
    max_results=5,
    topic="general",
    include_raw_content=False,
)

results = search_response.get("results", [])

formatted_sources = "\n\n".join(
    [
        f"Source {i + 1}:\n"
        f"Title: {item.get('title')}\n"
        f"URL: {item.get('url')}\n"
        f"Content: {item.get('content')}"
        for i, item in enumerate(results)
    ]
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": (
                    "Answer the question using ONLY the Tavily search results below. "
                    "Do not rely on model memory. "
                    "If the search results are insufficient, say so. "
                    "Prefer official documentation when present. "
                    "Do not make broad comparisons unless the provided sources explicitly support them. "
                    "Write 3-5 concise bullet points. "
                    "Include no claims that are not supported by the provided search results.\n\n"
                    f"Question: {query}\n\n"
                    f"Tavily search results:\n{formatted_sources}"
                ),
            }
        ]
    }
)

print("\n=== Answer ===\n")
print(result["messages"][-1].content)

print("\n=== Sources ===\n")
if not results:
    print("No Tavily sources returned.")
else:
    for i, item in enumerate(results, start=1):
        title = item.get("title") or "Untitled"
        url = item.get("url") or "No URL"
        print(f"{i}. {title}")
        print(f"   {url}")
PY
success "Wrote runner: $AGENTS_DIR/run_cloudless_agent.py"

# ------------------------------------------------------------
# 8. Create memory test runner
# ------------------------------------------------------------

backup_if_exists "$AGENTS_DIR/test_memory.py"
cat > "$AGENTS_DIR/test_memory.py" <<'PY'
from dotenv import load_dotenv

from agents.cloudless_research_agent import agent

load_dotenv(".env.local")

print("Step 1: Ask agent to remember preference")

result1 = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": (
                    "Remember this preference for future runs: "
                    "When explaining cloudless.gr architecture, use concise bullet points."
                ),
            }
        ]
    }
)

print(result1["messages"][-1].content)

print("\nStep 2: Ask what is remembered")

result2 = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "What response style preferences do you remember for cloudless.gr?",
            }
        ]
    }
)

print(result2["messages"][-1].content)
PY
success "Wrote memory test: $AGENTS_DIR/test_memory.py"

# ------------------------------------------------------------
# 9. Ensure .env.local has required non-secret defaults
# ------------------------------------------------------------

if [ ! -f "$ENV_FILE" ]; then
  touch "$ENV_FILE"
fi

if ! grep -q '^OPENAI_API_KEY=' "$ENV_FILE"; then
  echo 'OPENAI_API_KEY=dummy' >> "$ENV_FILE"
fi

if ! grep -q '^OPENAI_BASE_URL=' "$ENV_FILE"; then
  echo "OPENAI_BASE_URL=$OPENAI_BASE_URL_DEFAULT" >> "$ENV_FILE"
fi

if ! grep -q '^LOCAL_MODEL_NAME=' "$ENV_FILE"; then
  echo "LOCAL_MODEL_NAME=$MODEL_NAME" >> "$ENV_FILE"
fi

if ! grep -q '^TAVILY_API_KEY=' "$ENV_FILE"; then
  cat >> "$ENV_FILE" <<'EOF'
# Add your rotated Tavily key below. Do not commit this file.
TAVILY_API_KEY=
EOF
  warn "TAVILY_API_KEY placeholder added to .env.local. Fill it with your rotated key."
else
  success "TAVILY_API_KEY entry already exists in .env.local."
fi

# ------------------------------------------------------------
# 10. Final verification hints
# ------------------------------------------------------------

echo
success "Deep Agents memory setup complete."
echo
echo "Next steps:"
echo "1. Make sure vLLM is running in another terminal:"
echo "   cd ~/code/hugging-face && ./start_qwen_clean_server.sh"
echo
echo "2. Verify local model server:"
echo "   curl http://127.0.0.1:8001/v1/models"
echo
echo "3. Add/rotate Tavily key in:"
echo "   $ENV_FILE"
echo
echo "4. Run the research agent:"
echo "   cd $PROJECT_ROOT"
echo "   source .venv/bin/activate"
echo "   PYTHONPATH=. python agents/run_cloudless_agent.py \"What is LangGraph?\""
echo
echo "5. Test memory:"
echo "   PYTHONPATH=. python agents/test_memory.py"
echo
PYTHONPATH=. python - <<'PY'
from agents.cloudless_research_agent import agent
print("Agent import check: OK", bool(agent))
PY
