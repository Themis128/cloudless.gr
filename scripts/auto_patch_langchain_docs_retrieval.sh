#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# auto_patch_langchain_docs_retrieval.sh
#
# Purpose:
#   Idempotently apply the current "known-good" LangChain docs
#   retrieval patches for cloudless.gr:
#     - curated OSS docs for Deep Agents / LangGraph
#     - better routing for Claude comparison questions
#     - better routing for custom OpenAI-compatible endpoints / vLLM
#     - better routing for LangGraph local development / langgraph dev
#     - stricter answer guardrails in the docs runner
#     - refresh and sanity-test docs.langchain.com/llms.txt cache
#
# Save at:
#   ~/code/cloudless.gr/scripts/auto_patch_langchain_docs_retrieval.sh
#
# Run:
#   cd ~/code/cloudless.gr
#   bash scripts/auto_patch_langchain_docs_retrieval.sh
# ============================================================

PROJECT_ROOT="${PROJECT_ROOT:-$HOME/code/cloudless.gr}"
AGENTS_DIR="$PROJECT_ROOT/agents"
TOOLS_DIR="$AGENTS_DIR/tools"
DOCS_DIR="$PROJECT_ROOT/.agent-memory/docs"
MEMORY_DIR="$PROJECT_ROOT/.agent-memory/memories"
MEMORY_FILE="$MEMORY_DIR/AGENTS.md"
GITIGNORE="$PROJECT_ROOT/.gitignore"

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

[ -d "$PROJECT_ROOT" ] || fail "Project root not found: $PROJECT_ROOT"
cd "$PROJECT_ROOT"

mkdir -p "$TOOLS_DIR" "$DOCS_DIR" "$MEMORY_DIR" scripts
touch "$AGENTS_DIR/__init__.py" "$TOOLS_DIR/__init__.py"

if [ -d "$PROJECT_ROOT/.venv" ]; then
  # shellcheck disable=SC1091
  source "$PROJECT_ROOT/.venv/bin/activate"
else
  fail "Missing .venv in $PROJECT_ROOT. Create/activate the project venv first."
fi

python -m pip install --upgrade requests python-dotenv >/dev/null

# Keep local cache and memory out of Git.
touch "$GITIGNORE"
grep -a -qxF ".agent-memory/" "$GITIGNORE" || echo ".agent-memory/" >> "$GITIGNORE"
grep -a -qxF ".env.local" "$GITIGNORE" || echo ".env.local" >> "$GITIGNORE"

backup_if_exists "$TOOLS_DIR/langchain_docs.py"
cat > "$TOOLS_DIR/langchain_docs.py" <<'PY'
from __future__ import annotations

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

CURATED_DOCS = [
    {
        "title": "Deep Agents comparison with Claude Agent SDK",
        "url": "https://docs.langchain.com/oss/python/deepagents/comparison.md",
        "keywords": {
            "deep", "agents", "deepagents", "comparison", "claude",
            "claude-agent-sdk", "sdk", "sandbox", "backend", "deployment",
            "multi-tenancy", "model-provider",
        },
    },
    {
        "title": "Deep Agents memory",
        "url": "https://docs.langchain.com/oss/python/deepagents/memory.md",
        "keywords": {"deep", "agents", "deepagents", "memory", "memories", "agents.md"},
    },
    {
        "title": "Deep Agents backends",
        "url": "https://docs.langchain.com/oss/python/deepagents/backends.md",
        "keywords": {
            "deep", "agents", "deepagents", "backend", "backends",
            "filesystembackend", "filesystem", "compositebackend", "statebackend",
            "storebackend", "localshellbackend", "sandbox",
        },
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
    {
        "title": "Connect to a custom model",
        "url": "https://docs.langchain.com/langsmith/custom-endpoint.md",
        "keywords": {"custom", "model", "endpoint", "openai", "compatible", "vllm", "provider"},
    },
    {
        "title": "Connect to an OpenAI compliant model provider/proxy",
        "url": "https://docs.langchain.com/langsmith/custom-openai-compliant-model.md",
        "keywords": {"openai", "compliant", "compatible", "model", "provider", "proxy", "vllm"},
    },
    {
        "title": "LangGraph CLI",
        "url": "https://docs.langchain.com/langsmith/cli.md",
        "keywords": {"langgraph", "cli", "langgraph dev", "uv", "local", "development"},
    },
    {
        "title": "Local development & testing",
        "url": "https://docs.langchain.com/langsmith/local-dev-testing.md",
        "keywords": {"local", "development", "testing", "langgraph", "dev"},
    },
]


def fetch_url(url: str, timeout: int = 30) -> str:
    response = requests.get(url, timeout=timeout, headers={"User-Agent": "cloudless-gr-local-agent/0.1"})
    response.raise_for_status()
    return response.text


def refresh_langchain_docs_index() -> str:
    DOCS_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    text = fetch_url(LANGCHAIN_LLMS_URL)
    LANGCHAIN_INDEX_CACHE.write_text(text, encoding="utf-8")
    return text


def load_langchain_docs_index(refresh: bool = False) -> str:
    if refresh or not LANGCHAIN_INDEX_CACHE.exists():
        return refresh_langchain_docs_index()
    return LANGCHAIN_INDEX_CACHE.read_text(encoding="utf-8")


def _extract_markdown_links(text: str) -> list[dict[str, str]]:
    pattern = re.compile(r"- \[(.*?)\]\((https://docs\.langchain\.com/.*?\.md)\)")
    links: list[dict[str, str]] = []
    seen: set[str] = set()

    for title, url in pattern.findall(text):
        title = title.strip() or url.rsplit("/", 1)[-1]
        url = url.strip()
        if url in seen:
            continue
        seen.add(url)
        links.append({"title": title, "url": url})

    for doc in CURATED_DOCS:
        if doc["url"] not in seen:
            links.append({"title": doc["title"], "url": doc["url"]})
            seen.add(doc["url"])

    return links


def _tokenize(query: str) -> set[str]:
    return {token.lower() for token in re.findall(r"[a-zA-Z0-9_\-/.]+", query) if len(token) > 2}


def _is_curated(url: str) -> bool:
    return any(doc["url"] == url for doc in CURATED_DOCS)


def _curated_keywords(url: str) -> set[str]:
    for doc in CURATED_DOCS:
        if doc["url"] == url:
            return set(doc["keywords"])
    return set()


def search_langchain_docs_index(query: str, max_results: int = 10) -> list[dict[str, str]]:
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

        if "/oss/python/" in url:
            score += 8

        if any(term in query_lower for term in ["deep agents", "deepagents", "deep agent"]):
            if "/oss/python/deepagents/" in url:
                score += 20
            if "managed-deep-agents" in url or "/langsmith/" in url:
                score -= 10

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

        if any(term in query_lower for term in ["claude agent sdk", "deep agents vs claude", "comparison with claude"]):
            if "deepagents/comparison" in url:
                score += 40
            elif "/oss/python/deepagents/" in url:
                score -= 5

        if any(term in query_lower for term in ["openai-compatible", "openai compliant", "custom model", "custom endpoint", "vllm", "model endpoint", "local model"]):
            if "custom-endpoint" in url:
                score += 35
            if "custom-openai-compliant-model" in url:
                score += 35
            if "llm-gateway" in url or "model" in haystack:
                score += 8
            if "/oss/python/deepagents/" in url and "customization" not in url:
                score -= 8

        if any(term in query_lower for term in ["langgraph dev", "local development", "langgraph cli", "uv run langgraph"]):
            if "langsmith/cli" in url:
                score += 30
            if "local-dev-testing" in url:
                score += 30
            if "langgraph" in haystack:
                score += 12
            if "/oss/python/deepagents/" in url:
                score -= 8

        if "langgraph" in query_lower and "/oss/python/langgraph/" in url:
            score += 15

        if _is_curated(url):
            score += 10
            score += sum(5 for token in query_tokens if token in _curated_keywords(url))

        if score > 0:
            scored.append((score, link))

    scored.sort(key=lambda item: item[0], reverse=True)
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


def fetch_langchain_doc_pages(urls: Iterable[str], max_chars_per_page: int = 8000) -> list[dict[str, str]]:
    pages: list[dict[str, str]] = []
    for url in urls:
        try:
            text = fetch_url(url)
            pages.append({"url": url, "content": text[:max_chars_per_page]})
        except Exception as exc:
            pages.append({"url": url, "content": f"ERROR fetching page: {exc}"})
    return pages


def discover_and_fetch_langchain_docs(query: str, max_results: int = 5, max_chars_per_page: int = 7000) -> dict[str, object]:
    matches = search_langchain_docs_index(query=query, max_results=max_results)
    pages = fetch_langchain_doc_pages([match["url"] for match in matches], max_chars_per_page=max_chars_per_page)
    return {"matches": matches, "pages": pages}
PY

backup_if_exists "$AGENTS_DIR/run_langchain_docs_research.py"
cat > "$AGENTS_DIR/run_langchain_docs_research.py" <<'PY'
import sys

from dotenv import load_dotenv

from agents.cloudless_research_agent import agent
from agents.tools.langchain_docs import (
    load_langchain_docs_index,
    search_langchain_docs_index,
    fetch_langchain_doc_pages,
)

load_dotenv(".env.local")

query = " ".join(sys.argv[1:]) or "How does Deep Agents memory work?"
query_lower = query.lower()

load_langchain_docs_index(refresh=False)

if (
    "claude agent sdk" in query_lower
    or "deep agents vs claude" in query_lower
    or "comparison with claude" in query_lower
):
    matches = [
        {
            "title": "Deep Agents comparison with Claude Agent SDK",
            "url": "https://docs.langchain.com/oss/python/deepagents/comparison.md",
        }
    ]
else:
    matches = search_langchain_docs_index(query, max_results=5)

pages = fetch_langchain_doc_pages([match["url"] for match in matches], max_chars_per_page=12000)

formatted_matches = "\n".join(f"{i + 1}. {match['title']} - {match['url']}" for i, match in enumerate(matches))
formatted_pages = "\n\n".join(f"PAGE {i + 1}\nURL: {page['url']}\nCONTENT:\n{page['content']}" for i, page in enumerate(pages))

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
                    "Do not invent cost, support, security, performance, popularity, community, or required-code-change claims unless the docs explicitly state them. "
                    "Separate documented facts from project-specific recommendations. "
                    "If making a recommendation for cloudless.gr, label it as an inference. "
                    "For comparison questions, compare only dimensions explicitly covered by the fetched comparison page. "
                    "Use careful wording such as may, can, or inference only when the claim is clearly an implication, not a documented fact. "
                    "Return a concise, practical answer with these sections when relevant:\n"
                    "1. Documented facts from the provided docs only\n"
                    "2. Implications for cloudless.gr, clearly labeled as inferences\n"
                    "3. Caveats / unsupported areas\n\n"
                    f"Question: {query}\n\n"
                    f"Matched docs from llms.txt index:\n{formatted_matches}\n\n"
                    f"Fetched docs content:\n{formatted_pages}"
                ),
            }
        ]
    }
)

print("\n=== Answer ===\n")
print(result["messages"][-1].content)

print("\n=== Official Docs Used ===\n")
if not matches:
    print("No matching LangChain docs found in llms.txt.")
else:
    for i, match in enumerate(matches, start=1):
        print(f"{i}. {match['title']}")
        print(f"   {match['url']}")
PY

NOTE="For official docs research, use curated LangChain docs routing and avoid unsupported claims about cost, support, security, performance, or required code changes unless fetched docs explicitly state them."
if [ ! -f "$MEMORY_FILE" ]; then
  cat > "$MEMORY_FILE" <<EOF
# cloudless.gr Agent Memory

## Documentation workflow
- $NOTE
EOF
elif ! grep -Fq "$NOTE" "$MEMORY_FILE"; then
  cat >> "$MEMORY_FILE" <<EOF

## Documentation workflow
- $NOTE
EOF
fi

info "Refreshing llms.txt and running retrieval smoke tests..."
PYTHONPATH=. python - <<'PY'
from agents.tools.langchain_docs import refresh_langchain_docs_index, search_langchain_docs_index

index = refresh_langchain_docs_index()
print(f"Cached llms.txt characters: {len(index)}")

queries = [
    "Deep Agents filesystem-backed memory",
    "Deep Agents vs Claude Agent SDK comparison",
    "custom OpenAI-compatible model endpoint vLLM",
    "LangGraph local development langgraph dev",
]

for query in queries:
    print(f"\n=== Matches for: {query} ===")
    for item in search_langchain_docs_index(query, max_results=8):
        print(f"- {item['title']} -> {item['url']}")
PY

success "Automated LangChain docs retrieval patch complete."
echo
printf 'Try:\n'
printf 'PYTHONPATH=. python agents/run_langchain_docs_research.py "Compare Deep Agents with Claude Agent SDK for my local vLLM-powered cloudless.gr agent architecture."\n'
printf 'PYTHONPATH=. python agents/run_langchain_docs_research.py "How do I connect LangChain to a custom OpenAI-compatible endpoint such as local vLLM?"\n'
printf 'PYTHONPATH=. python agents/run_langchain_docs_research.py "How should I use LangGraph local development with uv run langgraph dev?"\n'
