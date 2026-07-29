import os

from dotenv import load_dotenv

load_dotenv(".env.local")

os.environ.setdefault("LANGSMITH_TRACING", "false")
os.environ.setdefault("LANGCHAIN_TRACING_V2", "false")
os.environ.setdefault("LANGCHAIN_TRACING", "false")

from langchain_chroma import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_openai import ChatOpenAI

PERSIST_DIR = ".deepagents/cloudless_repo_chroma"
COLLECTION_NAME = "cloudless_repo"

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
    max_tokens=1600,
)

prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are a local repo assistant for the cloudless.gr project.

Rules:
- Use ONLY the repository context below.
- Do NOT invent files, commands, APIs, or environment variables.
- If the answer is not in the context, say: "I don't know from the indexed repo."
- Be practical and concise.
- Mention relevant file paths.
- Do NOT output secrets.

Repository context:
{context}
""",
        ),
        ("human", "{question}"),
    ]
)


def retrieve(question: str, k: int = 8):
    q = question.lower()

    if "auth" in q or "cognito" in q or "nextauth" in q:
        query = f"{question} auth cognito nextauth .env.local AUTH_URL COGNITO"
    elif "k8s" in q or "kubernetes" in q or "deployment" in q:
        query = f"{question} k8s kubernetes deployment ingress service manifests"
    elif "sst" in q or "lambda" in q or "aws" in q:
        query = f"{question} sst aws lambda infrastructure config"
    elif "test" in q or "playwright" in q or "vitest" in q:
        query = f"{question} tests playwright vitest package.json"
    else:
        query = question

    return db.similarity_search(query, k=k)


def format_context(docs):
    parts = []

    for i, doc in enumerate(docs, start=1):
        source = doc.metadata.get("source", "Unknown source")
        content = doc.page_content[:2200]

        parts.append(f"[DOC {i}]\nFile: {source}\n\n{content}")

    return "\n\n---\n\n".join(parts)


def format_sources(docs, max_sources: int = 6) -> str:
    seen = set()
    lines = []

    for doc in docs:
        source = doc.metadata.get("source", "")

        if not source or source in seen:
            continue

        seen.add(source)
        lines.append(f"- `{source}`")

        if len(lines) >= max_sources:
            break

    return "\n\nFiles:\n" + "\n".join(lines) if lines else ""


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

    return response.content.strip() + format_sources(docs)


def main() -> None:
    print("Local cloudless.gr repo FAST RAG")
    print("Type 'q', 'quit', or 'exit' to stop.")

    while True:
        question = input("\nAsk repo > ").strip()

        if question.lower() in {"q", "quit", "exit"}:
            break

        if not question:
            continue

        print()
        print(ask(question))


if __name__ == "__main__":
    main()
