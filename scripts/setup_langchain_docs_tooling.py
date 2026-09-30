#!/usr/bin/env python3
"""Add deterministic LangChain documentation tooling to the
cloudless.gr local Deep Agents setup — creates the docs tool,
runner, caches the llms.txt index, and updates .gitignore +
agent memory."""

import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(os.environ.get("PROJECT_ROOT", Path.home() / "code/cloudless.gr"))
AGENTS = ROOT / "agents"
TOOLS = AGENTS / "tools"
MEM = ROOT / ".agent-memory"
DOCS = MEM / "docs"
MEM_F = MEM / "memories/AGENTS.md"
GITIGNORE = ROOT / ".gitignore"
INDEX = DOCS / "langchain_llms.txt"


def info(m):
    print(f"ℹ️  {m}")


def ok(m):
    print(f"✅ {m}")


def warn(m):
    print(f"⚠️  {m}")


def fail(m):
    print(f"❌ {m}")
    sys.exit(1)


def backup(p: Path):
    if p.is_file():
        b = f"{p}.bak-{time.strftime('%Y%m%d-%H%M%S')}"
        shutil.copy(p, b)
        warn(f"Backed up existing file: {b}")


info(f"Project root: {ROOT}")
if not ROOT.is_dir():
    fail(f"Project root does not exist: {ROOT}")
os.chdir(ROOT)

# 1. dirs + venv
for d in (TOOLS, ROOT / "scripts", DOCS, MEM / "memories"):
    d.mkdir(parents=True, exist_ok=True)
(AGENTS / "__init__.py").touch()
(TOOLS / "__init__.py").touch()

venv = ROOT / ".venv"
if not venv.is_dir():
    info("Creating .venv...")
    subprocess.run([sys.executable, "-m", "venv", ".venv"], check=True)
py = str(venv / "bin/python")
info("Installing/verifying Python dependencies...")
subprocess.run(
    [py, "-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel"], capture_output=True
)
subprocess.run(
    [py, "-m", "pip", "install", "--upgrade", "requests", "python-dotenv"], capture_output=True
)
ok("Dependencies installed/verified.")

# 2. gitignore
GITIGNORE.touch(exist_ok=True)
gi = GITIGNORE.read_text(errors="replace").splitlines()
for rule in (".agent-memory/", ".env.local"):
    if rule not in gi:
        gi.append(rule)
GITIGNORE.write_text("\n".join(gi) + "\n")
ok("Ensured .agent-memory/ and .env.local are ignored.")

# 3. memory file + docs note
if not MEM_F.is_file():
    MEM_F.write_text("""# cloudless.gr Agent Memory

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
""")
    ok(f"Created memory file: {MEM_F}")

NOTE = (
    "For LangChain, LangGraph, or Deep Agents questions, "
    "first use the cached docs.langchain.com/llms.txt "
    "index to discover official docs pages, then fetch "
    "relevant pages before answering."
)
if NOTE not in MEM_F.read_text():
    with MEM_F.open("a") as f:
        f.write(f"\n## Documentation workflow\n- {NOTE}\n")
    ok("Added LangChain docs workflow preference to memory.")
else:
    ok("LangChain docs workflow preference already exists in memory.")

# 4. docs tool
tool = TOOLS / "langchain_docs.py"
backup(tool)
tool.write_text('''from __future__ import annotations

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
    pattern = re.compile(r"- \\[(.*?)\\]\\((https://docs\\.langchain\\.com/.*?\\.md)\\)")
    links: list[dict[str, str]] = []
    for title, url in pattern.findall(text):
        title = title.strip() or url.rsplit("/", 1)[-1]
        links.append({"title": title, "url": url.strip()})
    return links


def _tokenize(query: str) -> set[str]:
    return {
        token.lower()
        for token in re.findall(r"[a-zA-Z0-9_\\-/.]+", query)
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
''')
ok(f"Wrote LangChain docs tool: {tool}")

# 5. runner
runner = AGENTS / "run_langchain_docs_research.py"
backup(runner)
runner.write_text("""import sys

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
                    "Prefer official LangChain docs over third-party explanations. "
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
""")
ok(f"Wrote docs runner: {runner}")

# 6. cache the index
info("Fetching/caching LangChain docs index from https://docs.langchain.com/llms.txt...")
env = dict(os.environ, PYTHONPATH=".")
r = subprocess.run(
    [
        py,
        "-c",
        """\
from agents.tools.langchain_docs import (
    refresh_langchain_docs_index,
    search_langchain_docs_index,
)
index = refresh_langchain_docs_index()
print(f"Cached llms.txt characters: {len(index)}")
print("Sample matches for 'Deep Agents memory FilesystemBackend':")
for item in search_langchain_docs_index(
        "Deep Agents memory FilesystemBackend",
        max_results=5):
    print(f"- {item['title']} -> {item['url']}")
""",
    ],
    env=env,
)
if r.returncode != 0:
    sys.exit(r.returncode)
ok(f"LangChain docs index cached at: {INDEX}")

print()
ok("LangChain docs tooling setup complete.\n")
print("Run examples:")
print(f"  cd {ROOT}")
print("  source .venv/bin/activate\n")
print(
    "  PYTHONPATH=. python agents/run_langchain_docs_research.py "
    '"How do I configure Deep Agents filesystem-backed memory?"\n'
)
print(
    "  PYTHONPATH=. python agents/run_langchain_docs_research.py "
    '"Deep Agents memory FilesystemBackend CompositeBackend '
    'AGENTS.md"\n'
)
print("Cache location:")
print(f"  {INDEX}")
