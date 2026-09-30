#!/usr/bin/env python3
"""Improve LangChain docs retrieval — rewrites
agents/tools/langchain_docs.py (curated OSS-doc boosts so Deep
Agents memory/backend questions prefer official OSS docs over
LangSmith TTL/Managed pages) and the basic
run_langchain_docs_research.py runner, then refreshes the index."""

import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(os.environ.get("PROJECT_ROOT",
                           Path.home() / "code/cloudless.gr"))
AGENTS = ROOT / "agents"
TOOLS = AGENTS / "tools"
DOCS = ROOT / ".agent-memory/docs"

os.chdir(ROOT)
TOOLS.mkdir(parents=True, exist_ok=True)
DOCS.mkdir(parents=True, exist_ok=True)
(ROOT / "scripts").mkdir(exist_ok=True)

(AGENTS / "__init__.py").touch()
(TOOLS / "__init__.py").touch()

ts = time.strftime("%Y%m%d-%H%M%S")
lc = TOOLS / "langchain_docs.py"
if lc.is_file():
    shutil.copy(lc, f"{lc}.bak-{ts}")

lc.write_text('''from __future__ import annotations

import re
from pathlib import Path
from typing import Iterable

import requests
from dotenv import load_dotenv

load_dotenv(".env.local")

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DOCS_CACHE_DIR = PROJECT_ROOT / ".agent-memory" / "docs"
LANGCHAIN_INDEX_CACHE = DOCS_CACHE_DIR / "langchain_llms.txt"
LANGCHAIN_LLMS_URL = "https://docs.langchain.com/llms.txt"

# Curated official OSS docs that are especially relevant for your local setup.
# These are boosted above broad LangSmith / Managed Deep Agents docs when query terms match.
CURATED_DOCS = [
    {
        "title": "Deep Agents memory",
        "url": "https://docs.langchain.com/oss/python/deepagents/memory.md",
        "keywords": {"deep", "agents", "deepagents", "memory", "memories", "agents.md"},
    },
    {
        "title": "Deep Agents backends",
        "url": "https://docs.langchain.com/oss/python/deepagents/backends.md",
        "keywords": {"deep", "agents", "deepagents", "backend", "backends", "filesystembackend", "filesystem", "compositebackend", "statebackend", "storebackend"},
    },
    {
        "title": "Deep Agents context engineering",
        "url": "https://docs.langchain.com/oss/python/deepagents/context-engineering.md",
        "keywords": {"deep", "agents", "deepagents", "context", "state", "short-term", "scratch"},
    },
    {
        "title": "Deep Agents skills",
        "url": "https://docs.langchain.com/oss/python/deepagents/skills.md",
        "keywords": {"deep", "agents", "deepagents", "skills", "skill"},
    },
    {
        "title": "Customize Deep Agents",
        "url": "https://docs.langchain.com/oss/python/deepagents/customization.md",
        "keywords": {"deep", "agents", "deepagents", "customize", "customization", "tools", "subagents", "instructions"},
    },
    {
        "title": "LangGraph overview",
        "url": "https://docs.langchain.com/oss/python/langgraph/overview.md",
        "keywords": {"langgraph", "overview", "graph", "state", "agents"},
    },
]


def fetch_url(url: str, timeout: int = 30) -> str:
    """Fetch a URL as text."""
    response = requests.get(
        url,
        timeout=timeout,
        headers={"User-Agent": "cloudless-gr-local-agent/0.1"},
    )
    response.raise_for_status()
    return response.text


def refresh_langchain_docs_index() -> str:
    """Fetch and cache the LangChain docs llms.txt index."""
    DOCS_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    text = fetch_url(LANGCHAIN_LLMS_URL)
    LANGCHAIN_INDEX_CACHE.write_text(text, encoding="utf-8")
    return text


def load_langchain_docs_index(refresh: bool = False) -> str:
    """Load the cached LangChain docs index, fetching it if needed."""
    if refresh or not LANGCHAIN_INDEX_CACHE.exists():
        return refresh_langchain_docs_index()
    return LANGCHAIN_INDEX_CACHE.read_text(encoding="utf-8")


def _extract_markdown_links(text: str) -> list[dict[str, str]]:
    """Extract docs.langchain.com markdown links from llms.txt."""
    pattern = re.compile(r"- \\[(.*?)\\]\\((https://docs\\.langchain\\.com/.*?\\.md)\\)")
    links: list[dict[str, str]] = []
    seen: set[str] = set()

    for title, url in pattern.findall(text):
        title = title.strip() or url.rsplit("/", 1)[-1]
        url = url.strip()
        if url in seen:
            continue
        seen.add(url)
        links.append({"title": title, "url": url})

    # Add curated docs even if llms.txt was truncated and omitted them.
    for doc in CURATED_DOCS:
        if doc["url"] not in seen:
            links.append({"title": doc["title"], "url": doc["url"]})
            seen.add(doc["url"])

    return links


def _tokenize(query: str) -> set[str]:
    return {
        token.lower()
        for token in re.findall(r"[a-zA-Z0-9_\\-/.]+", query)
        if len(token) > 2
    }


def _is_curated(url: str) -> bool:
    return any(doc["url"] == url for doc in CURATED_DOCS)


def _curated_keywords(url: str) -> set[str]:
    for doc in CURATED_DOCS:
        if doc["url"] == url:
            return set(doc["keywords"])
    return set()


def search_langchain_docs_index(query: str, max_results: int = 10) -> list[dict[str, str]]:
    """
    Search the cached LangChain docs index by title and URL.

    Biases toward official OSS docs under /oss/python/... for local Deep Agents,
    LangGraph, memory, and backend questions. This avoids broad LangSmith pages
    such as TTL or Managed Deep Agents when the user asks about local Python APIs.
    """
    index = load_langchain_docs_index(refresh=False)
    links = _extract_markdown_links(index)
    query_lower = query.lower()
    query_tokens = _tokenize(query)

    scored: list[tuple[int, dict[str, str]]] = []

    for link in links:
        title = link["title"]
        url = link["url"]
        haystack = f"{title} {url}".lower()
        score = sum(2 for token in query_tokens if token in haystack)

        # Strongly prefer OSS Python docs for local code questions.
        if "/oss/python/" in url:
            score += 8

        # Strong Deep Agents boosts.
        if any(term in query_lower for term in ["deep agents", "deepagents", "deep agent"]):
            if "/oss/python/deepagents/" in url:
                score += 20
            if "managed-deep-agents" in url or "/langsmith/" in url:
                score -= 10

        # Memory/backend-specific boosts.
        if any(term in query_lower for term in ["memory", "memories", "agents.md"]):
            if "deepagents/memory" in url:
                score += 25
            if "configure-ttl" in url:
                score -= 20

        if any(term in query_lower for term in ["backend", "backends", "filesystem", "filesystembackend", "compositebackend", "statebackend", "storebackend"]):
            if "deepagents/backends" in url:
                score += 25
            if "configure-ttl" in url:
                score -= 20

        # LangGraph boost.
        if "langgraph" in query_lower and "/oss/python/langgraph/" in url:
            score += 15

        # Curated docs keyword matching.
        if _is_curated(url):
            score += 10
            keywords = _curated_keywords(url)
            score += sum(5 for token in query_tokens if token in keywords)

        if score > 0:
            scored.append((score, link))

    scored.sort(key=lambda item: item[0], reverse=True)

    # De-duplicate URLs after scoring.
    output: list[dict[str, str]] = []
    seen_urls: set[str] = set()
    for _, link in scored:
        if link["url"] in seen_urls:
            continue
        seen_urls.add(link["url"])
        output.append(link)
        if len(output) >= max_results:
            break

    return output


def fetch_langchain_doc_pages(
    urls: Iterable[str],
    max_chars_per_page: int = 8000,
) -> list[dict[str, str]]:
    """Fetch selected LangChain docs pages and truncate each page."""
    pages: list[dict[str, str]] = []
    for url in urls:
        try:
            text = fetch_url(url)
            pages.append({"url": url, "content": text[:max_chars_per_page]})
        except Exception as exc:  # noqa: BLE001 - CLI/debug usefulness
            pages.append({"url": url, "content": f"ERROR fetching page: {exc}"})
    return pages


def discover_and_fetch_langchain_docs(
    query: str,
    max_results: int = 5,
    max_chars_per_page: int = 7000,
) -> dict[str, object]:
    """Search llms.txt and fetch the matched official docs pages."""
    matches = search_langchain_docs_index(query=query, max_results=max_results)
    pages = fetch_langchain_doc_pages(
        [match["url"] for match in matches],
        max_chars_per_page=max_chars_per_page,
    )
    return {"matches": matches, "pages": pages}
''')

runner = AGENTS / "run_langchain_docs_research.py"
if runner.is_file():
    shutil.copy(runner, f"{runner}.bak-{ts}")

runner.write_text('''import sys

from dotenv import load_dotenv

from agents.cloudless_research_agent import agent
from agents.tools.langchain_docs import (
    load_langchain_docs_index,
    search_langchain_docs_index,
    fetch_langchain_doc_pages,
)

load_dotenv(".env.local")

query = " ".join(sys.argv[1:]) or "How does Deep Agents memory work?"

# Ensure the docs index is cached.
load_langchain_docs_index(refresh=False)

matches = search_langchain_docs_index(query, max_results=5)
pages = fetch_langchain_doc_pages(
    [match["url"] for match in matches],
    max_chars_per_page=9000,
)

formatted_matches = "\\n".join(
    f"{i + 1}. {match['title']} - {match['url']}"
    for i, match in enumerate(matches)
)

formatted_pages = "\\n\\n".join(
    f"PAGE {i + 1}\\nURL: {page['url']}\\nCONTENT:\\n{page['content']}"
    for i, page in enumerate(pages)
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": (
                    "Use ONLY the official LangChain documentation content below. "
                    "Do not rely on model memory. "
                    "If the docs content is insufficient, say so. "
                    "Prefer /oss/python official docs over LangSmith deployment docs for local Python API questions. "
                    "Return a concise, practical answer. Include code or commands when useful.\\n\\n"
                    f"Question: {query}\\n\\n"
                    f"Matched docs from llms.txt index:\\n{formatted_matches}\\n\\n"
                    f"Fetched docs content:\\n{formatted_pages}"
                ),
            }
        ]
    }
)

print("\\n=== Answer ===\\n")
print(result["messages"][-1].content)

print("\\n=== Official Docs Used ===\\n")
if not matches:
    print("No matching LangChain docs found in llms.txt.")
else:
    for i, match in enumerate(matches, start=1):
        print(f"{i}. {match['title']}")
        print(f"   {match['url']}")
''')

env = dict(os.environ, PYTHONPATH=".")
r = subprocess.run(
    [sys.executable, "-c", """\
from agents.tools.langchain_docs import (
    refresh_langchain_docs_index,
    search_langchain_docs_index,
)
index = refresh_langchain_docs_index()
print(f"Cached llms.txt characters: {len(index)}")
print("\\nMatches for: Deep Agents filesystem-backed memory")
for item in search_langchain_docs_index(
        "Deep Agents filesystem-backed memory",
        max_results=8):
    print(f"- {item['title']} -> {item['url']}")
"""], env=env)
if r.returncode != 0:
    sys.exit(r.returncode)

print()
print("✅ Fixed LangChain docs retrieval. Try:")
print('PYTHONPATH=. python agents/run_langchain_docs_research.py '
      '"How do I configure Deep Agents filesystem-backed memory?"')
