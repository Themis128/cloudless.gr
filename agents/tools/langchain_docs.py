from __future__ import annotations

import re
from collections.abc import Iterable
from pathlib import Path

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
            "deep",
            "agents",
            "deepagents",
            "comparison",
            "claude",
            "claude-agent-sdk",
            "sdk",
            "sandbox",
            "backend",
            "deployment",
            "multi-tenancy",
            "model-provider",
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
            "deep",
            "agents",
            "deepagents",
            "backend",
            "backends",
            "filesystembackend",
            "filesystem",
            "compositebackend",
            "statebackend",
            "storebackend",
            "localshellbackend",
            "sandbox",
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
        "keywords": {
            "deep",
            "agents",
            "deepagents",
            "customize",
            "customization",
            "tools",
            "subagents",
            "instructions",
        },
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
    response = requests.get(
        url, timeout=timeout, headers={"User-Agent": "cloudless-gr-local-agent/0.1"}
    )
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

        if any(
            term in query_lower
            for term in [
                "backend",
                "backends",
                "filesystem",
                "filesystembackend",
                "compositebackend",
                "statebackend",
                "storebackend",
            ]
        ):
            if "deepagents/backends" in url:
                score += 25
            if "configure-ttl" in url:
                score -= 20

        if any(
            term in query_lower
            for term in ["claude agent sdk", "deep agents vs claude", "comparison with claude"]
        ):
            if "deepagents/comparison" in url:
                score += 40
            elif "/oss/python/deepagents/" in url:
                score -= 5

        if any(
            term in query_lower
            for term in [
                "openai-compatible",
                "openai compliant",
                "custom model",
                "custom endpoint",
                "vllm",
                "model endpoint",
                "local model",
            ]
        ):
            if "custom-endpoint" in url:
                score += 35
            if "custom-openai-compliant-model" in url:
                score += 35
            if "llm-gateway" in url or "model" in haystack:
                score += 8
            if "/oss/python/deepagents/" in url and "customization" not in url:
                score -= 8

        if any(
            term in query_lower
            for term in ["langgraph dev", "local development", "langgraph cli", "uv run langgraph"]
        ):
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


def fetch_langchain_doc_pages(
    urls: Iterable[str], max_chars_per_page: int = 8000
) -> list[dict[str, str]]:
    pages: list[dict[str, str]] = []
    for url in urls:
        try:
            text = fetch_url(url)
            pages.append({"url": url, "content": text[:max_chars_per_page]})
        except Exception as exc:
            pages.append({"url": url, "content": f"ERROR fetching page: {exc}"})
    return pages


def discover_and_fetch_langchain_docs(
    query: str, max_results: int = 5, max_chars_per_page: int = 7000
) -> dict[str, object]:
    matches = search_langchain_docs_index(query=query, max_results=max_results)
    pages = fetch_langchain_doc_pages(
        [match["url"] for match in matches], max_chars_per_page=max_chars_per_page
    )
    return {"matches": matches, "pages": pages}
