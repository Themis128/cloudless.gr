import os

from dotenv import load_dotenv

load_dotenv(".env.local")

# Keep LangSmith disabled for local-only runs unless explicitly changed later.
os.environ.setdefault("LANGSMITH_TRACING", "false")
os.environ.setdefault("LANGCHAIN_TRACING_V2", "false")
os.environ.setdefault("LANGCHAIN_TRACING", "false")

from langchain.agents import create_agent
from langchain.tools import tool
from langchain_chroma import Chroma
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

retriever = db.as_retriever(search_kwargs={"k": 5})


@tool
def search_langchain_docs(query: str) -> str:
    """Search the indexed LangChain, LangSmith, and Deep Agents documentation."""
    docs = retriever.invoke(query)

    if not docs:
        return "No relevant LangChain documentation chunks found."

    formatted = []

    for idx, doc in enumerate(docs, start=1):
        title = doc.metadata.get("title", "Untitled")
        source = doc.metadata.get("source", "Unknown source")
        content = doc.page_content[:1800]

        formatted.append(f"[{idx}] Title: {title}\nSource: {source}\n\n{content}")

    return "\n\n---\n\n".join(formatted)


llm = ChatOpenAI(
    model=os.getenv(
        "LOCAL_VLLM_MODEL",
        os.getenv("LOCAL_MODEL_NAME", "Qwen/Qwen2.5-Coder-3B-Instruct-AWQ"),
    ),
    base_url=os.getenv("OPENAI_BASE_URL", "http://127.0.0.1:8001/v1"),
    api_key=os.getenv("OPENAI_API_KEY", "EMPTY"),
    temperature=0.1,
    max_tokens=2048,
)

agent = create_agent(
    model=llm,
    tools=[search_langchain_docs],
    system_prompt=(
        "You are a local LangChain documentation assistant. "
        "Use the search_langchain_docs tool before answering questions about "
        "LangChain, LangSmith, Deep Agents, agents, tracing, tools, memory, "
        "evaluation, deployment, or observability. "
        "Answer concisely and practically. "
        "Include source URLs from the tool output when useful. "
        "If the docs do not contain the answer, say you do not know."
    ),
)


def ask(question: str) -> str:
    result = agent.invoke(
        {
            "messages": [
                {
                    "role": "user",
                    "content": question,
                }
            ]
        }
    )

    messages = result.get("messages", [])
    return messages[-1].content if messages else str(result)


def main() -> None:
    print("Local LangChain docs agent")
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
