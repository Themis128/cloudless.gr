import re
import shutil
import requests
from pathlib import Path
from urllib.parse import urljoin

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

LLMS_TXT_URL = "https://docs.langchain.com/llms.txt"
PERSIST_DIR = ".deepagents/langchain_docs_chroma"
COLLECTION_NAME = "langchain_docs"

# Explicit pages that the generic llms.txt extraction may miss or rank poorly.
SEED_URLS = [
    ("Deep Agents overview", "https://docs.langchain.com/oss/python/deepagents/overview.md"),
    ("Deep Agents quickstart", "https://docs.langchain.com/oss/python/deepagents/quickstart.md"),
    ("LangChain agents overview", "https://docs.langchain.com/oss/python/langchain/agents.md"),
    ("LangChain tools", "https://docs.langchain.com/oss/python/langchain/tools.md"),
    ("LangSmith tracing quickstart", "https://docs.langchain.com/langsmith/observability-quickstart.md"),
    ("LangSmith observability", "https://docs.langchain.com/langsmith/observability.md"),
    ("Deploy a Managed Deep Agent", "https://docs.langchain.com/langsmith/managed-deep-agents-deploy.md"),
    ("Managed Deep Agents overview", "https://docs.langchain.com/langsmith/managed-deep-agents-overview.md"),
    ("Managed Deep Agents CLI", "https://docs.langchain.com/langsmith/managed-deep-agents-cli.md"),
]

INCLUDE_PATTERNS = [
    "/oss/python/deepagents/",
    "/oss/python/langchain/",
    "/langsmith/observability",
    "/langsmith/log-",
    "/langsmith/add-metadata-tags",
    "/langsmith/managed-deep-agents",
]

EXCLUDE_PATTERNS = [
    "/api-reference/",
    "/smith-api/",
    "/agent-server-api/",
    "/managed-deep-agents-api/",
    "/fleet/",
    "/chat",
    "/sandbox",
    "/self-host",
    "/aws-self-hosted",
    "/azure-self-hosted",
    "/gcp-self-hosted",
    "/billing",
    "/pricing",
    "/admin",
]


def should_include(url: str) -> bool:
    if any(pattern in url for pattern in EXCLUDE_PATTERNS):
        return False

    if INCLUDE_PATTERNS and not any(pattern in url for pattern in INCLUDE_PATTERNS):
        return False

    return True


def fetch_text(url: str) -> str:
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    return response.text


def extract_markdown_links(llms_text: str):
    pattern = r"\[([^\]]*)\]\((https://docs\.langchain\.com/[^\)]+\.md)\)"
    links = re.findall(pattern, llms_text)

    cleaned = []
    seen = set()

    for title, url in links:
        if url in seen:
            continue

        if not should_include(url):
            continue

        seen.add(url)
        cleaned.append((title.strip() or "Untitled", url))

    return cleaned


def main() -> None:
    persist_path = Path(PERSIST_DIR)

    if persist_path.exists():
        print(f"Removing existing vector DB: {PERSIST_DIR}")
        shutil.rmtree(persist_path)

    persist_path.mkdir(parents=True, exist_ok=True)

    print(f"Fetching docs index: {LLMS_TXT_URL}")
    llms_text = fetch_text(LLMS_TXT_URL)

    links = extract_markdown_links(llms_text)

    # Add seed URLs first so they are guaranteed to exist.
    merged = []
    seen = set()

    for title, url in SEED_URLS + links:
        if url in seen:
            continue
        seen.add(url)
        merged.append((title, url))

    print(f"Selected docs: {len(merged)}")

    raw_docs = []

    for idx, (title, url) in enumerate(merged, start=1):
        print(f"[{idx}/{len(merged)}] {title} - {url}")

        try:
            content = fetch_text(url)
        except Exception as exc:
            print(f"  Skipping due to error: {exc}")
            continue

        raw_docs.append(
            Document(
                page_content=content,
                metadata={
                    "title": title,
                    "source": url,
                },
            )
        )

    print(f"Fetched docs: {len(raw_docs)}")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1400,
        chunk_overlap=220,
        separators=["\n# ", "\n## ", "\n### ", "\n\n", "\n", " ", ""],
    )

    chunks = splitter.split_documents(raw_docs)
    print(f"Chunks created: {len(chunks)}")

    print("Loading local embedding model: BAAI/bge-small-en-v1.5")
    embeddings = HuggingFaceEmbeddings(
        model_name="BAAI/bge-small-en-v1.5",
        encode_kwargs={"normalize_embeddings": True},
    )

    print(f"Writing Chroma DB to: {PERSIST_DIR}")
    Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=PERSIST_DIR,
        collection_name=COLLECTION_NAME,
    )

    print("Done.")


if __name__ == "__main__":
    main()
