#!/usr/bin/env python3
"""Refresh the LangChain docs index from
docs.langchain.com/llms.txt and run sanity queries."""

import os
import sys
from pathlib import Path

ROOT = Path(os.environ.get("PROJECT_ROOT", Path.home() / "code/cloudless.gr"))
os.chdir(ROOT)
sys.path.insert(0, str(ROOT))

print("🔄 Refreshing LangChain docs index from docs.langchain.com/llms.txt...")

from agents.tools.langchain_docs import (  # noqa: E402
    refresh_langchain_docs_index,  # noqa: E402
    search_langchain_docs_index,  # noqa: E402
)

index = refresh_langchain_docs_index()
print(f"✅ Cached llms.txt characters: {len(index)}")

for query in (
    "Deep Agents filesystem-backed memory",
    "Deep Agents vs Claude Agent SDK comparison",
    "custom OpenAI-compatible model endpoint",
    "LangGraph local development langgraph dev",
):
    print(f"\n=== Matches for: {query} ===")
    matches = search_langchain_docs_index(query, max_results=8)
    if not matches:
        print("No matches.")
    else:
        for item in matches:
            print(f"- {item['title']} -> {item['url']}")

print(f"""
✅ LangChain docs index refreshed.
Cache path: {ROOT}/.agent-memory/docs/langchain_llms.txt""")
