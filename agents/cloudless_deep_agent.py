import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(".env.local")

os.environ.setdefault("LANGSMITH_TRACING", "false")
os.environ.setdefault("LANGCHAIN_TRACING_V2", "false")
os.environ.setdefault("LANGCHAIN_TRACING", "false")

from deepagents import create_deep_agent
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_openai import ChatOpenAI

from agents.tools.cloudless_project_tools import (
    cloudless_constraints,
    list_project_files,
    package_scripts,
    project_tree_summary,
    read_project_file,
)
from agents.tools.langsmith_registry_tools import (
    call_registered_langsmith_endpoint,
    describe_langsmith_endpoint,
    list_langsmith_endpoints,
)

LANGCHAIN_DB_DIR = ".deepagents/langchain_docs_chroma"
LANGCHAIN_COLLECTION = "langchain_docs"

REPO_DB_DIR = ".deepagents/cloudless_repo_chroma"
REPO_COLLECTION = "cloudless_repo"

SKILL_FILES = [
    "skills/cloudless-architecture/SKILL.md",
    "skills/cloudless-langsmith/SKILL.md",
    "skills/cloudless-vibe-coding/SKILL.md",
    "skills/cloudless-k3s-storage/SKILL.md",
    "skills/cloudless-roadmap/SKILL.md",
]

ACTIVE_TOOLS = [
    cloudless_constraints,
    list_project_files,
    read_project_file,
    project_tree_summary,
    package_scripts,
    list_langsmith_endpoints,
    describe_langsmith_endpoint,
    call_registered_langsmith_endpoint,
]

embeddings = HuggingFaceEmbeddings(
    model_name="BAAI/bge-small-en-v1.5",
    encode_kwargs={"normalize_embeddings": True},
)

langchain_db = Chroma(
    persist_directory=LANGCHAIN_DB_DIR,
    embedding_function=embeddings,
    collection_name=LANGCHAIN_COLLECTION,
)

repo_db = Chroma(
    persist_directory=REPO_DB_DIR,
    embedding_function=embeddings,
    collection_name=REPO_COLLECTION,
)

llm = ChatOpenAI(
    model=os.getenv(
        "LOCAL_VLLM_MODEL",
        os.getenv("LOCAL_MODEL_NAME", "Qwen/Qwen2.5-Coder-3B-Instruct-AWQ"),
    ),
    base_url=os.getenv("OPENAI_BASE_URL", "http://127.0.0.1:8001/v1"),
    api_key=os.getenv("OPENAI_API_KEY", "EMPTY"),
    temperature=0.0,
    max_tokens=700,
)


def expand_repo_query(question: str) -> str:
    q = question.lower()

    if "auth" in q or "cognito" in q or "nextauth" in q:
        return f"{question} auth cognito nextauth AUTH_URL COGNITO .env.local"
    if "k8s" in q or "kubernetes" in q or "deployment" in q:
        return f"{question} k8s kubernetes deployment ingress service manifests"
    if "sst" in q or "lambda" in q or "aws" in q:
        return f"{question} sst aws lambda infrastructure config"
    if "agent" in q or "deep agent" in q or "langchain" in q:
        return f"{question} docs/local-ai-deep-agent-structure.md agents/cloudless_deep_agent.py agents/cloudless_deep_agent_smoke.py agents/cloudless_unified_assistant.py agents/cloudless_repo_fast_rag.py agents/langchain_docs_fast_rag.py scripts/ai.sh scripts/check_deepagent_cloudless.py scripts/ingest_repo_docs.py scripts/ingest_langchain_docs_focused.py deepagents langchain local vllm"
    return question


def expand_docs_query(question: str) -> str:
    q = question.lower()

    if "managed deep agent" in q or "deepagents deploy" in q:
        return f"{question} Managed Deep Agents deepagents deploy agent.json LangSmith CLI"
    if "deep agent" in q or "create_deep_agent" in q:
        return f"{question} create_deep_agent deepagents overview quickstart Python filesystem subagents"
    if "create_agent" in q or "tools" in q:
        return f"{question} create_agent tools LangChain Python @tool tool calling"
    if "tracing" in q or "observability" in q:
        return f"{question} LANGSMITH_TRACING LANGSMITH_API_KEY LANGSMITH_PROJECT observability quickstart"
    return question


def retrieve_repo(question: str, k: int = 2):
    return repo_db.similarity_search(expand_repo_query(question), k=k)


def retrieve_docs(question: str, k: int = 1):
    return langchain_db.similarity_search(expand_docs_query(question), k=k)



def load_skill_context(max_chars: int = 4000) -> str:
    """Load cloudless.gr Deep Agent skills as prompt context."""
    parts = []

    for skill_path in SKILL_FILES:
        path = Path(skill_path)

        if not path.exists():
            continue

        content = path.read_text(encoding="utf-8", errors="ignore").strip()

        if not content:
            continue

        parts.append(
            f"[SKILL]\n"
            f"File: {skill_path}\n\n"
            f"{content}"
        )

    return "\n\n---\n\n".join(parts)[:max_chars]


def format_context(repo_docs, docs_docs) -> str:
    parts = []

    for i, doc in enumerate(repo_docs, start=1):
        source = doc.metadata.get("source", "Unknown file")
        content = doc.page_content[:500]
        parts.append(
            f"[REPO {i}]\n"
            f"File: {source}\n\n"
            f"{content}"
        )

    for i, doc in enumerate(docs_docs, start=1):
        title = doc.metadata.get("title", "Untitled")
        source = doc.metadata.get("source", "Unknown source")
        content = doc.page_content[:500]
        parts.append(
            f"[DOCS {i}]\n"
            f"Title: {title}\n"
            f"Source: {source}\n\n"
            f"{content}"
        )

    return "\n\n---\n\n".join(parts)


def format_sources(repo_docs, docs_docs) -> str:
    lines = []
    seen = set()

    if repo_docs:
        lines.append("\n\nRepo files:")
        for doc in repo_docs:
            source = doc.metadata.get("source", "")
            if source and source not in seen:
                seen.add(source)
                lines.append(f"- `{source}`")

    if docs_docs:
        lines.append("\nDocs:")
        for doc in docs_docs:
            title = doc.metadata.get("title", "Untitled")
            source = doc.metadata.get("source", "")
            if source and source not in seen:
                seen.add(source)
                lines.append(f"- {title}: {source}")

    return "\n".join(lines)


agent = create_deep_agent(
    model=llm,
    tools=[],
    system_prompt=(
        "You are the read-only cloudless.gr Deep Agent. "
        "You answer using only the repo and documentation context provided in the user message. "
        "Do not invent files, commands, APIs, URLs, packages, or environment variables. "
        "Do not output secrets. "
        "Do not modify files. "
        "If context is insufficient, say what is missing. "
        "When suggesting implementation structure, use the existing repo layout from context."
    ),
)


def ask(question: str) -> str:
    skills_context = load_skill_context()
    question_lc = question.lower()

    repo_docs = []
    docs_docs = []

    if "registered langsmith endpoint" in question_lc or "langsmith endpoints" in question_lc:
        context = (
            "[LANGSMITH ENDPOINT REGISTRY]\n"
            + list_langsmith_endpoints()[:6000]
        )
    elif "package.json" in question_lc and "script" in question_lc:
        context = (
            "[PACKAGE.JSON SCRIPTS]\n"
            + package_scripts()[:6000]
        )
    elif "cloudless constraint" in question_lc or "k3s storage" in question_lc:
        context = (
            "[CLOUDLESS CONSTRAINTS]\n"
            + cloudless_constraints()[:3000]
        )
    else:
        repo_docs = retrieve_repo(question)
        docs_docs = retrieve_docs(question)
        context = format_context(repo_docs, docs_docs)

    grounded_question = f"""
Question:
{question}

Use only the following retrieved context and skills.

Skills:
{skills_context}

Context:
{context}

Instructions:
- Answer specifically for the existing cloudless.gr repository.
- Use cloudless.gr skills as project operating rules.
- Use read-only project tools when file inspection is needed.
- Use LangSmith registry tools only for registered endpoints.
- Do not call arbitrary URLs or unregistered LangSmith paths.
- Prefer the existing canonical local AI files:
  - docs/local-ai-deep-agent-structure.md
  - agents/cloudless_deep_agent.py
  - agents/cloudless_deep_agent_smoke.py
  - agents/cloudless_unified_assistant.py
  - agents/cloudless_repo_fast_rag.py
  - agents/langchain_docs_fast_rag.py
  - agents/local_qwen_agent.py
  - scripts/ai.sh
  - scripts/check_deepagent_cloudless.py
  - scripts/ingest_repo_docs.py
  - scripts/ingest_langchain_docs_focused.py
- Do not propose generic directories unless they already appear in the repo context.
- Do not invent new filenames when existing files already satisfy the role.
- If suggesting a new file, clearly label it as optional.
- If context does not contain the answer, say what is missing.
- Prefer exact existing file paths over generic suggestions.
- For vibe-coding requests, propose patches but do not claim files were modified.
- For LangSmith endpoint questions, use only the registered endpoint context.
- For k3s/PVC questions, enforce the OMV-MAIN 120GB SSD rule.
- Keep the answer concise and actionable.
- Do not include sources; they will be appended by the program.
"""

    result = agent.invoke(
        {
            "messages": [
                {
                    "role": "user",
                    "content": grounded_question,
                }
            ]
        }
    )

    messages = result.get("messages", [])
    answer = messages[-1].content.strip() if messages else str(result)

    return answer + format_sources(repo_docs, docs_docs)


def main() -> None:
    print("cloudless.gr Deep Agent")
    print("Read-only, retrieval-grounded: canonical repo files + repo search + LangChain docs")
    print("Type 'q', 'quit', or 'exit' to stop.")

    while True:
        question = input("\nAsk deep agent > ").strip()

        if question.lower() in {"q", "quit", "exit"}:
            break

        if not question:
            continue

        print()
        print(ask(question))


if __name__ == "__main__":
    main()
