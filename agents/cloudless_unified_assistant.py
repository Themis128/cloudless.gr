import os
from dotenv import load_dotenv

load_dotenv(".env.local")

os.environ.setdefault("LANGSMITH_TRACING", "false")
os.environ.setdefault("LANGCHAIN_TRACING_V2", "false")
os.environ.setdefault("LANGCHAIN_TRACING", "false")

from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

LANGCHAIN_DB_DIR = ".deepagents/langchain_docs_chroma"
LANGCHAIN_COLLECTION = "langchain_docs"

REPO_DB_DIR = ".deepagents/cloudless_repo_chroma"
REPO_COLLECTION = "cloudless_repo"

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
    max_tokens=1800,
)

prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are a local engineering assistant for cloudless.gr.

You have two context sources:
1. LangChain, LangSmith, and Deep Agents documentation.
2. The local cloudless.gr repository.

Rules:
- Use ONLY the provided context.
- Do NOT invent files, APIs, commands, environment variables, or URLs.
- If the context is insufficient, say what is missing.
- Prefer concrete next steps.
- Mention relevant repo files and documentation sources.
- Do NOT output secrets.

Context:
{context}
""",
        ),
        ("human", "{question}"),
    ]
)


def classify(question: str) -> str:
    q = question.lower()

    docs_terms = [
        "langchain",
        "langsmith",
        "deep agent",
        "deepagents",
        "create_agent",
        "create_deep_agent",
        "tracing",
        "observability",
    ]

    repo_terms = [
        "cloudless",
        "repo",
        "this project",
        "auth",
        "cognito",
        "k8s",
        "kubernetes",
        "sst",
        "next.js",
        "nextjs",
        "package.json",
    ]

    wants_docs = any(term in q for term in docs_terms)
    wants_repo = any(term in q for term in repo_terms)

    if wants_docs and wants_repo:
        return "both"
    if wants_docs:
        return "docs"
    return "repo"


def retrieve_docs(question: str, k: int = 5):
    q = question.lower()

    if "managed deep agent" in q or "deepagents deploy" in q:
        query = f"{question} Managed Deep Agents deepagents deploy agent.json LangSmith CLI"
    elif "deep agent" in q or "create_deep_agent" in q:
        query = f"{question} create_deep_agent deepagents overview quickstart Python"
    elif "create_agent" in q or "tools" in q:
        query = f"{question} create_agent tools LangChain Python"
    elif "tracing" in q or "observability" in q:
        query = f"{question} LANGSMITH_TRACING LANGSMITH_API_KEY observability quickstart"
    else:
        query = question

    return langchain_db.similarity_search(query, k=k)


def retrieve_repo(question: str, k: int = 6):
    q = question.lower()

    if "auth" in q or "cognito" in q or "nextauth" in q:
        query = f"{question} auth cognito nextauth AUTH_URL COGNITO"
    elif "k8s" in q or "kubernetes" in q or "deployment" in q:
        query = f"{question} k8s kubernetes deployment ingress service manifests"
    elif "sst" in q or "lambda" in q or "aws" in q:
        query = f"{question} sst aws lambda infrastructure config"
    elif "agent" in q or "deep agent" in q or "langchain" in q:
        query = f"{question} agents skills AGENTS.md deepagents langchain local vllm"
    else:
        query = question

    return repo_db.similarity_search(query, k=k)


def format_context(repo_docs, langchain_docs):
    parts = []

    for i, doc in enumerate(repo_docs, start=1):
        source = doc.metadata.get("source", "Unknown file")
        content = doc.page_content[:2000]

        parts.append(
            f"[REPO {i}]\n"
            f"File: {source}\n\n"
            f"{content}"
        )

    for i, doc in enumerate(langchain_docs, start=1):
        title = doc.metadata.get("title", "Untitled")
        source = doc.metadata.get("source", "Unknown source")
        content = doc.page_content[:2000]

        parts.append(
            f"[DOCS {i}]\n"
            f"Title: {title}\n"
            f"Source: {source}\n\n"
            f"{content}"
        )

    return "\n\n---\n\n".join(parts)


def format_sources(repo_docs, langchain_docs):
    lines = []
    seen = set()

    if repo_docs:
        lines.append("\n\nRepo files:")
        for doc in repo_docs[:6]:
            source = doc.metadata.get("source", "")
            if source and source not in seen:
                seen.add(source)
                lines.append(f"- `{source}`")

    if langchain_docs:
        lines.append("\nDocs:")
        for doc in langchain_docs[:5]:
            title = doc.metadata.get("title", "Untitled")
            source = doc.metadata.get("source", "")
            if source and source not in seen:
                seen.add(source)
                lines.append(f"- {title}: {source}")

    return "\n".join(lines)


def ask(question: str) -> str:
    mode = classify(question)

    repo_docs = []
    langchain_docs = []

    if mode in {"repo", "both"}:
        repo_docs = retrieve_repo(question)

    if mode in {"docs", "both"}:
        langchain_docs = retrieve_docs(question)

    context = format_context(repo_docs, langchain_docs)

    chain = prompt | llm
    response = chain.invoke(
        {
            "question": question,
            "context": context,
        }
    )

    return response.content.strip() + format_sources(repo_docs, langchain_docs)


def main() -> None:
    print("Local cloudless.gr unified assistant")
    print("Searches repo + LangChain docs.")
    print("Type 'q', 'quit', or 'exit' to stop.")

    while True:
        question = input("\nAsk unified > ").strip()

        if question.lower() in {"q", "quit", "exit"}:
            break

        if not question:
            continue

        print()
        print(ask(question))


if __name__ == "__main__":
    main()
