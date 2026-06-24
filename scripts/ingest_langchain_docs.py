import re
import requests
from pathlib import Path

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

LLMS_TXT_URL = "https://docs.langchain.com/llms.txt"
PERSIST_DIR = ".deepagents/langchain_docs_chroma"
COLLECTION_NAME = "langchain_docs"

# Keep this scoped at first.
# You can add/remove patterns later.
INCLUDE_PATTERNS = [
    "/oss/python/deepagents/",
    "/langsmith/",
]

# Avoid thousands of endpoint-reference chunks initially.
EXCLUDE_PATTERNS = [
    "/api-reference/",
    "/smith-api/",
]


def should_include(url: str) -> bool:
    if INCLUDE_PATTERNS and not any(pattern in url for pattern in INCLUDE_PATTERNS):
        return False

    if any(pattern in url for pattern in EXCLUDE_PATTERNS):
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
    Path(PERSIST_DIR).mkdir(parents=True, exist_ok=True)

    print(f"Fetching docs index: {LLMS_TXT_URL}")
    llms_text = fetch_text(LLMS_TXT_URL)

    links = extract_markdown_links(llms_text)
    print(f"Selected docs: {len(links)}")

    raw_docs = []

    for idx, (title, url) in enumerate(links, start=1):
        print(f"[{idx}/{len(links)}] {title} - {url}")

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
        chunk_size=1200,
        chunk_overlap=180,
        separators=["\n## ", "\n### ", "\n\n", "\n", " ", ""],
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
