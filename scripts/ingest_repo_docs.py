import shutil
from pathlib import Path

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

ROOT = Path(".").resolve()
PERSIST_DIR = ".deepagents/cloudless_repo_chroma"
COLLECTION_NAME = "cloudless_repo"

INCLUDE_EXTENSIONS = {
    ".md",
    ".mdx",
    ".txt",
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".mjs",
    ".mts",
    ".sh",
}

EXCLUDE_DIRS = {
    ".git",
    ".next",
    ".venv",
    "node_modules",
    "coverage",
    "playwright-report",
    "test-results",
    ".ruff_cache",
    ".mypy_cache",
    ".deepagents",
    ".agent-memory",
    "__pycache__",
}

EXCLUDE_FILES = {
    "package-lock.json",
    "pnpm-lock.yaml",
    "tsconfig.tsbuildinfo",
}

SECRET_HINTS = [
    "SECRET",
    "TOKEN",
    "API_KEY",
    "PRIVATE_KEY",
    "PASSWORD",
    "CLIENT_SECRET",
    "AUTH_SECRET",
]


def should_skip_path(path: Path) -> bool:
    parts = set(path.parts)

    if parts.intersection(EXCLUDE_DIRS):
        return True

    if path.name in EXCLUDE_FILES:
        return True

    if path.suffix.lower() not in INCLUDE_EXTENSIONS:
        return True

    return False


def redact_secrets(text: str) -> str:
    lines = []

    for line in text.splitlines():
        upper = line.upper()

        if "=" in line and any(hint in upper for hint in SECRET_HINTS):
            key = line.split("=", 1)[0]
            lines.append(f"{key}=<REDACTED>")
        else:
            lines.append(line)

    return "\n".join(lines)


def load_files():
    docs = []

    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue

        rel = path.relative_to(ROOT)

        if should_skip_path(rel):
            continue

        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except Exception as exc:
            print(f"Skipping {rel}: {exc}")
            continue

        if not text.strip():
            continue

        text = redact_secrets(text)

        docs.append(
            Document(
                page_content=text,
                metadata={
                    "source": str(rel),
                    "title": str(rel),
                },
            )
        )

    return docs


def main() -> None:
    persist_path = Path(PERSIST_DIR)

    if persist_path.exists():
        print(f"Removing existing vector DB: {PERSIST_DIR}")
        shutil.rmtree(persist_path)

    print("Scanning repository...")
    docs = load_files()
    print(f"Loaded files: {len(docs)}")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1400,
        chunk_overlap=220,
        separators=["\n# ", "\n## ", "\n### ", "\n\n", "\n", " ", ""],
    )

    chunks = splitter.split_documents(docs)
    print(f"Chunks created: {len(chunks)}")

    print("Loading embedding model: BAAI/bge-small-en-v1.5")
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
