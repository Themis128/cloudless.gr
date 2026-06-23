#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$HOME/code/cloudless.gr}"

cd "$PROJECT_ROOT"
source .venv/bin/activate

echo "🔄 Refreshing LangChain docs index from docs.langchain.com/llms.txt..."

PYTHONPATH=. python - <<'PY'
from agents.tools.langchain_docs import (
    refresh_langchain_docs_index,
    search_langchain_docs_index,
)

index = refresh_langchain_docs_index()
print(f"✅ Cached llms.txt characters: {len(index)}")

test_queries = [
    "Deep Agents filesystem-backed memory",
    "Deep Agents vs Claude Agent SDK comparison",
    "custom OpenAI-compatible model endpoint",
    "LangGraph local development langgraph dev",
]

for query in test_queries:
    print(f"\n=== Matches for: {query} ===")
    matches = search_langchain_docs_index(query, max_results=8)
    if not matches:
        print("No matches.")
    else:
        for item in matches:
            print(f"- {item['title']} -> {item['url']}")
PY

echo
echo "✅ LangChain docs index refreshed."
echo "Cache path: $PROJECT_ROOT/.agent-memory/docs/langchain_llms.txt"
