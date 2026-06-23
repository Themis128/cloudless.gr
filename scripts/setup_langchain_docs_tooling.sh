#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# setup_langchain_docs_tooling.sh
#
# Purpose:
#   Add deterministic LangChain documentation tooling to the
#   cloudless.gr local Deep Agents setup.
#
# What this script creates/updates:
#   - agents/tools/langchain_docs.py
#   - agents/run_langchain_docs_research.py
#   - .agent-memory/docs/langchain_llms.txt
#   - .gitignore rule for .agent-memory/
#   - optional memory note in .agent-memory/memories/AGENTS.md
#
# Save at:
#   ~/code/cloudless.gr/scripts/setup_langchain_docs_tooling.sh
#
# Run from repo root:
#   bash scripts/setup_langchain_docs_tooling.sh
# ============================================================

PROJECT_ROOT="${PROJECT_ROOT:-$HOME/code/cloudless.gr}"
AGENTS_DIR="$PROJECT_ROOT/agents"
TOOLS_DIR="$AGENTS_DIR/tools"
SCRIPTS_DIR="$PROJECT_ROOT/scripts"
MEMORY_DIR="$PROJECT_ROOT/.agent-memory"
DOCS_DIR="$MEMORY_DIR/docs"
MEMORIES_DIR="$MEMORY_DIR/memories"
MEMORY_FILE="$MEMORIES_DIR/AGENTS.md"
GITIGNORE="$PROJECT_ROOT/.gitignore"
ENV_FILE="$PROJECT_ROOT/.env.local"
LANGCHAIN_LLMS_URL="https://docs.langchain.com/llms.txt"
LANGCHAIN_INDEX_CACHE="$DOCS_DIR/langchain_llms.txt"

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
[ -d "$PROJECT_ROOT" ] || fail "Project root does not exist: $PROJECT_ROOT"
cd "$PROJECT_ROOT"

# ------------------------------------------------------------
# 1. Ensure directories and venv
# ------------------------------------------------------------

mkdir -p "$TOOLS_DIR" "$SCRIPTS_DIR" "$DOCS_DIR" "$MEMORIES_DIR"
touch "$AGENTS_DIR/__init__.py" "$TOOLS_DIR/__init__.py"

if [ ! -d "$PROJECT_ROOT/.venv" ]; then
  info "Creating .venv..."
  python3 -m venv .venv
fi

# shellcheck disable=SC1091
source "$PROJECT_ROOT/.venv/bin/activate"

info "Installing/verifying Python dependencies..."
python -m pip install --upgrade pip setuptools wheel >/dev/null
python -m pip install --upgrade requests python-dotenv >/dev/null
success "Dependencies installed/verified."

# ------------------------------------------------------------
# 2. Ensure ignore rules
# ------------------------------------------------------------

if [ ! -f "$GITIGNORE" ]; then
  touch "$GITIGNORE"
fi

grep -a -qxF ".agent-memory/" "$GITIGNORE" || echo ".agent-memory/" >> "$GITIGNORE"
grep -a -qxF ".env.local" "$GITIGNORE" || echo ".env.local" >> "$GITIGNORE"
success "Ensured .agent-memory/ and .env.local are ignored."

# ------------------------------------------------------------
# 3. Ensure memory file exists and add docs workflow preference
# ------------------------------------------------------------

if [ ! -f "$MEMORY_FILE" ]; then
  cat > "$MEMORY_FILE" <<'EOF'
# cloudless.gr Agent Memory

## Response style
- Prefer concise, practical answers.
- Use commands and code blocks when helpful.
- For factual research, prefer source-backed answers.

## Research behavior
- Use source material as the primary source of truth.
- Do not invent sources or unsupported claims.
- Prefer official documentation when available.

## Security
- Never store API keys, tokens, passwords, private credentials, or sensitive personal data in memory.
EOF
  success "Created memory file: $MEMORY_FILE"
fi

DOCS_MEMORY_NOTE="For LangChain, LangGraph, or Deep Agents questions, first use the cached docs.langchain.com/llms.txt index to discover official docs pages, then fetch relevant pages before answering."
if ! grep -Fq "$DOCS_MEMORY_NOTE" "$MEMORY_FILE"; then
  cat >> "$MEMORY_FILE" <<EOF

## Documentation workflow
- $DOCS_MEMORY_NOTE
EOF
  success "Added LangChain docs workflow preference to memory."
else
  success "LangChain docs workflow preference already exists in memory."
fi

# ------------------------------------------------------------
# 4. Create LangChain docs tool
# ------------------------------------------------------------

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
    pattern = re.compile(r"- \[(.*?)\]\((https://docs\.langchain\.com/.*?\.md)\)")
    links: list[dict[str, str]] = []
    for title, url in pattern.findall(text):
        title = title.strip() or url.rsplit("/", 1)[-1]
        links.append({"title": title, "url": url.strip()})
    return links


def _tokenize(query: str) -> set[str]:
    return {
        token.lower()
        for token in re.findall(r"[a-zA-Z0-9_\-/.]+", query)
        if len(token) > 2
    }


def search_langchain_docs_index(query: str, max_results: int = 10) -> list[dict[str, str]]:
    """
    Search the cached LangChain docs index by title and URL.

    This is deterministic local search over docs.langchain.com/llms.txt.
    """
    index = load_langchain_docs_index(refresh=False)
    links = _extract_markdown_links(index)
    query_lower = query.lower()
    query_tokens = _tokenize(query)

    scored: list[tuple[int, dict[str, str]]] = []
    for link in links:
        haystack = f"{link['title']} {link['url']}".lower()
        score = sum(1 for token in query_tokens if token in haystack)

        # Helpful boosts for your main workflows.
        boosts = {
            "deepagents": 4,
            "deepagent": 4,
            "langgraph": 4,
            "memory": 3,
            "backend": 3,
            "filesystem": 3,
            "skills": 2,
            "context": 2,
            "deployment": 2,
            "custom-openai": 3,
        }
        for term, boost in boosts.items():
            if term in query_lower and term in haystack:
                score += boost

        if score > 0:
            scored.append((score, link))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [link for _, link in scored[:max_results]]


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
        except Exception as exc:  # noqa: BLE001 - useful CLI tool output
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
PY
success "Wrote LangChain docs tool: $TOOLS_DIR/langchain_docs.py"

# ------------------------------------------------------------
# 5. Create LangChain docs research runner
# ------------------------------------------------------------

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

# Ensure the docs index is cached.
load_langchain_docs_index(refresh=False)

matches = search_langchain_docs_index(query, max_results=5)
pages = fetch_langchain_doc_pages(
    [match["url"] for match in matches],
    max_chars_per_page=7000,
)

formatted_matches = "\n".join(
    f"{i + 1}. {match['title']} - {match['url']}"
    for i, match in enumerate(matches)
)

formatted_pages = "\n\n".join(
    f"PAGE {i + 1}\nURL: {page['url']}\nCONTENT:\n{page['content']}"
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
                    "Prefer official LangChain docs over third-party explanations. "
                    "Return a concise, practical answer. Include code or commands when useful.\n\n"
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
success "Wrote docs runner: $AGENTS_DIR/run_langchain_docs_research.py"

# ------------------------------------------------------------
# 6. Fetch/cache docs index now
# ------------------------------------------------------------

info "Fetching/caching LangChain docs index from $LANGCHAIN_LLMS_URL..."
PYTHONPATH=. python - <<'PY'
from agents.tools.langchain_docs import refresh_langchain_docs_index, search_langchain_docs_index

index = refresh_langchain_docs_index()
print(f"Cached llms.txt characters: {len(index)}")
print("Sample matches for 'Deep Agents memory FilesystemBackend':")
for item in search_langchain_docs_index("Deep Agents memory FilesystemBackend", max_results=5):
    print(f"- {item['title']} -> {item['url']}")
PY
success "LangChain docs index cached at: $LANGCHAIN_INDEX_CACHE"

# ------------------------------------------------------------
# 7. Final instructions
# ------------------------------------------------------------

echo
success "LangChain docs tooling setup complete."
echo
echo "Run examples:"
echo "  cd $PROJECT_ROOT"
echo "  source .venv/bin/activate"
echo
echo "  PYTHONPATH=. python agents/run_langchain_docs_research.py \"How do I configure Deep Agents filesystem-backed memory?\""
echo
echo "  PYTHONPATH=. python agents/run_langchain_docs_research.py \"Deep Agents memory FilesystemBackend CompositeBackend AGENTS.md\""
echo
echo "Cache location:"
echo "  $LANGCHAIN_INDEX_CACHE"
echo
