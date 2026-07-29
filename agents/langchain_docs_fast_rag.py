import os

from dotenv import load_dotenv

load_dotenv(".env.local")

# Local-only: keep LangSmith off unless explicitly enabled.
os.environ.setdefault("LANGSMITH_TRACING", "false")
os.environ.setdefault("LANGCHAIN_TRACING_V2", "false")
os.environ.setdefault("LANGCHAIN_TRACING", "false")

from langchain_chroma import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_openai import ChatOpenAI

PERSIST_DIR = ".deepagents/langchain_docs_chroma"
COLLECTION_NAME = "langchain_docs"

embeddings = HuggingFaceEmbeddings(
    model_name="BAAI/bge-small-en-v1.5",
    encode_kwargs={"normalize_embeddings": True},
)

db = Chroma(
    persist_directory=PERSIST_DIR,
    embedding_function=embeddings,
    collection_name=COLLECTION_NAME,
)

llm = ChatOpenAI(
    model=os.getenv(
        "LOCAL_VLLM_MODEL",
        os.getenv("LOCAL_MODEL_NAME", "Qwen/Qwen2.5-Coder-3B-Instruct-AWQ"),
    ),
    base_url=os.getenv("OPENAI_BASE_URL", "http://127.0.0.1:8001/v1"),
    api_key=os.getenv("OPENAI_API_KEY", "EMPTY"),
    temperature=0.0,
    max_tokens=1400,
)

prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are a documentation-grounded assistant for LangChain, LangSmith, and Deep Agents.

Strict rules:
- Use ONLY the documentation context below.
- Do NOT invent URLs.
- Do NOT include a Sources section; sources will be added by the program.
- If the context does not contain the answer, say: "I don't know from the indexed docs."
- Prefer exact function names, package names, commands, and environment variables from the context.
- Be concise and practical.

Documentation context:
{context}
""",
        ),
        ("human", "{question}"),
    ]
)


def classify_query(question: str) -> str:
    q = question.lower()

    if "managed deep agent" in q or "deepagents deploy" in q or "managed" in q:
        return "managed_deepagents"

    if "deep agent" in q or "create_deep_agent" in q or "deepagents" in q:
        return "oss_deepagents"

    if "create_agent" in q or "tool" in q or "tools" in q:
        return "langchain_agents"

    if "tracing" in q or "trace" in q or "langsmith" in q or "observability" in q:
        return "langsmith_observability"

    return "general"


def expanded_query(question: str, query_type: str) -> str:
    if query_type == "oss_deepagents":
        return (
            f"{question} create_deep_agent deepagents overview quickstart "
            "Deep Agents Python LangChain file system tools subagents"
        )

    if query_type == "managed_deepagents":
        return (
            f"{question} Managed Deep Agents deepagents deploy agent.json "
            "deepagents init LangSmith CLI"
        )

    if query_type == "langchain_agents":
        return f"{question} create_agent tools LangChain Python @tool tool calling"

    if query_type == "langsmith_observability":
        return (
            f"{question} LANGSMITH_TRACING LANGSMITH_API_KEY LANGSMITH_PROJECT "
            "observability quickstart tracing"
        )

    return question


def source_boost(source: str, query_type: str) -> float:
    """Lower score is better. Return adjustment to add to vector distance."""
    source = source or ""

    if query_type == "oss_deepagents":
        if "/oss/python/deepagents/" in source:
            return -0.15
        if "/langsmith/managed-deep-agents" in source:
            return 0.10

    if query_type == "managed_deepagents":
        if "/langsmith/managed-deep-agents" in source:
            return -0.15
        if "/oss/python/deepagents/" in source:
            return 0.05

    if query_type == "langchain_agents":
        if "/oss/python/langchain/agents" in source:
            return -0.15
        if "/oss/python/langchain/tools" in source:
            return -0.15

    if query_type == "langsmith_observability":
        if "/langsmith/observability" in source:
            return -0.15
        if "/langsmith/log-" in source:
            return -0.10

    return 0.0


def retrieve(question: str, k: int = 7):
    query_type = classify_query(question)
    query = expanded_query(question, query_type)

    results = db.similarity_search_with_score(query, k=14)

    reranked = sorted(
        results,
        key=lambda item: item[1] + source_boost(item[0].metadata.get("source", ""), query_type),
    )

    return [doc for doc, _score in reranked[:k]]


def format_context(docs):
    parts = []

    for i, doc in enumerate(docs, start=1):
        title = doc.metadata.get("title", "Untitled")
        source = doc.metadata.get("source", "Unknown source")
        content = doc.page_content[:2200]

        parts.append(f"[DOC {i}]\nTitle: {title}\nSource: {source}\n\n{content}")

    return "\n\n---\n\n".join(parts)


def format_sources(docs, max_sources: int = 4) -> str:
    seen = set()
    lines = []

    for doc in docs:
        title = doc.metadata.get("title", "Untitled")
        source = doc.metadata.get("source", "")

        if not source or source in seen:
            continue

        seen.add(source)
        lines.append(f"- {title}: {source}")

        if len(lines) >= max_sources:
            break

    if not lines:
        return ""

    return "\n\nSources:\n" + "\n".join(lines)


def ask(question: str) -> str:
    docs = retrieve(question)
    context = format_context(docs)

    chain = prompt | llm
    response = chain.invoke(
        {
            "question": question,
            "context": context,
        }
    )

    answer = response.content.strip()
    sources = format_sources(docs)

    return answer + sources


def main() -> None:
    print("Local LangChain docs FAST RAG")
    print("Retrieval-first, one vLLM call per question, programmatic sources.")
    print("Type 'q', 'quit', or 'exit' to stop.")

    while True:
        question = input("\nAsk LangChain docs > ").strip()

        if question.lower() in {"q", "quit", "exit"}:
            break

        if not question:
            continue

        print()
        print(ask(question))


if __name__ == "__main__":
    main()
